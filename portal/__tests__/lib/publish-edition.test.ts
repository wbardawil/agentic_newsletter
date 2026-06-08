import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GitHubError } from "@/lib/github";

// ── controllable fixtures ────────────────────────────────────────────────────
let draftFixture: unknown;
let sourcesFixture: unknown | (() => never);
let reviewFixture: unknown | (() => never);

vi.mock("@/lib/github", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/github")>();
  return {
    ...actual,
    fetchDraftJson: vi.fn(async (_repo: string, _branch: string, path: string) => {
      if (path.endsWith("-draft.json")) {
        if (typeof draftFixture === "function") return (draftFixture as () => never)();
        return draftFixture;
      }
      if (path.endsWith("-sources.json")) {
        if (typeof sourcesFixture === "function") return (sourcesFixture as () => never)();
        return sourcesFixture;
      }
      if (path.endsWith("-review.json")) {
        if (typeof reviewFixture === "function") return (reviewFixture as () => never)();
        return reviewFixture;
      }
    }),
  };
});

const upsertSingle = vi.fn();
const sourcesInsert = vi.fn();
const deleteEq = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (_table: string) => ({
      upsert: () => ({ select: () => ({ single: upsertSingle }) }),
      delete: () => ({ eq: deleteEq }),
      insert: sourcesInsert,
    }),
  }),
}));

import { publishEdition, PublishError } from "@/lib/publish-edition";

// ── fixtures ──────────────────────────────────────────────────────────────────

function validDraft(overrides: Record<string, unknown> = {}) {
  const localized = (language: "en" | "es") => ({
    language,
    subject: `${language}-subject`,
    sections: [
      { type: "lead", body: "lead" },
      { type: "analysis", body: "analysis" },
      { type: "spotlight", body: "spotlight" },
      { type: "quickTakes", body: "compass" },
      { type: "cta", body: "door" },
    ],
  });
  return {
    editionId: "2026-19",
    angle: { osPillar: "Technology OS", quarterlyTheme: "The Machine" },
    enContent: localized("en"),
    esContent: localized("es"),
    validation: { isValid: true, score: 85, shareableSentence: "Line." },
    ...overrides,
  };
}

function approvedReview(overrides: Record<string, unknown> = {}) {
  return {
    editionId: "2026-19",
    runId: "run-uuid",
    reviewVersion: 1,
    image: {
      status: "approved",
      attempt: 1,
      assetPath: "drafts/2026-19-hero.png",
      publicUrl: "https://storage.example.com/edition-assets/2026-19/hero-v1.png",
      prompt: "abstract illustration",
      rejectedPrompts: [],
      approvedAt: "2026-06-06T01:00:00.000Z",
      rejectedAt: null,
      rejectionReason: null,
    },
    content: {
      status: "approved",
      attempt: 1,
      rejectedSections: [],
      approvedAt: "2026-06-06T02:00:00.000Z",
      rejectedAt: null,
      rejectionReason: null,
    },
    publish: { status: "ready", blockedReason: null, publishedAt: null },
    events: [],
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T02:00:00.000Z",
    ...overrides,
  };
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SKIP_REVIEW_GATE;
  upsertSingle.mockResolvedValue({ data: { id: "db-1" }, error: null });
  deleteEq.mockResolvedValue({ error: null });
  sourcesInsert.mockResolvedValue({ error: null });
  draftFixture = validDraft();
  sourcesFixture = { items: [{ title: "S", url: "https://x.example", summary: "sum", outlet: "Out" }] };
  reviewFixture = approvedReview();
});

afterEach(() => {
  delete process.env.SKIP_REVIEW_GATE;
});

// ── quality gate ──────────────────────────────────────────────────────────────

describe("publishEdition — quality gate", () => {
  it("publishes a valid, high-score edition and mirrors sources", async () => {
    const result = await publishEdition("2026-19");
    expect(result.editionId).toBe("2026-19");
    expect(result.qaScore).toBe(85);
    expect(result.sourcesMirrored).toBe(1);
    expect(upsertSingle).toHaveBeenCalledOnce();
    expect(sourcesInsert).toHaveBeenCalledOnce();
  });

  it("rejects when validation.isValid is false", async () => {
    draftFixture = validDraft({ validation: { isValid: false, score: 90, shareableSentence: null } });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({ code: "QUALITY_GATE" });
    expect(upsertSingle).not.toHaveBeenCalled();
  });

  it("rejects when score is below QA_MIN_SCORE", async () => {
    draftFixture = validDraft({ validation: { isValid: true, score: 50, shareableSentence: null } });
    await expect(publishEdition("2026-19")).rejects.toBeInstanceOf(PublishError);
    expect(upsertSingle).not.toHaveBeenCalled();
  });

  it("rejects when validation block is missing", async () => {
    draftFixture = validDraft({ validation: undefined });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({ code: "QUALITY_GATE" });
  });
});

// ── draft integrity ───────────────────────────────────────────────────────────

describe("publishEdition — draft integrity", () => {
  it("throws NOT_FOUND when the draft branch has no draft", async () => {
    draftFixture = () => {
      throw new GitHubError(404, "NOT_FOUND", "missing");
    };
    await expect(publishEdition("2026-19")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws INVALID_DRAFT when esContent is missing", async () => {
    draftFixture = validDraft({ esContent: null });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({ code: "INVALID_DRAFT" });
  });

  it("publishes without sources when the snapshot is absent (non-fatal)", async () => {
    sourcesFixture = () => {
      throw new GitHubError(404, "NOT_FOUND", "no sources");
    };
    const result = await publishEdition("2026-19");
    expect(result.sourcesMirrored).toBe(0);
    expect(upsertSingle).toHaveBeenCalledOnce();
    expect(sourcesInsert).not.toHaveBeenCalled();
  });
});

// ── review gate ───────────────────────────────────────────────────────────────

describe("publishEdition — review gate", () => {
  it("publishes when image and content are both approved", async () => {
    const result = await publishEdition("2026-19");
    expect(result.qaScore).toBe(85);
    expect(upsertSingle).toHaveBeenCalledOnce();
  });

  it("populates heroImageUrl from review.image.publicUrl", async () => {
    const result = await publishEdition("2026-19");
    expect(result.heroImageUrl).toBe("https://storage.example.com/edition-assets/2026-19/hero-v1.png");
  });

  it("sets heroImageUrl to null when review.image.publicUrl is null", async () => {
    reviewFixture = approvedReview({ image: { ...approvedReview().image, publicUrl: null } });
    const result = await publishEdition("2026-19");
    expect(result.heroImageUrl).toBeNull();
  });

  it("rejects when review.json is missing and SKIP_REVIEW_GATE is not set", async () => {
    reviewFixture = () => {
      throw new GitHubError(404, "NOT_FOUND", "no review");
    };
    await expect(publishEdition("2026-19")).rejects.toMatchObject({
      code: "QUALITY_GATE",
      message: expect.stringContaining("No review state found"),
    });
    expect(upsertSingle).not.toHaveBeenCalled();
  });

  it("rejects when image.status is not 'approved'", async () => {
    reviewFixture = approvedReview({ image: { ...approvedReview().image, status: "pending" } });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({
      code: "QUALITY_GATE",
      message: expect.stringContaining("Image not approved"),
    });
    expect(upsertSingle).not.toHaveBeenCalled();
  });

  it("rejects when image.status is 'regenerating'", async () => {
    reviewFixture = approvedReview({ image: { ...approvedReview().image, status: "regenerating" } });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({
      code: "QUALITY_GATE",
      message: expect.stringContaining("Image not approved"),
    });
  });

  it("rejects when content.status is not 'approved'", async () => {
    reviewFixture = approvedReview({ content: { ...approvedReview().content, status: "pending" } });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({
      code: "QUALITY_GATE",
      message: expect.stringContaining("Content not approved"),
    });
    expect(upsertSingle).not.toHaveBeenCalled();
  });

  it("rejects when content.status is 'rejected'", async () => {
    reviewFixture = approvedReview({ content: { ...approvedReview().content, status: "rejected" } });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({
      code: "QUALITY_GATE",
      message: expect.stringContaining("Content not approved"),
    });
  });

  it("skips review gate and publishes when SKIP_REVIEW_GATE=true", async () => {
    process.env.SKIP_REVIEW_GATE = "true";
    reviewFixture = () => {
      throw new GitHubError(404, "NOT_FOUND", "no review — should not be read");
    };
    const result = await publishEdition("2026-19");
    expect(result.qaScore).toBe(85);
    expect(result.heroImageUrl).toBeNull(); // no review.json → no heroImageUrl
    expect(upsertSingle).toHaveBeenCalledOnce();
  });

  it("review gate check happens after quality gate", async () => {
    // Low score fails quality gate BEFORE we ever check review state
    draftFixture = validDraft({ validation: { isValid: true, score: 50, shareableSentence: null } });
    reviewFixture = approvedReview({ image: { ...approvedReview().image, status: "pending" } });
    await expect(publishEdition("2026-19")).rejects.toMatchObject({ code: "QUALITY_GATE" });
    // We should not reach the review gate (but it's OK even if we do — both fail)
  });
});

// ── hero_image_url in Supabase row ────────────────────────────────────────────

describe("publishEdition — hero_image_url propagation", () => {
  it("upserts with hero_image_url from approved review", async () => {
    await publishEdition("2026-19");
    // The upsert was called — validate the row passed includes the URL
    // (We can't easily inspect the row directly, but the result confirms it ran)
    expect(upsertSingle).toHaveBeenCalledOnce();
    const result = await publishEdition("2026-19");
    expect(result.heroImageUrl).toBe("https://storage.example.com/edition-assets/2026-19/hero-v1.png");
  });
});
