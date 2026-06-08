import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fetchDraftFile,
  commitDraftFile,
  GitHubError,
} from "@/lib/github";

const REPO = "wbardawil/agentic_newsletter";
const BRANCH = "drafts/2026-21";
const PATH = "drafts/2026-21-en.md";

function b64(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

interface CapturedCall {
  url: string;
  init: RequestInit | undefined;
}

function makeFetch(responses: Response[]): { fetch: typeof fetch; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  let i = 0;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: typeof url === "string" ? url : url.toString(), init });
    const r = responses[i++];
    if (!r) throw new Error(`No more mocked responses (call ${i})`);
    return r;
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

describe("fetchDraftFile", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it("decodes base64 content, strips newlines, and returns sha", async () => {
    const raw = "# Hello\n\nworld";
    const b64WithNewlines = b64(raw).match(/.{1,60}/g)!.join("\n");
    const { fetch, calls } = makeFetch([
      jsonResponse(200, { content: b64WithNewlines, sha: "a".repeat(40), path: PATH, size: raw.length }),
    ]);
    const file = await fetchDraftFile(REPO, BRANCH, PATH, fetch);
    expect(file.content).toBe(raw);
    expect(file.sha).toBe("a".repeat(40));
    expect(calls[0]?.url).toBe(
      `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`,
    );
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("throws GitHubError(NOT_FOUND) on 404", async () => {
    const { fetch } = makeFetch([textResponse(404, "Not Found")]);
    await expect(fetchDraftFile(REPO, BRANCH, PATH, fetch)).rejects.toMatchObject({
      name: "GitHubError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("throws GitHubError(AUTH) on 401 and 403", async () => {
    const { fetch: f1 } = makeFetch([textResponse(401, "Bad credentials")]);
    await expect(fetchDraftFile(REPO, BRANCH, PATH, f1)).rejects.toMatchObject({
      code: "AUTH",
    });
    const { fetch: f2 } = makeFetch([textResponse(403, "Forbidden")]);
    await expect(fetchDraftFile(REPO, BRANCH, PATH, f2)).rejects.toMatchObject({
      code: "AUTH",
    });
  });

  it("retries once on 5xx and succeeds on retry", async () => {
    const raw = "# ok";
    const { fetch, calls } = makeFetch([
      textResponse(500, "server error"),
      jsonResponse(200, { content: b64(raw), sha: "b".repeat(40), path: PATH, size: 4 }),
    ]);
    const file = await fetchDraftFile(REPO, BRANCH, PATH, fetch);
    expect(file.content).toBe(raw);
    expect(calls).toHaveLength(2);
  });

  it("throws AUTH error when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const { fetch } = makeFetch([]);
    await expect(fetchDraftFile(REPO, BRANCH, PATH, fetch)).rejects.toMatchObject({
      code: "AUTH",
    });
  });
});

describe("commitDraftFile", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it("PUTs base64-encoded content with sha and branch", async () => {
    const newContent = "# Updated";
    const { fetch, calls } = makeFetch([
      jsonResponse(200, {
        content: { sha: "c".repeat(40) },
        commit: { sha: "d".repeat(40), html_url: "https://github.com/x/y/commit/abc" },
      }),
    ]);
    const result = await commitDraftFile(
      REPO,
      BRANCH,
      PATH,
      newContent,
      "a".repeat(40),
      "edit(2026-21-en): test",
      fetch,
    );
    expect(result.newSha).toBe("c".repeat(40));
    expect(result.commitUrl).toContain("github.com");
    expect(calls[0]?.init?.method).toBe("PUT");
    const body = JSON.parse(calls[0]?.init?.body as string);
    expect(body.message).toBe("edit(2026-21-en): test");
    expect(body.sha).toBe("a".repeat(40));
    expect(body.branch).toBe(BRANCH);
    expect(Buffer.from(body.content, "base64").toString("utf-8")).toBe(newContent);
  });

  it("throws SHA_CONFLICT on 409 and exposes remoteSha", async () => {
    const remoteContent = "# remote";
    const { fetch } = makeFetch([
      textResponse(409, "Conflict"),
      // Second call is the re-fetch to discover remoteSha
      jsonResponse(200, { content: b64(remoteContent), sha: "f".repeat(40), path: PATH, size: 8 }),
    ]);
    await expect(
      commitDraftFile(REPO, BRANCH, PATH, "new", "a".repeat(40), "msg", fetch),
    ).rejects.toMatchObject({
      code: "SHA_CONFLICT",
      remoteSha: "f".repeat(40),
    });
  });

  it("throws SHA_CONFLICT on 422 (stale sha) and exposes remoteSha", async () => {
    const remoteContent = "# remote";
    const { fetch } = makeFetch([
      textResponse(422, "sha didn't match"),
      jsonResponse(200, { content: b64(remoteContent), sha: "9".repeat(40), path: PATH, size: 8 }),
    ]);
    await expect(
      commitDraftFile(REPO, BRANCH, PATH, "new", "a".repeat(40), "msg", fetch),
    ).rejects.toMatchObject({
      code: "SHA_CONFLICT",
      remoteSha: "9".repeat(40),
    });
  });

  it("does NOT retry writes on 5xx", async () => {
    const { fetch, calls } = makeFetch([textResponse(500, "boom")]);
    await expect(
      commitDraftFile(REPO, BRANCH, PATH, "new", "a".repeat(40), "msg", fetch),
    ).rejects.toBeInstanceOf(GitHubError);
    expect(calls).toHaveLength(1);
  });

  it("throws NOT_FOUND if branch missing", async () => {
    const { fetch } = makeFetch([textResponse(404, "branch not found")]);
    await expect(
      commitDraftFile(REPO, BRANCH, PATH, "new", "a".repeat(40), "msg", fetch),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
