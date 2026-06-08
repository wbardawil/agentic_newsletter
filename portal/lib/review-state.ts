/**
 * Review state management for the editorial approval gate — server-only.
 *
 * Persists review.json on the `drafts/<editionId>` GitHub branch as the
 * source of truth for image and content approval status.
 *
 * Types mirror `src/types/review.ts` (portal deploys standalone and cannot
 * import from the pipeline's `src/` tree).
 */

import { z } from "zod";
import { fetchDraftFile, upsertDraftFile, GitHubError } from "@/lib/github";

if (typeof window !== "undefined") {
  throw new Error("portal/lib/review-state.ts is server-only and must not be imported from client components.");
}

// ── Types (mirror of src/types/review.ts) ────────────────────────────────────

const ImageStatusSchema = z.enum(["pending", "approved", "rejected", "regenerating", "failed"]);
export type ImageStatus = z.infer<typeof ImageStatusSchema>;

const ContentStatusSchema = z.enum(["pending", "approved", "rejected", "regenerating", "failed"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

const PublishStatusSchema = z.enum(["blocked", "ready", "published", "failed"]);

export const ReviewDecisionSchema = z.enum([
  "image_approve",
  "image_reject",
  "content_approve",
  "content_reject",
  "section_reject",
]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

const ReviewEventSchema = z.object({
  timestamp: z.string(),
  decision: ReviewDecisionSchema,
  reason: z.string().optional(),
  sectionType: z.string().optional(),
});

const RejectedSectionSchema = z.object({
  sectionType: z.string(),
  reason: z.string().optional(),
});

const ImageReviewSchema = z.object({
  status: ImageStatusSchema,
  attempt: z.number().int().positive(),
  assetPath: z.string().nullable(),
  publicUrl: z.string().nullable(),
  prompt: z.string().nullable(),
  rejectedPrompts: z.array(z.string()),
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});

const ContentReviewSchema = z.object({
  status: ContentStatusSchema,
  attempt: z.number().int().positive(),
  rejectedSections: z.array(RejectedSectionSchema),
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});

export const ReviewStateSchema = z.object({
  editionId: z.string(),
  runId: z.string(),
  reviewVersion: z.number().int().positive(),
  image: ImageReviewSchema,
  content: ContentReviewSchema,
  publish: z.object({
    status: PublishStatusSchema,
    blockedReason: z.string().nullable(),
    publishedAt: z.string().nullable(),
  }),
  events: z.array(ReviewEventSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReviewState = z.infer<typeof ReviewStateSchema>;

// ── Error class ───────────────────────────────────────────────────────────────

export class ReviewStateError extends Error {
  constructor(
    public code: "INVALID_TRANSITION" | "IMAGE_REQUIRED" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "ReviewStateError";
  }
}

// ── Config helpers ────────────────────────────────────────────────────────────

function repoConfig() {
  const repo = process.env.GITHUB_REPO ?? "wbardawil/agentic_newsletter";
  const prefix = process.env.GITHUB_DRAFT_BRANCH_PREFIX ?? "drafts/";
  return { repo, prefix };
}

function branchFor(prefix: string, editionId: string): string {
  return `${prefix.replace(/\/+$/, "")}/${editionId}`;
}

// ── GitHub persistence ────────────────────────────────────────────────────────

export interface LoadedReview {
  state: ReviewState;
  sha: string;
}

/**
 * Load review.json from the draft branch on GitHub.
 * Returns null if the file does not exist (edition not yet generated).
 */
export async function loadReview(editionId: string): Promise<LoadedReview | null> {
  const { repo, prefix } = repoConfig();
  const branch = branchFor(prefix, editionId);
  const path = `drafts/${editionId}-review.json`;

  let file;
  try {
    file = await fetchDraftFile(repo, branch, path);
  } catch (err) {
    if (err instanceof GitHubError && err.code === "NOT_FOUND") return null;
    throw err;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(file.content);
  } catch {
    throw new ReviewStateError("NOT_FOUND", `Review file for ${editionId} is not valid JSON`);
  }

  const parsed = ReviewStateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ReviewStateError(
      "NOT_FOUND",
      `Review state for ${editionId} is malformed: ${parsed.error.message}`,
    );
  }

  return { state: parsed.data, sha: file.sha };
}

/**
 * Save review.json back to the draft branch on GitHub.
 * Uses upsertDraftFile so it creates the file if it doesn't exist.
 */
export async function saveReview(
  editionId: string,
  state: ReviewState,
  commitMessage?: string,
): Promise<void> {
  const { repo, prefix } = repoConfig();
  const branch = branchFor(prefix, editionId);
  const path = `drafts/${editionId}-review.json`;

  const updated: ReviewState = { ...state, updatedAt: new Date().toISOString() };
  const content = JSON.stringify(updated, null, 2);
  const message =
    commitMessage ??
    `chore(review): ${editionId} → image=${state.image.status} content=${state.content.status}`;

  await upsertDraftFile(repo, branch, path, content, message);
}

/**
 * Write the rejection feedback file so the next pipeline run can read it.
 * Path: `drafts/<editionId>-rejection.json`
 */
export async function saveRejectionFeedback(
  editionId: string,
  type: "content_reject" | "section_reject",
  reason?: string,
  sections?: Array<{ sectionType: string; reason?: string }>,
): Promise<void> {
  const { repo, prefix } = repoConfig();
  const branch = branchFor(prefix, editionId);
  const path = `drafts/${editionId}-rejection.json`;

  const payload = {
    editionId,
    type,
    reason: reason ?? null,
    sections: sections ?? [],
    createdAt: new Date().toISOString(),
  };

  await upsertDraftFile(
    repo,
    branch,
    path,
    JSON.stringify(payload, null, 2),
    `chore(review): rejection feedback for ${editionId}`,
  );
}

// ── State machine ─────────────────────────────────────────────────────────────

/**
 * Apply a review decision to a ReviewState (pure function).
 *
 * Validates the transition and throws ReviewStateError on invalid states.
 * Returns the updated state.
 */
export function applyDecision(
  review: ReviewState,
  decision: ReviewDecision,
  extra?: { sectionType?: string; reason?: string },
): ReviewState {
  const now = new Date().toISOString();
  const event = {
    timestamp: now,
    decision,
    ...(extra?.reason ? { reason: extra.reason } : {}),
    ...(extra?.sectionType ? { sectionType: extra.sectionType } : {}),
  };

  switch (decision) {
    case "image_approve": {
      // Idempotent: already approved → return as-is (no duplicate event)
      if (review.image.status === "approved") return review;
      return {
        ...review,
        image: {
          ...review.image,
          status: "approved",
          approvedAt: now,
        },
        publish: {
          ...review.publish,
          status: "blocked",
          blockedReason: "content_pending",
        },
        events: [...review.events, event],
        updatedAt: now,
      };
    }

    case "image_reject": {
      const prevPrompt = review.image.prompt;
      return {
        ...review,
        image: {
          ...review.image,
          status: "regenerating",
          rejectedAt: now,
          rejectionReason: extra?.reason ?? null,
          rejectedPrompts: prevPrompt
            ? [...review.image.rejectedPrompts, prevPrompt]
            : review.image.rejectedPrompts,
        },
        publish: {
          ...review.publish,
          status: "blocked",
          blockedReason: "image_rejected",
        },
        events: [...review.events, event],
        updatedAt: now,
      };
    }

    case "content_approve": {
      if (review.image.status !== "approved") {
        throw new ReviewStateError(
          "IMAGE_REQUIRED",
          `Cannot approve content before the image is approved. Image status is "${review.image.status}" — approve the image first.`,
        );
      }
      // Idempotent: already approved → return as-is
      if (review.content.status === "approved") return review;
      return {
        ...review,
        content: {
          ...review.content,
          status: "approved",
          approvedAt: now,
        },
        publish: {
          ...review.publish,
          status: "ready",
          blockedReason: null,
        },
        events: [...review.events, event],
        updatedAt: now,
      };
    }

    case "content_reject": {
      return {
        ...review,
        content: {
          ...review.content,
          status: "rejected",
          rejectedAt: now,
          rejectionReason: extra?.reason ?? null,
          attempt: review.content.attempt + 1,
        },
        // Always reset image when content is rejected — new content needs new image
        image: {
          ...review.image,
          status: "pending",
          approvedAt: null,
        },
        publish: {
          ...review.publish,
          status: "blocked",
          blockedReason: "content_rejected",
        },
        events: [...review.events, event],
        updatedAt: now,
      };
    }

    case "section_reject": {
      if (!extra?.sectionType) {
        throw new ReviewStateError(
          "INVALID_TRANSITION",
          "sectionType is required for section_reject decisions",
        );
      }
      const existingIdx = review.content.rejectedSections.findIndex(
        (s) => s.sectionType === extra.sectionType,
      );
      const rejectedSections =
        existingIdx >= 0
          ? review.content.rejectedSections.map((s, i) =>
              i === existingIdx ? { ...s, reason: extra.reason } : s,
            )
          : [...review.content.rejectedSections, { sectionType: extra.sectionType, reason: extra.reason }];

      return {
        ...review,
        content: {
          ...review.content,
          status: "rejected",
          rejectedAt: now,
          rejectedSections,
          attempt: review.content.attempt + 1,
        },
        // Always reset image when content is rejected
        image: {
          ...review.image,
          status: "pending",
          approvedAt: null,
        },
        publish: {
          ...review.publish,
          status: "blocked",
          blockedReason: "section_rejected",
        },
        events: [...review.events, event],
        updatedAt: now,
      };
    }
  }
}
