/**
 * Social post publishing for LinkedIn and Twitter/X.
 *
 * LinkedIn: Uses UGC Posts API v2 with OAuth 2.0 Bearer token.
 * Twitter:  Uses API v2 with OAuth 1.0a user context (required for posting).
 */

import { createHmac, randomBytes } from "node:crypto";

// ── LinkedIn ──────────────────────────────────────────────────────────────────

export interface LinkedInPostResult {
  postId: string;
  url: string;
}

/**
 * Publish a text post to LinkedIn via the UGC Posts API.
 * Requires the `w_member_social` scope on the access token.
 */
export async function postToLinkedIn(
  accessToken: string,
  text: string,
): Promise<LinkedInPostResult> {
  // Step 1: Get the member's LinkedIn URN
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    const err = await profileRes.text();
    throw new Error(`LinkedIn profile fetch failed (${profileRes.status}): ${err.slice(0, 200)}`);
  }
  const profile = (await profileRes.json()) as { sub?: string };
  const authorUrn = `urn:li:person:${profile.sub ?? ""}`;

  // Step 2: Create the UGC post
  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`LinkedIn post failed (${postRes.status}): ${err.slice(0, 200)}`);
  }

  const postId = postRes.headers.get("x-restli-id") ?? "unknown";
  return { postId, url: `https://www.linkedin.com/feed/update/${postId}/` };
}

// ── Twitter / X ───────────────────────────────────────────────────────────────

export interface TwitterPostResult {
  tweetId: string;
  url: string;
}

function pct(s: string): string {
  return encodeURIComponent(s);
}

/** Build OAuth 1.0a Authorization header for a Twitter API request. */
function buildOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string,
): string {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = String(Math.floor(Date.now() / 1000));

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // Signature base string: method + "&" + encoded URL + "&" + encoded params
  const sortedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join("&");

  const baseString = `${method}&${pct(url)}&${pct(sortedParams)}`;
  const signingKey = `${pct(apiSecret)}&${pct(accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  oauthParams["oauth_signature"] = signature;
  const headerValue = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .join(", ");

  return `OAuth ${headerValue}`;
}

/**
 * Post a tweet via Twitter API v2.
 * Requires all four OAuth 1.0a credentials.
 */
export async function postToTwitter(
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string,
  text: string,
): Promise<TwitterPostResult> {
  const url = "https://api.twitter.com/2/tweets";
  const authHeader = buildOAuthHeader("POST", url, apiKey, apiSecret, accessToken, accessSecret);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Twitter post failed (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as { data?: { id?: string } };
  const tweetId = data.data?.id ?? "unknown";
  return { tweetId, url: `https://twitter.com/i/web/status/${tweetId}` };
}
