/**
 * GitHub Contents API helper — server-only.
 *
 * Used by the admin draft editor to read .md files from a `drafts/<edition>`
 * branch and commit edits back to that branch via the GitHub REST Contents API.
 * Git remains source of truth: the editor never touches Supabase rows directly.
 *
 * Token: a fine-grained PAT scoped to one repo with `Contents: read/write`.
 * Set as GITHUB_TOKEN in Vercel Production env only (NOT Preview).
 */

if (typeof window !== "undefined") {
  throw new Error("portal/lib/github.ts is server-only and must not be imported from client components.");
}

const GITHUB_API = "https://api.github.com";

export type GitHubErrorCode =
  | "NOT_FOUND"
  | "SHA_CONFLICT"
  | "AUTH"
  | "VALIDATION"
  | "UNKNOWN";

export class GitHubError extends Error {
  constructor(
    public status: number,
    public code: GitHubErrorCode,
    message: string,
    public remoteSha?: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface GitHubFile {
  content: string;
  sha: string;
  path: string;
  size: number;
}

export interface CommitResult {
  newSha: string;
  commitSha: string;
  commitUrl: string;
}

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new GitHubError(
      500,
      "AUTH",
      "GITHUB_TOKEN is not set in the portal environment. Configure a fine-grained PAT with Contents: read/write on the agentic_newsletter repo.",
    );
  }
  return token;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agentic-newsletter-portal",
  };
}

function decodeBase64(b64: string): string {
  const clean = b64.replace(/\n/g, "");
  return Buffer.from(clean, "base64").toString("utf-8");
}

function encodeBase64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

function mapStatus(status: number, body: string): GitHubError {
  if (status === 404) return new GitHubError(status, "NOT_FOUND", `GitHub 404: ${body.slice(0, 200)}`);
  if (status === 401 || status === 403) return new GitHubError(status, "AUTH", `GitHub auth failed (HTTP ${status}): ${body.slice(0, 200)}`);
  if (status === 422) return new GitHubError(status, "VALIDATION", `GitHub validation error: ${body.slice(0, 200)}`);
  return new GitHubError(status, "UNKNOWN", `GitHub error HTTP ${status}: ${body.slice(0, 200)}`);
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function fetchOnce(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(url, { ...init, cache: "no-store" });
}

export async function fetchDraftFile(
  repo: string,
  branch: string,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubFile> {
  const token = requireToken();
  const url = `${GITHUB_API}/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;
  const init: RequestInit = { method: "GET", headers: authHeaders(token) };

  let response = await fetchOnce(url, init, fetchImpl);
  // Single retry on transient 5xx / network only — never on 4xx.
  if (!response.ok && response.status >= 500) {
    await new Promise((r) => setTimeout(r, 500));
    response = await fetchOnce(url, init, fetchImpl);
  }
  if (!response.ok) {
    throw mapStatus(response.status, await readBody(response));
  }

  const data = (await response.json()) as {
    content?: string;
    sha?: string;
    path?: string;
    size?: number;
    encoding?: string;
  };
  if (!data.content || !data.sha) {
    throw new GitHubError(502, "UNKNOWN", "GitHub Contents API response missing content or sha");
  }
  return {
    content: decodeBase64(data.content),
    sha: data.sha,
    path: data.path ?? path,
    size: data.size ?? 0,
  };
}

/**
 * Fetch a JSON file from a draft branch and parse it.
 *
 * Used by the publish flow to read `drafts/<edition>-draft.json` and
 * `drafts/<edition>-sources.json` off the `drafts/<edition>` branch. Throws a
 * GitHubError (NOT_FOUND/AUTH/…) on transport failure, or a VALIDATION
 * GitHubError when the file is present but not valid JSON.
 */
export async function fetchDraftJson<T = unknown>(
  repo: string,
  branch: string,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const file = await fetchDraftFile(repo, branch, path, fetchImpl);
  try {
    return JSON.parse(file.content) as T;
  } catch {
    throw new GitHubError(422, "VALIDATION", `File ${path} on ${branch} is not valid JSON`);
  }
}

/**
 * Create or update a file on a draft branch.
 * If `sha` is null the file is created; if provided the file is updated.
 * Internally fetches the current SHA when `sha` is the sentinel "auto".
 */
export async function upsertDraftFile(
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CommitResult> {
  const token = requireToken();

  // Try to get current SHA (needed for update; omit for new file)
  let currentSha: string | undefined;
  try {
    const existing = await fetchDraftFile(repo, branch, path, fetchImpl);
    currentSha = existing.sha;
  } catch (err) {
    if (!(err instanceof GitHubError && err.code === "NOT_FOUND")) throw err;
    // File doesn't exist yet — create it
  }

  const url = `${GITHUB_API}/repos/${repo}/contents/${encodeURI(path)}`;
  const bodyObj: Record<string, string> = {
    message,
    content: encodeBase64(content),
    branch,
  };
  if (currentSha) bodyObj["sha"] = currentSha;

  const init: RequestInit = {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  };

  const response = await fetchOnce(url, init, fetchImpl);
  if (!response.ok) {
    throw mapStatus(response.status, await readBody(response));
  }

  const data = (await response.json()) as {
    content?: { sha?: string };
    commit?: { sha?: string; html_url?: string };
  };
  const newSha = data.content?.sha;
  const commitSha = data.commit?.sha;
  const commitUrl = data.commit?.html_url;
  if (!newSha || !commitSha || !commitUrl) {
    throw new GitHubError(502, "UNKNOWN", "GitHub commit response missing sha/commit fields");
  }
  return { newSha, commitSha, commitUrl };
}

/**
 * Dispatch a GitHub Actions workflow via the workflow_dispatch event.
 * Returns on success (HTTP 204), throws GitHubError on failure.
 */
export async function dispatchWorkflow(
  repo: string,
  workflow: string,
  ref: string,
  inputs?: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const token = requireToken();
  const url = `${GITHUB_API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  const body: Record<string, unknown> = { ref };
  if (inputs && Object.keys(inputs).length > 0) body["inputs"] = inputs;

  const response = await fetchOnce(
    url,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    fetchImpl,
  );

  if (!response.ok) {
    const text = await readBody(response);
    throw new GitHubError(
      response.status,
      response.status === 404 ? "NOT_FOUND" : response.status === 401 || response.status === 403 ? "AUTH" : "UNKNOWN",
      `Workflow dispatch failed for ${workflow} (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
  // 204 No Content on success
}

export async function commitDraftFile(
  repo: string,
  branch: string,
  path: string,
  content: string,
  sha: string,
  message: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CommitResult> {
  const token = requireToken();
  const url = `${GITHUB_API}/repos/${repo}/contents/${encodeURI(path)}`;
  const body = JSON.stringify({
    message,
    content: encodeBase64(content),
    sha,
    branch,
  });
  const init: RequestInit = {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body,
  };

  const response = await fetchOnce(url, init, fetchImpl);

  if (response.status === 409 || response.status === 422) {
    // SHA conflict — re-fetch to expose the current remote SHA so the client
    // can render a "Reload" affordance. 422 also fires when the SHA does not
    // match the current blob; treat both as conflict.
    let remoteSha: string | undefined;
    try {
      const current = await fetchDraftFile(repo, branch, path, fetchImpl);
      remoteSha = current.sha;
    } catch {
      // best-effort; if the second call fails we still surface a conflict
    }
    throw new GitHubError(
      409,
      "SHA_CONFLICT",
      `Branch moved: blob SHA does not match. ${remoteSha ? `Remote SHA is ${remoteSha}.` : ""}`,
      remoteSha,
    );
  }

  if (!response.ok) {
    throw mapStatus(response.status, await readBody(response));
  }

  const data = (await response.json()) as {
    content?: { sha?: string };
    commit?: { sha?: string; html_url?: string };
  };
  const newSha = data.content?.sha;
  const commitSha = data.commit?.sha;
  const commitUrl = data.commit?.html_url;
  if (!newSha || !commitSha || !commitUrl) {
    throw new GitHubError(502, "UNKNOWN", "GitHub commit response missing sha/commit fields");
  }
  return { newSha, commitSha, commitUrl };
}
