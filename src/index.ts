import "dotenv/config";
import { AppConfigSchema } from "./types/config.js";
import { createLogger } from "./utils/logger.js";

const config = AppConfigSchema.parse({
  anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
  beehiivApiKey: process.env["BEEHIIV_API_KEY"],
  beehiivPublicationId: process.env["BEEHIIV_PUBLICATION_ID"],
  feedlyApiKey: process.env["FEEDLY_API_KEY"],
  linkedinAccessToken: process.env["LINKEDIN_ACCESS_TOKEN"],
  twitterApiKey: process.env["TWITTER_API_KEY"],
  twitterApiSecret: process.env["TWITTER_API_SECRET"],
  airtableApiKey: process.env["AIRTABLE_API_KEY"],
  airtableBaseId: process.env["AIRTABLE_BASE_ID"],
  logLevel: process.env["LOG_LEVEL"],
  dryRun: process.env["DRY_RUN"] === "true",
  maxCostPerRunUsd: process.env["MAX_COST_PER_RUN_USD"]
    ? Number(process.env["MAX_COST_PER_RUN_USD"])
    : undefined,
});

const logger = createLogger(config.logLevel);
logger.info("Newsletter automation system starting");
