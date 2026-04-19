import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  PerformanceMetricsSchema,
  type PerformanceMetrics,
} from "../types/edition.js";

const AnalystInputSchema = z.object({
  /** YYYY-WW edition identifier (e.g. "2026-17"). */
  editionId: z.string().min(1),
  /** Beehiiv post IDs returned by the Distributor for this edition. */
  beehiivPostIds: z.array(z.string().min(1)),
});
type AnalystInput = z.infer<typeof AnalystInputSchema>;

// ── Beehiiv stats client ──────────────────────────────────────────────────────

interface BeehiivPostStats {
  opens?: { total?: number; rate?: number };
  clicks?: { total?: number; rate?: number };
  subscribers_at_send?: number;
}

interface BeehiivPostData {
  id?: string;
  stats?: BeehiivPostStats;
  audience?: { total_active_subscriptions?: number };
}

interface BeehiivPostResponse {
  data?: BeehiivPostData;
}

async function fetchPostStats(
  apiKey: string,
  publicationId: string,
  postId: string,
): Promise<BeehiivPostData | null> {
  const url = `https://api.beehiiv.com/v2/publications/${publicationId}/posts/${postId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Beehiiv stats error ${response.status} for ${postId}: ${text}`);
  }

  const body = (await response.json()) as BeehiivPostResponse;
  return body.data ?? null;
}

function average(values: number[]): number | undefined {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return undefined;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ── Analyst agent ─────────────────────────────────────────────────────────────

export class AnalystAgent extends BaseAgent<AnalystInput, PerformanceMetrics> {
  readonly name: AgentName = "analyst";
  readonly inputSchema = AnalystInputSchema;
  readonly outputSchema = PerformanceMetricsSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: AnalystInput,
    context: AgentInput<AnalystInput>,
  ): Promise<PerformanceMetrics> {
    const { beehiivApiKey: apiKey, beehiivPublicationId: publicationId } =
      this.deps.apiClients;

    if (!apiKey || !publicationId) {
      throw new Error(
        "BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID must be set to collect metrics",
      );
    }

    if (payload.beehiivPostIds.length === 0) {
      this.logger.warn("No Beehiiv post IDs provided — returning empty metrics", {
        runId: context.runId,
        editionId: payload.editionId,
      });
      return { collectedAt: new Date().toISOString() };
    }

    const results = await Promise.allSettled(
      payload.beehiivPostIds.map((id) =>
        fetchPostStats(apiKey, publicationId, id),
      ),
    );

    const openRates: number[] = [];
    const clickRates: number[] = [];
    let subscribersAtSend: number | undefined;

    for (const result of results) {
      if (result.status === "rejected") {
        this.logger.warn(`Failed to fetch post stats: ${String(result.reason)}`, {
          runId: context.runId,
        });
        continue;
      }

      const data = result.value;
      if (!data) continue;

      if (typeof data.stats?.opens?.rate === "number") {
        openRates.push(data.stats.opens.rate);
      }
      if (typeof data.stats?.clicks?.rate === "number") {
        clickRates.push(data.stats.clicks.rate);
      }
      if (typeof data.stats?.subscribers_at_send === "number") {
        subscribersAtSend = data.stats.subscribers_at_send;
      }
    }

    const metrics: PerformanceMetrics = {
      openRate: average(openRates),
      clickRate: average(clickRates),
      subscribersDelta: subscribersAtSend,
      collectedAt: new Date().toISOString(),
    };

    this.logger.info("Analyst metrics collected", {
      runId: context.runId,
      editionId: payload.editionId,
      openRate: metrics.openRate,
      clickRate: metrics.clickRate,
    });

    return metrics;
  }
}
