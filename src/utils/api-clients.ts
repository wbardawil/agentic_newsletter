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
}

export function createApiClients(config: AppConfig): ApiClients {
  return {
    anthropic: new Anthropic({ apiKey: config.anthropicApiKey }),
    beehiivApiKey: config.beehiivApiKey,
    beehiivPublicationId: config.beehiivPublicationId,
    newsletterAuthor: config.newsletterAuthor,
    rssParserTimeoutMs: config.rssParserTimeoutMs,
  };
}
