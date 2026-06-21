import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  LocalizedContentSchema,
  DistributionRecordSchema,
  type DistributionRecord,
} from "../types/edition.js";
import { renderLocalizedToMarkdown } from "../utils/edition-markdown.js";

const DistributorInputSchema = z.object({
  enContent: LocalizedContentSchema,
  esContent: LocalizedContentSchema,
  /** UTC datetime string for scheduled send, e.g. "2026-04-21T09:00:00Z" */
  scheduledAt: z.string().datetime().optional(),
});
type DistributorInput = z.infer<typeof DistributorInputSchema>;

const DistributorOutputSchema = z.array(DistributionRecordSchema);

// ── Beehiiv API client ────────────────────────────────────────────────────────

interface BeehiivPostBody {
  title: string;
  subtitle: string;
  content_tags: string[];
  authors: string[];
  send_at?: number;
  status: "draft" | "confirmed";
  displayed_date?: number;
  content?: { free?: { web?: string; email?: string } };
}

interface BeehiivCreateResponse {
  data?: { id?: string };
  errors?: string[];
}

function sanitizeBeehiivError(msg: string): string {
  return msg.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer ***");
}

async function createBeehiivPost(
  apiKey: string,
  publicationId: string,
  author: string,
  subject: string,
  preheader: string,
  body: string,
  idempotencyKey: string,
  scheduledAt?: string,
): Promise<string> {
  const url = `https://api.beehiiv.com/v2/publications/${publicationId}/posts`;

  let send_at: number | undefined;
  if (scheduledAt) {
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error(`Invalid scheduledAt timestamp: "${scheduledAt}"`);
    }
    send_at = Math.floor(scheduledDate.getTime() / 1000);
  }

  const postBody: BeehiivPostBody = {
    title: subject,
    subtitle: preheader,
    content_tags: ["transformation-letter"],
    authors: [author],
    status: send_at ? "confirmed" : "draft",
    content: { free: { web: body, email: body } },
  };

  if (send_at) {
    postBody.send_at = send_at;
    postBody.displayed_date = send_at;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(postBody),
  });

  // 409 Conflict means the idempotency key was already used — extract the existing post ID
  if (response.status === 409) {
    const data = (await response.json()) as BeehiivCreateResponse;
    const existingId = data.data?.id;
    if (existingId) return existingId;
    // Beehiiv doesn't always echo the original ID on 409 — treat as duplicate and skip
    throw new Error(`Beehiiv 409: duplicate post for idempotency key "${idempotencyKey}" — no post ID in response`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(sanitizeBeehiivError(`Beehiiv API error ${response.status}: ${errorText}`));
  }

  const data = (await response.json()) as BeehiivCreateResponse;
  if (!data.data?.id) {
    const details = data.errors?.join("; ") ?? "no id in response";
    throw new Error(`Beehiiv post created but no ID returned: ${details}`);
  }

  return data.data.id;
}

// ── Distributor agent ─────────────────────────────────────────────────────────

export class DistributorAgent extends BaseAgent<
  DistributorInput,
  DistributionRecord[]
> {
  readonly name: AgentName = "distributor";
  readonly inputSchema = DistributorInputSchema;
  readonly outputSchema = DistributorOutputSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: DistributorInput,
    context: AgentInput<DistributorInput>,
  ): Promise<DistributionRecord[]> {
    const { beehiivApiKey, beehiivPublicationId, newsletterAuthor, dryRun } =
      this.deps.apiClients;

    if (dryRun) {
      this.logger.info("Distributor: dry-run mode — skipping Beehiiv API calls", {
        runId: context.runId,
      });
      const now = new Date().toISOString();
      return [
        { platform: "beehiiv", distributedAt: now, status: "draft", externalId: "dry-run-en" },
        { platform: "beehiiv", distributedAt: now, status: "draft", externalId: "dry-run-es" },
      ];
    }

    if (!beehiivApiKey || !beehiivPublicationId) {
      throw new Error(
        "BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID must be set to distribute",
      );
    }

    const records: DistributionRecord[] = [];
    const now = new Date().toISOString();
    const scheduled = Boolean(payload.scheduledAt);

    // ── English edition ──────────────────────────────────────────────────────
    try {
      const enPostId = await createBeehiivPost(
        beehiivApiKey,
        beehiivPublicationId,
        newsletterAuthor,
        payload.enContent.subject,
        payload.enContent.preheader,
        renderLocalizedToMarkdown(payload.enContent),
        `${context.editionId}-en`,
        payload.scheduledAt,
      );

      this.logger.info("Beehiiv EN post created", {
        runId: context.runId,
        postId: enPostId,
      });

      records.push({
        platform: "beehiiv",
        distributedAt: now,
        externalId: enPostId,
        status: scheduled ? "scheduled" : "draft",
      });
    } catch (err) {
      records.push({
        platform: "beehiiv",
        distributedAt: now,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── Spanish edition ──────────────────────────────────────────────────────
    try {
      const esPostId = await createBeehiivPost(
        beehiivApiKey,
        beehiivPublicationId,
        newsletterAuthor,
        payload.esContent.subject,
        payload.esContent.preheader,
        renderLocalizedToMarkdown(payload.esContent),
        `${context.editionId}-es`,
        payload.scheduledAt,
      );

      this.logger.info("Beehiiv ES post created", {
        runId: context.runId,
        postId: esPostId,
      });

      records.push({
        platform: "beehiiv",
        distributedAt: now,
        externalId: esPostId,
        status: scheduled ? "scheduled" : "draft",
      });
    } catch (err) {
      records.push({
        platform: "beehiiv",
        distributedAt: now,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return records;
  }
}
