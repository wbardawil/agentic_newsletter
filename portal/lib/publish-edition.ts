/**
 * Publish an approved edition directly into Supabase — server-only.
 *
 * This is the portal's replacement for the Cloudflare Worker → repository_dispatch
 * → `pnpm publish:edition` chain, scoped to the Supabase half of the old
 * dual-publish (Beehiiv stays available via the manual `publish-to-beehiiv.yml`
 * workflow_dispatch — it is NOT triggered here).
 *
 * Flow:
 *   1. Read drafts/<edition>-draft.json from the `drafts/<edition>` GitHub branch
 *   2. Enforce quality gate (QA score ≥ QA_MIN_SCORE)
 *   3. Read drafts/<edition>-review.json — verify image AND content are approved
 *   4. Upsert `editions` + replace `edition_sources` via the service-role client
 *      (hero_image_url populated from review.image.publicUrl)
 *
 * Review gate escape hatch: set SKIP_REVIEW_GATE=true in env (migration / emergency
 * only — never use in normal production flow).
 *
 * Parity note: the body is rendered from the draft JSON sections
 * (`renderLocalizedToMarkdown`), identical to `src/utils/portal-sync.ts`.
 */

import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadAsset } from "@/lib/supabase/storage";
import { fetchDraftJson, fetchDraftAsset, GitHubError } from "@/lib/github";
import {
  buildEditionRow,
  buildSourceRows,
  type MirrorInput,
} from "@/lib/edition-mapping";

if (typeof window !== "undefined") {
  throw new Error("portal/lib/publish-edition.ts is server-only and must not be imported from client components.");
}

export type PublishErrorCode =
  | "NOT_FOUND"
  | "QUALITY_GATE"
  | "CONFIG"
  | "GITHUB"
  | "INVALID_DRAFT"
  | "DB"
  | "UNKNOWN";

export class PublishError extends Error {
  constructor(
    public code: PublishErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishResult {
  editionId: string;
  editionDbId: string;
  sourcesMirrored: number;
  qaScore: number;
  heroImageUrl: string | null;
}

// ── draft parsing (subset of the pipeline schemas we read) ───────────────────

const SectionSchema = z.object({ type: z.string(), body: z.string() });
const LocalizedSchema = z.object({
  language: z.enum(["en", "es"]),
  subject: z.string().min(1),
  shareableSentence: z.string().nullish(),
  sections: z.array(SectionSchema).min(1),
});
const DraftSchema = z.object({
  editionId: z.string().optional(),
  angle: z
    .object({
      osPillar: z.string().nullish(),
      quarterlyTheme: z.string().nullish(),
    })
    .passthrough(),
  enContent: LocalizedSchema,
  esContent: LocalizedSchema.nullable(),
  validation: z
    .object({
      isValid: z.boolean(),
      score: z.number(),
      shareableSentence: z.string().nullish(),
    })
    .nullish(),
  /**
   * Quality Gate result written by the pipeline after reconcileValidation runs.
   * When present and passed=true, it is used as a secondary gate so that
   * style-only Validator errors that survived the repair loop (e.g. "banned-phrase")
   * do not permanently block publication after the human approver has already
   * reviewed and approved the draft.
   */
  qualityGate: z
    .object({ passed: z.boolean() })
    .passthrough()
    .nullish(),
});

const SourceBundleSchema = z.object({
  items: z
    .array(
      z
        .object({
          title: z.string(),
          url: z.string(),
          summary: z.string().optional(),
          outlet: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
});

// Minimal review schema — only the fields we gate on
const ReviewGateSchema = z.object({
  image: z.object({
    status: z.string(),
    // The asset path lives on the draft branch, not in the final storage bucket.
    assetPath: z.string().optional(),
    publicUrl: z.string().nullable().optional(),
  }),
  content: z.object({
    status: z.string(),
  }),
});

// ── Config helpers ────────────────────────────────────────────────────────────

function repoConfig() {
  const repo = process.env.GITHUB_REPO ?? "wbardawil/agentic_newsletter";
  const prefix = process.env.GITHUB_DRAFT_BRANCH_PREFIX ?? "drafts/";
  return { repo, prefix };
}

function branchFor(prefix: string, editionId: string): string {
  return `${prefix.replace(/\/+$/, "")}/${editionId}`;
}

function qaMinScore(): number {
  const raw = Number(process.env.QA_MIN_SCORE);
  return Number.isFinite(raw) ? raw : 65;
}

function skipReviewGate(): boolean {
  return process.env.SKIP_REVIEW_GATE === "true";
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Read, validate, review-gate, quality-gate, and mirror an approved edition
 * into Supabase. Throws PublishError on any failure.
 *
 * The hero image URL is read from `review.json` (`review.image.publicUrl`).
 * The caller does NOT need to pass it separately.
 */
export async function publishEdition(editionId: string): Promise<PublishResult> {
  const { repo, prefix } = repoConfig();
  const branch = branchFor(prefix, editionId);

  // ── 1. load draft JSON from the PR branch ──────────────────────────────────
  let draftRaw: unknown;
  try {
    draftRaw = await fetchDraftJson(repo, branch, `drafts/${editionId}-draft.json`);
  } catch (err) {
    if (err instanceof GitHubError && err.code === "NOT_FOUND") {
      throw new PublishError("NOT_FOUND", `No draft found for edition ${editionId} on branch ${branch}.`);
    }
    if (err instanceof GitHubError && err.code === "AUTH") {
      throw new PublishError("CONFIG", "GitHub auth failed — check GITHUB_TOKEN in the portal env.");
    }
    throw new PublishError("GITHUB", err instanceof Error ? err.message : "GitHub read failed.");
  }

  const parsed = DraftSchema.safeParse(draftRaw);
  if (!parsed.success) {
    throw new PublishError("INVALID_DRAFT", `Draft JSON for ${editionId} is malformed: ${parsed.error.message}`);
  }
  const draft = parsed.data;

  if (!draft.esContent) {
    throw new PublishError("INVALID_DRAFT", `Edition ${editionId} is missing the Spanish edition (esContent).`);
  }

  // ── 2. quality gate (mirror of publish-to-beehiiv.yml) ────────────────────
  const validation = draft.validation;
  const score = validation?.score ?? 0;
  const min = qaMinScore();
  const qgPassed = draft.qualityGate?.passed === true;

  // When the pipeline Quality Gate passed (qgPassed=true), use it as the
  // authoritative gate: trust score >= min over the isValid boolean.
  // Rationale: isValid can be false when the Validator flagged a style issue
  // (e.g. a "banned-phrase" that survived two LLM repair passes) but the QG
  // still cleared all factual claims and voice quality. reconcileValidation()
  // in run.ts normally flips isValid=true in this case, but if a future
  // whitelist gap prevents that, qgPassed provides a reliable fallback so a
  // human-approved draft is never silently blocked by a style false-positive.
  const effectiveIsValid = qgPassed ? score >= min : validation?.isValid === true;

  if (!validation || !effectiveIsValid || score < min) {
    throw new PublishError(
      "QUALITY_GATE",
      `Edition ${editionId} did not pass the quality gate (isValid=${validation?.isValid ?? "n/a"}, score=${score}, min=${min}, qgPassed=${qgPassed}).`,
    );
  }

  // ── 3. review gate — verify editorial double-approval ─────────────────────
  let heroImageUrl: string | null = null;

  if (!skipReviewGate()) {
    let reviewRaw: unknown;
    try {
      reviewRaw = await fetchDraftJson(repo, branch, `drafts/${editionId}-review.json`);
    } catch (err) {
      if (err instanceof GitHubError && err.code === "NOT_FOUND") {
        throw new PublishError(
          "QUALITY_GATE",
          `No review state found for edition ${editionId}. The draft must be reviewed and approved via the portal (/review) before publishing. Set SKIP_REVIEW_GATE=true to bypass during migration.`,
        );
      }
      throw new PublishError("GITHUB", `Failed to load review state: ${err instanceof Error ? err.message : String(err)}`);
    }

    const reviewParsed = ReviewGateSchema.safeParse(reviewRaw);
    if (!reviewParsed.success) {
      throw new PublishError(
        "QUALITY_GATE",
        `Review state for ${editionId} is malformed or incomplete. Cannot verify approvals.`,
      );
    }
    const review = reviewParsed.data;

    if (review.image.status !== "approved") {
      throw new PublishError(
        "QUALITY_GATE",
        `Image not approved for edition ${editionId} (current status: "${review.image.status}"). Approve the hero image via the digest email before publishing.`,
      );
    }
    if (review.content.status !== "approved") {
      throw new PublishError(
        "QUALITY_GATE",
        `Content not approved for edition ${editionId} (current status: "${review.content.status}"). Approve the article via the digest email before publishing.`,
      );
    }

    // If we have an asset path, we need to upload it and get the public URL.
    if (review.image.assetPath) {
      try {
        const asset = await fetchDraftAsset(repo, branch, review.image.assetPath);
        const storagePath = review.image.assetPath.replace(/^drafts\//, "");
        heroImageUrl = await uploadAsset(storagePath, asset.content, asset.contentType);
      } catch (err) {
        if (err instanceof GitHubError) {
          throw new PublishError("GITHUB", `Failed to fetch hero image asset: ${err.message}`);
        }
        // Could be a Supabase storage error
        throw new PublishError("DB", `Failed to upload hero image: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      // If there's no asset path, we can still use the publicUrl if it exists.
      heroImageUrl = review.image.publicUrl ?? null;
    }
  }

  // ── 4. optional sources snapshot (non-fatal if absent) ────────────────────
  let sources: MirrorInput["sources"];
  try {
    const bundleRaw = await fetchDraftJson(repo, branch, `drafts/${editionId}-sources.json`);
    sources = SourceBundleSchema.parse(bundleRaw).items;
  } catch {
    sources = undefined;
  }

  // ── 5. build rows + write to Supabase ──────────────────────────────────────
  const input: MirrorInput = {
    editionId,
    angle: draft.angle,
    enContent: draft.enContent,
    esContent: draft.esContent,
    shareableSentence: validation.shareableSentence ?? null,
    sources,
    publishedAt: new Date().toISOString(),
    isPublished: true,
    byline: process.env.NEWSLETTER_AUTHOR ?? null,
    heroImageUrl,
  };

  const supabase = getSupabaseAdminClient();
  const row = buildEditionRow(input);

  const { data, error } = await (supabase.from("editions") as any)
    .upsert(row, { onConflict: "edition_id" })
    .select("id")
    .single();
  if (error || !data) {
    throw new PublishError("DB", `editions upsert failed: ${error?.message ?? "no row returned"}`);
  }

  let sourcesMirrored = 0;
  if (sources && sources.length > 0) {
    const { error: delErr } = await supabase
      .from("edition_sources")
      .delete()
      .eq("edition_id", data.id);
    if (delErr) {
      throw new PublishError("DB", `edition_sources cleanup failed: ${delErr.message}`);
    }
    const srcRows = buildSourceRows(data.id, sources);
    const { error: insErr } = await (supabase.from("edition_sources") as any).insert(srcRows);
    if (insErr) {
      throw new PublishError("DB", `edition_sources insert failed: ${insErr.message}`);
    }
    sourcesMirrored = srcRows.length;
  }

  return { editionId, editionDbId: data.id, sourcesMirrored, qaScore: score, heroImageUrl };
}
