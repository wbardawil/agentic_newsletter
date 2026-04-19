import { z } from "zod";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  LocalizedContentSchema,
  DistributionRecordSchema,
  type DistributionRecord,
  type LocalizedContent,
} from "../types/edition.js";

const DistributorInputSchema = z.object({
  enContent: LocalizedContentSchema,
  esContent: LocalizedContentSchema,
  /** UTC datetime string for scheduled send, e.g. "2026-04-21T09:00:00Z" */
  scheduledAt: z.string().datetime().optional(),
});
type DistributorInput = z.infer<typeof DistributorInputSchema>;

const DistributorOutputSchema = z.array(DistributionRecordSchema);

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderToMarkdown(content: LocalizedContent): string {
  const get = (type: string) =>
    content.sections.find((s: { type: string }) => s.type === type)?.body ?? "";

  const headings: Record<string, string> = {
    lead: content.language === "es" ? "LA APERTURA" : "THE APERTURA",
    analysis: content.language === "es" ? "EL INSIGHT" : "THE INSIGHT",
    spotlight: content.language === "es" ? "EL REPORTE DE CAMPO" : "THE FIELD REPORT",
    quickTakes: content.language === "es" ? "LA BRÚJULA" : "THE COMPASS",
    cta: content.language === "es" ? "LA PUERTA" : "THE DOOR",
  };

  return [
    `## ${headings["lead"]}`,
    "",
    get("lead"),
    "",
    "---",
    "",
    `## ${headings["analysis"]}`,
    "",
    get("analysis"),
    "",
    "---",
    "",
    `## ${headings["spotlight"]}`,
    "",
    get("spotlight"),
    "",
    "---",
    "",
    `## ${headings["quickTakes"]}`,
    "",
    get("quickTakes"),
    "",
    "---",
    "",
    `## ${headings["cta"]}`,
    "",
    get("cta"),
  ].join("\n");
}

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

async function createBeehiivPost(
  apiKey: string,
  publicationId: string,
  author: string,
  subject: string,
  preheader: string,
  body: string,
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
    },
    body: JSON.stringify(postBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Beehiiv API error ${response.status}: ${errorText}`);
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
    const { beehiivApiKey, beehiivPublicationId, newsletterAuthor } =
      this.deps.apiClients;

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
        renderToMarkdown(payload.enContent),
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
        renderToMarkdown(payload.esContent),
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
