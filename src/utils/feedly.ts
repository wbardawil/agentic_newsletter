/**
 * Feedly API v3 client for fetching stream contents.
 *
 * Used by RadarAgent as a secondary source alongside direct RSS.
 * If the access token is missing or the call fails, Radar falls back
 * gracefully to RSS-only mode — Feedly is always additive, never required.
 */

export interface FeedlyItem {
  id: string;
  title?: string;
  summary?: { content?: string };
  content?: { content?: string };
  originId?: string;
  origin?: { title?: string };
  published?: number;
  canonical?: { href?: string }[];
  tags?: { label?: string }[];
}

interface FeedlyStreamResponse {
  items?: FeedlyItem[];
  continuation?: string;
}

interface FeedlyProfile {
  id?: string;
}

/**
 * Fetch the most recent items from the user's "All" Feedly stream.
 *
 * @param accessToken  Feedly developer/personal access token.
 * @param count        Max items to fetch (default 50).
 * @param newerThan    Epoch ms — only return items newer than this.
 */
export async function fetchFeedlyStream(
  accessToken: string,
  count = 50,
  newerThan?: number,
): Promise<FeedlyItem[]> {
  // 1. Resolve user profile to get the userId
  const profileRes = await fetch("https://cloud.feedly.com/v3/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    throw new Error(`Feedly profile fetch failed (${profileRes.status})`);
  }

  const profile = (await profileRes.json()) as FeedlyProfile;
  const userId = profile.id;
  if (!userId) {
    throw new Error("Feedly profile returned no user ID");
  }

  // 2. Fetch the global "All" stream
  const streamId = `user/${userId}/category/global.all`;
  const params = new URLSearchParams({
    streamId,
    count: String(count),
    ranked: "newest",
    unreadOnly: "false",
  });
  if (newerThan != null) {
    params.set("newerThan", String(newerThan));
  }

  const streamRes = await fetch(
    `https://cloud.feedly.com/v3/streams/contents?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!streamRes.ok) {
    throw new Error(`Feedly stream fetch failed (${streamRes.status})`);
  }

  const body = (await streamRes.json()) as FeedlyStreamResponse;
  return body.items ?? [];
}
