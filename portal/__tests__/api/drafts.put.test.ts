import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { GitHubError } from "@/lib/github";

const supabaseStub = {
  user: null as { email: string } | null,
};
const githubStub = {
  commit: vi.fn(),
  fetch: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: supabaseStub.user } }) },
  }),
}));

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  return {
    ...actual,
    fetchDraftFile: (...args: unknown[]) => githubStub.fetch(...args),
    commitDraftFile: (...args: unknown[]) => githubStub.commit(...args),
  };
});

// Dynamic import AFTER mocks are registered.
const routeModule = await import("@/app/api/admin/drafts/[edition]/route");
const { PUT } = routeModule;

const validSha = "a".repeat(40);
const params = () => Promise.resolve({ edition: "2026-21" });

function jsonRequest(body: unknown): Request {
  return new Request("http://test/api/admin/drafts/2026-21", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/admin/drafts/[edition]", () => {
  beforeEach(() => {
    supabaseStub.user = { email: "wadi@example.com" };
    process.env.ADMIN_EMAILS = "wadi@example.com,other@example.com";
    process.env.GITHUB_REPO = "wbardawil/agentic_newsletter";
    process.env.GITHUB_DRAFT_BRANCH_PREFIX = "drafts/";
    githubStub.commit.mockReset();
    githubStub.fetch.mockReset();
  });
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.GITHUB_REPO;
    delete process.env.GITHUB_DRAFT_BRANCH_PREFIX;
  });

  it("returns 401 when no user is signed in", async () => {
    supabaseStub.user = null;
    const res = await PUT(jsonRequest({ language: "en", content: "x", sha: validSha }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user email is not in ADMIN_EMAILS", async () => {
    supabaseStub.user = { email: "stranger@example.com" };
    const res = await PUT(jsonRequest({ language: "en", content: "x", sha: validSha }), { params: params() });
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid body (bad Zod parse)", async () => {
    const res = await PUT(
      jsonRequest({ language: "fr", content: "x", sha: validSha }),
      { params: params() },
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid edition param", async () => {
    const res = await PUT(
      jsonRequest({ language: "en", content: "x", sha: validSha }),
      { params: Promise.resolve({ edition: "not-an-edition" }) },
    );
    expect(res.status).toBe(422);
  });

  it("returns 409 with remoteSha on SHA_CONFLICT", async () => {
    githubStub.commit.mockRejectedValueOnce(
      new GitHubError(409, "SHA_CONFLICT", "stale", "b".repeat(40)),
    );
    const res = await PUT(
      jsonRequest({ language: "en", content: "x", sha: validSha }),
      { params: params() },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SHA_CONFLICT");
    expect(body.remoteSha).toBe("b".repeat(40));
  });

  it("returns 200 with newSha on happy path", async () => {
    githubStub.commit.mockResolvedValueOnce({
      newSha: "c".repeat(40),
      commitSha: "d".repeat(40),
      commitUrl: "https://github.com/x/y/commit/abc",
    });
    const res = await PUT(
      jsonRequest({ language: "en", content: "# updated", sha: validSha }),
      { params: params() },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.newSha).toBe("c".repeat(40));
    expect(body.commitUrl).toBe("https://github.com/x/y/commit/abc");
  });

  it("defaults the commit message to include the user email and edition", async () => {
    githubStub.commit.mockResolvedValueOnce({
      newSha: "c".repeat(40),
      commitSha: "d".repeat(40),
      commitUrl: "https://github.com/x/y/commit/abc",
    });
    await PUT(
      jsonRequest({ language: "es", content: "# updated", sha: validSha }),
      { params: params() },
    );
    expect(githubStub.commit).toHaveBeenCalled();
    const args = githubStub.commit.mock.calls[0];
    // commitDraftFile(repo, branch, path, content, sha, message)
    const message = args?.[5] as string;
    expect(message).toContain("2026-21-es");
    expect(message).toContain("wadi@example.com");
  });
});
