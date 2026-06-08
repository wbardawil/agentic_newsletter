/**
 * GitHub Issues API helper — used to create human-intervention alerts when
 * regeneration attempt limits are exceeded.
 *
 * Requires GITHUB_TOKEN (fine-grained PAT or Actions token) and
 * GITHUB_REPOSITORY (owner/repo format).
 */

interface GitHubIssuePayload {
  title: string;
  body: string;
  labels?: string[];
}

interface GitHubIssueResponse {
  number: number;
  html_url: string;
}

interface GitHubIssueListItem {
  number: number;
  title: string;
  state: string;
  html_url: string;
}

function githubApi(path: string): string {
  return `https://api.github.com/repos/${path}`;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agentic-newsletter-pipeline",
    "Content-Type": "application/json",
  };
}

/**
 * Create a GitHub issue, or reopen and update it if one with the same title
 * already exists (open or closed). Prevents duplicate spam on repeated failures.
 *
 * Non-fatal: logs a warning if the API call fails rather than throwing.
 */
export async function createOrUpdateIssue(
  repo: string,
  payload: GitHubIssuePayload,
  token: string,
): Promise<{ number: number; url: string } | null> {
  try {
    // Search for existing issue with same title
    const searchUrl = githubApi(
      `${repo}/issues?state=all&per_page=20&labels=${encodeURIComponent((payload.labels ?? []).join(","))}`,
    );
    const searchResp = await fetch(searchUrl, {
      headers: authHeaders(token),
    });

    if (searchResp.ok) {
      const existing = (await searchResp.json()) as GitHubIssueListItem[];
      const match = existing.find((i) => i.title === payload.title);
      if (match) {
        // Reopen if closed + update body
        const updateUrl = githubApi(`${repo}/issues/${match.number}`);
        await fetch(updateUrl, {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ state: "open", body: payload.body }),
        });
        return { number: match.number, url: match.html_url };
      }
    }

    // Create new issue
    const createUrl = githubApi(`${repo}/issues`);
    const createResp = await fetch(createUrl, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      console.warn(`[github-issues] Failed to create issue (HTTP ${createResp.status}): ${text.slice(0, 200)}`);
      return null;
    }

    const created = (await createResp.json()) as GitHubIssueResponse;
    return { number: created.number, url: created.html_url };
  } catch (err) {
    console.warn(`[github-issues] Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Create a human-intervention issue when image regeneration attempts are exhausted.
 */
export async function createImageRegenLimitIssue(
  repo: string,
  token: string,
  editionId: string,
  attempt: number,
  maxAttempts: number,
): Promise<void> {
  const result = await createOrUpdateIssue(
    repo,
    {
      title: `🖼️ Image regen limit reached — Edition ${editionId}`,
      body: [
        `The image regeneration cycle for edition **${editionId}** has reached the maximum of **${maxAttempts} attempts** (current: attempt ${attempt}).`,
        ``,
        `**Action required:** A human editor must intervene to either:`,
        `1. Manually approve one of the existing image versions via the portal review flow.`,
        `2. Edit \`drafts/${editionId}-review.json\` to reset \`image.status\` to \`"pending"\` and \`image.attempt\` to \`1\` if a fresh start is needed.`,
        `3. Close this issue once resolved.`,
        ``,
        `**Draft branch:** \`drafts/${editionId}\``,
        `**Timestamp:** ${new Date().toISOString()}`,
      ].join("\n"),
      labels: ["editorial", "needs-human", "image-regen"],
    },
    token,
  );

  if (result) {
    console.warn(`[regen-limit] Image regen limit reached for ${editionId}. Issue created: ${result.url}`);
  } else {
    console.warn(`[regen-limit] Image regen limit reached for ${editionId}. Could not create GitHub issue — check GITHUB_TOKEN.`);
  }
}

/**
 * Create a human-intervention issue when content regeneration attempts are exhausted.
 */
export async function createContentRegenLimitIssue(
  repo: string,
  token: string,
  editionId: string,
  attempt: number,
  maxAttempts: number,
): Promise<void> {
  const result = await createOrUpdateIssue(
    repo,
    {
      title: `📝 Content regen limit reached — Edition ${editionId}`,
      body: [
        `The content regeneration cycle for edition **${editionId}** has reached the maximum of **${maxAttempts} attempts** (current: attempt ${attempt}).`,
        ``,
        `**Action required:** A human editor must intervene to either:`,
        `1. Manually edit the draft files in the \`drafts/${editionId}\` branch.`,
        `2. Delete \`drafts/${editionId}-rejection.json\` and reset the review state to allow a fresh start.`,
        `3. Close this issue once resolved.`,
        ``,
        `**Draft branch:** \`drafts/${editionId}\``,
        `**Timestamp:** ${new Date().toISOString()}`,
      ].join("\n"),
      labels: ["editorial", "needs-human", "content-regen"],
    },
    token,
  );

  if (result) {
    console.warn(`[regen-limit] Content regen limit reached for ${editionId}. Issue created: ${result.url}`);
  } else {
    console.warn(`[regen-limit] Content regen limit reached for ${editionId}. Could not create GitHub issue — check GITHUB_TOKEN.`);
  }
}
