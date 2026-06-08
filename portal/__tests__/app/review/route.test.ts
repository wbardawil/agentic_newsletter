import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (must come before vi.mock calls) ────────────────────────────

const {
  mockLoadReview,
  mockSaveReview,
  mockSaveRejectionFeedback,
  mockApplyDecision,
  mockPublishEdition,
  mockDispatchWorkflow,
} = vi.hoisted(() => ({
  mockLoadReview: vi.fn(),
  mockSaveReview: vi.fn(),
  mockSaveRejectionFeedback: vi.fn(),
  mockApplyDecision: vi.fn(),
  mockPublishEdition: vi.fn(),
  mockDispatchWorkflow: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/review-state", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/review-state")>();
  return {
    ...actual,
    loadReview: mockLoadReview,
    saveReview: mockSaveReview,
    saveRejectionFeedback: mockSaveRejectionFeedback,
    applyDecision: mockApplyDecision,
  };
});

vi.mock("@/lib/publish-edition", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/publish-edition")>();
  return {
    ...actual,
    publishEdition: mockPublishEdition,
  };
});

vi.mock("@/lib/github", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/github")>();
  return {
    ...actual,
    dispatchWorkflow: mockDispatchWorkflow,
  };
});

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { GET } from "@/app/review/route";
import { ReviewStateError } from "@/lib/review-state";
import { PublishError } from "@/lib/publish-edition";
import { GitHubError } from "@/lib/github";
import { signReviewToken } from "@/lib/approval-token";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECRET = "test-secret-review-endpoint-sprint3";
const EDITION = "2026-21";

function makeRequest(token: string): Request {
  return new Request(`http://localhost/review?t=${encodeURIComponent(token)}`);
}

function signToken(
  decision: Parameters<typeof signReviewToken>[0]["decision"],
  extra?: { sectionType?: string },
) {
  return signReviewToken(
    { editionId: EDITION, decision, nowSeconds: Math.floor(Date.now() / 1000), ...extra },
    SECRET,
  );
}

function baseReviewState() {
  return {
    editionId: EDITION,
    runId: "run-uuid",
    reviewVersion: 1,
    image: {
      status: "pending" as const,
      attempt: 1,
      assetPath: "drafts/2026-21-hero.png",
      publicUrl: "https://storage.example.com/hero-v1.png",
      prompt: "An abstract scaffolding illustration...",
      rejectedPrompts: [] as string[],
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    content: {
      status: "pending" as const,
      attempt: 1,
      rejectedSections: [] as Array<{ sectionType: string; reason?: string }>,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    publish: { status: "blocked" as const, blockedReason: "image_pending", publishedAt: null },
    events: [] as Array<{ timestamp: string; decision: string }>,
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
  };
}

function approvedImageState() {
  return {
    ...baseReviewState(),
    image: {
      ...baseReviewState().image,
      status: "approved" as const,
      approvedAt: "2026-06-06T01:00:00.000Z",
    },
    publish: { status: "blocked" as const, blockedReason: "content_pending", publishedAt: null },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APPROVAL_SIGNING_SECRET = SECRET;
  process.env.GITHUB_REPO = "owner/repo";
  process.env.GITHUB_MAIN_BRANCH = "main";

  mockLoadReview.mockResolvedValue({ state: baseReviewState(), sha: "abc123" });
  mockApplyDecision.mockImplementation((state: ReturnType<typeof baseReviewState>) => state);
  mockSaveReview.mockResolvedValue(undefined);
  mockSaveRejectionFeedback.mockResolvedValue(undefined);
  mockDispatchWorkflow.mockResolvedValue(undefined);
  mockPublishEdition.mockResolvedValue({
    editionId: EDITION,
    editionDbId: "db-1",
    sourcesMirrored: 2,
    qaScore: 85,
  });
});

// ── Configuration / auth ──────────────────────────────────────────────────────

describe("review route — configuration", () => {
  it("returns 500 when APPROVAL_SIGNING_SECRET is missing", async () => {
    delete process.env.APPROVAL_SIGNING_SECRET;
    const response = await GET(makeRequest("any-token"));
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("Review gate not configured");
  });

  it("returns 400 when no token is provided", async () => {
    const response = await GET(new Request("http://localhost/review"));
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Missing token");
  });

  it("returns 401 when token is invalid", async () => {
    const response = await GET(makeRequest("not.a.valid.token"));
    expect(response.status).toBe(401);
    expect(await response.text()).toContain("Invalid or expired link");
  });

  it("returns 401 when token is signed with wrong secret", async () => {
    const token = signReviewToken({ editionId: EDITION, decision: "image_approve" }, "wrong-secret");
    const response = await GET(makeRequest(token));
    expect(response.status).toBe(401);
  });

  it("returns 404 when review.json does not exist", async () => {
    mockLoadReview.mockResolvedValue(null);
    const response = await GET(makeRequest(signToken("image_approve")));
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Review state not found");
  });

  it("returns HTML Content-Type", async () => {
    const response = await GET(makeRequest(signToken("image_approve")));
    expect(response.headers.get("Content-Type")).toContain("text/html");
  });
});

// ── image_approve ─────────────────────────────────────────────────────────────

describe("image_approve", () => {
  it("returns 200 with success message", async () => {
    const approved = { ...baseReviewState(), image: { ...baseReviewState().image, status: "approved" as const } };
    mockApplyDecision.mockReturnValue(approved);

    const response = await GET(makeRequest(signToken("image_approve")));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Imagen aprobada");
  });

  it("saves updated review state", async () => {
    const response = await GET(makeRequest(signToken("image_approve")));
    expect(response.status).toBe(200);
    expect(mockSaveReview).toHaveBeenCalledOnce();
  });

  it("does NOT dispatch any workflow", async () => {
    await GET(makeRequest(signToken("image_approve")));
    expect(mockDispatchWorkflow).not.toHaveBeenCalled();
  });

  it("does NOT call publishEdition", async () => {
    await GET(makeRequest(signToken("image_approve")));
    expect(mockPublishEdition).not.toHaveBeenCalled();
  });

  it("calls applyDecision with the loaded state and 'image_approve'", async () => {
    await GET(makeRequest(signToken("image_approve")));
    expect(mockApplyDecision).toHaveBeenCalledWith(
      baseReviewState(),
      "image_approve",
      expect.objectContaining({ sectionType: undefined }),
    );
  });
});

// ── image_reject ──────────────────────────────────────────────────────────────

describe("image_reject", () => {
  it("returns 200 and dispatches regenerate-image.yml", async () => {
    const regen = { ...baseReviewState(), image: { ...baseReviewState().image, status: "regenerating" as const } };
    mockApplyDecision.mockReturnValue(regen);

    const response = await GET(makeRequest(signToken("image_reject")));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("regenerando");
    expect(mockDispatchWorkflow).toHaveBeenCalledWith(
      "owner/repo",
      "regenerate-image.yml",
      "main",
      expect.objectContaining({ edition: EDITION }),
    );
  });

  it("still returns 200 when regenerate-image.yml does not exist (non-fatal)", async () => {
    mockDispatchWorkflow.mockRejectedValue(new GitHubError(404, "NOT_FOUND", "workflow not found"));
    const regen = { ...baseReviewState(), image: { ...baseReviewState().image, status: "regenerating" as const } };
    mockApplyDecision.mockReturnValue(regen);

    const response = await GET(makeRequest(signToken("image_reject")));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("pendiente");
  });

  it("saves review state before dispatching workflow", async () => {
    const callOrder: string[] = [];
    mockSaveReview.mockImplementation(() => { callOrder.push("save"); return Promise.resolve(); });
    mockDispatchWorkflow.mockImplementation(() => { callOrder.push("dispatch"); return Promise.resolve(); });

    await GET(makeRequest(signToken("image_reject")));
    expect(callOrder[0]).toBe("save");
    expect(callOrder[1]).toBe("dispatch");
  });
});

// ── content_approve ───────────────────────────────────────────────────────────

describe("content_approve", () => {
  beforeEach(() => {
    mockLoadReview.mockResolvedValue({ state: approvedImageState(), sha: "sha-approved" });
    const approvedContent = {
      ...approvedImageState(),
      content: { ...approvedImageState().content, status: "approved" as const },
      publish: { status: "ready" as const, blockedReason: null, publishedAt: null },
    };
    mockApplyDecision.mockReturnValue(approvedContent);
  });

  it("returns 200 and publishes to Supabase", async () => {
    const response = await GET(makeRequest(signToken("content_approve")));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("publicada");
  });

  it("calls publishEdition with editionId only (heroImageUrl read internally)", async () => {
    await GET(makeRequest(signToken("content_approve")));
    expect(mockPublishEdition).toHaveBeenCalledWith(EDITION);
  });

  it("does NOT dispatch any workflow", async () => {
    await GET(makeRequest(signToken("content_approve")));
    expect(mockDispatchWorkflow).not.toHaveBeenCalled();
  });

  it("returns 422 when publishEdition throws QUALITY_GATE", async () => {
    mockPublishEdition.mockRejectedValue(new PublishError("QUALITY_GATE", "Score too low."));
    const response = await GET(makeRequest(signToken("content_approve")));
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("Quality gate");
  });

  it("returns 422 IMAGE_REQUIRED when applyDecision blocks (image not approved)", async () => {
    mockLoadReview.mockResolvedValue({ state: baseReviewState(), sha: "sha-pending" });
    mockApplyDecision.mockImplementation(() => {
      throw new ReviewStateError("IMAGE_REQUIRED", "Image not approved.");
    });
    const response = await GET(makeRequest(signToken("content_approve")));
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("Image approval required first");
    expect(mockPublishEdition).not.toHaveBeenCalled();
  });
});

// ── content_reject ────────────────────────────────────────────────────────────

describe("content_reject", () => {
  it("returns 200 and dispatches weekly-draft.yml", async () => {
    const rejected = { ...baseReviewState(), content: { ...baseReviewState().content, status: "rejected" as const } };
    mockApplyDecision.mockReturnValue(rejected);

    const response = await GET(makeRequest(signToken("content_reject")));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("nuevo draft");
    expect(mockSaveRejectionFeedback).toHaveBeenCalledWith(EDITION, "content_reject", undefined, undefined);
    expect(mockDispatchWorkflow).toHaveBeenCalledWith("owner/repo", "weekly-draft.yml", "main", { edition: EDITION });
  });

  it("does NOT call publishEdition", async () => {
    await GET(makeRequest(signToken("content_reject")));
    expect(mockPublishEdition).not.toHaveBeenCalled();
  });

  it("returns 200 with 'pendiente' when dispatch fails", async () => {
    mockDispatchWorkflow.mockRejectedValue(new Error("network error"));
    const rejected = { ...baseReviewState(), content: { ...baseReviewState().content, status: "rejected" as const } };
    mockApplyDecision.mockReturnValue(rejected);

    const response = await GET(makeRequest(signToken("content_reject")));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("pendiente");
  });
});

// ── section_reject ────────────────────────────────────────────────────────────

describe("section_reject", () => {
  it("returns 200 and dispatches weekly-draft.yml with edition id", async () => {
    const rejected = {
      ...baseReviewState(),
      content: { ...baseReviewState().content, status: "rejected" as const, rejectedSections: [{ sectionType: "analysis" }] },
    };
    mockApplyDecision.mockReturnValue(rejected);

    const token = signToken("section_reject", { sectionType: "analysis" });
    const response = await GET(makeRequest(token));

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("analysis");
    expect(mockSaveRejectionFeedback).toHaveBeenCalledWith(EDITION, "section_reject", undefined, [{ sectionType: "analysis" }]);
    expect(mockDispatchWorkflow).toHaveBeenCalledWith("owner/repo", "weekly-draft.yml", "main", { edition: EDITION });
  });

  it("calls applyDecision with sectionType from token", async () => {
    const token = signToken("section_reject", { sectionType: "spotlight" });
    await GET(makeRequest(token));
    expect(mockApplyDecision).toHaveBeenCalledWith(
      expect.anything(),
      "section_reject",
      expect.objectContaining({ sectionType: "spotlight" }),
    );
  });
});

// ── error handling ────────────────────────────────────────────────────────────

describe("review route — error handling", () => {
  it("returns 502 when loadReview throws unexpectedly", async () => {
    mockLoadReview.mockRejectedValue(new Error("GitHub connection refused"));
    const response = await GET(makeRequest(signToken("image_approve")));
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("Could not load review state");
  });

  it("returns 502 when saveReview fails after decision", async () => {
    mockApplyDecision.mockReturnValue(baseReviewState());
    mockSaveReview.mockRejectedValue(new Error("GitHub write failed"));
    const response = await GET(makeRequest(signToken("image_approve")));
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("Could not save review state");
  });

  it("returns 422 for unknown ReviewStateError codes", async () => {
    mockApplyDecision.mockImplementation(() => {
      throw new ReviewStateError("INVALID_TRANSITION", "Invalid transition.");
    });
    const response = await GET(makeRequest(signToken("image_approve")));
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("Invalid action");
  });
});
