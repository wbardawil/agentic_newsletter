import { createLogger } from "../../src/utils/logger.js";
import { createCostTracker } from "../../src/utils/cost-tracker.js";
import type { AgentDeps } from "../../src/agents/base-agent.js";

/** Returns a minimal AgentDeps object suitable for unit tests. */
export function makeDeps(): AgentDeps {
  return {
    logger: createLogger("error"),
    costTracker: createCostTracker(),
    apiClients: {
      anthropic: {} as never,
      beehiivApiKey: undefined,
      beehiivPublicationId: undefined,
      newsletterAuthor: "Test Author",
      rssParserTimeoutMs: 5000,
    },
  };
}
