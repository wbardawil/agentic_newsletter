import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "../types/config.js";

export interface ApiClients {
  anthropic: Anthropic;
  /** Beehiiv API key — undefined if not configured (draft mode only). */
  beehiivApiKey: string | undefined;
  /** Beehiiv publication ID — undefined if not configured. */
  beehiivPublicationId: string | undefined;
  /** Display name for the newsletter author in Beehiiv post metadata. */
  newsletterAuthor: string;
  /** RSS parser per-feed timeout in milliseconds. */
  rssParserTimeoutMs: number;
  /** Hard cap on total USD spend per pipeline run (enforced in base-agent). */
  maxCostPerRunUsd: number;
  /** When true, skip all external writes (Beehiiv, social, Airtable). */
  dryRun: boolean;
  /** Feedly developer token — undefined if not configured. */
  feedlyApiKey: string | undefined;
  /** LinkedIn OAuth 2.0 access token. */
  linkedinAccessToken: string | undefined;
  /** Twitter API key (OAuth 1.0a consumer key). */
  twitterApiKey: string | undefined;
  /** Twitter API secret (OAuth 1.0a consumer secret). */
  twitterApiSecret: string | undefined;
  /** Twitter OAuth 1.0a user access token. */
  twitterAccessToken: string | undefined;
  /** Twitter OAuth 1.0a user access token secret. */
  twitterAccessSecret: string | undefined;
  /** Airtable personal access token. */
  airtableApiKey: string | undefined;
  /** Airtable base ID (e.g. "appXXXXXXXX"). */
  airtableBaseId: string | undefined;
}

export function createApiClients(config: AppConfig): ApiClients {
  return {
    // llmTimeoutMs is applied at the SDK client level — all requests inherit it
    anthropic: new Anthropic({
      apiKey: config.anthropicApiKey,
      timeout: config.llmTimeoutMs,
    }),
    beehiivApiKey: config.beehiivApiKey,
    beehiivPublicationId: config.beehiivPublicationId,
    newsletterAuthor: config.newsletterAuthor,
    rssParserTimeoutMs: config.rssParserTimeoutMs,
    maxCostPerRunUsd: config.maxCostPerRunUsd,
    dryRun: config.dryRun,
    feedlyApiKey: config.feedlyApiKey,
    linkedinAccessToken: config.linkedinAccessToken,
    twitterApiKey: config.twitterApiKey,
    twitterApiSecret: config.twitterApiSecret,
    twitterAccessToken: config.twitterAccessToken,
    twitterAccessSecret: config.twitterAccessSecret,
    airtableApiKey: config.airtableApiKey,
    airtableBaseId: config.airtableBaseId,
  };
}
