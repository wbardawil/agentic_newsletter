import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "../types/config.js";

export interface ApiClients {
  anthropic: Anthropic;
}

export function createApiClients(config: AppConfig): ApiClients {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  return { anthropic };
}
