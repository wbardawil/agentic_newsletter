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
  send_at?: number; // Unix timestamp
  status: "draft" | "confirmed";
  displayed_date?: number;
  web_subtitle?: string;
  meta_title?: string;
  meta_default_description?: string;
  content?: {
    free?: { web?: string; email?: string };
  };
}

async function createBeehiivDraft(
  apiKey: string,
  publicationId: string,
  subject: string,
  preheader: string,
  body: string,
  scheduledAt?: string,
): Promise<string> {
  const url = `https://api.beehiiv.com/v2/publications/${publicationId}/posts`;

  const postBody: BeehiivPostBody = {
    title: subject,
    subtitle: preheader,
    content_tags: ["transformation-letter"],
    authors: ["Wadi Bardawil"],
    status: scheduledAt ? "confirmed" : "draft",
    content: {
      free: {
        web: body,
        email: body,
      },
    },
  };

  if (scheduledAt) {
    postBody.send_at = Math.floor(new Date(scheduledAt).getTime() / 1000);
    postBody.displayed_date = postBody.send_at;
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

  const data = (await response.json()) as { data?: { id?: string } };
  const postId = data.data?.id;
  if (!postId) throw new Error("Beehiiv response missing post ID");
  return postId;
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
    const apiKey = process.env["BEEHIIV_API_KEY"];
    const publicationId = process.env["BEEHIIV_PUBLICATION_ID"];

    if (!apiKey || !publicationId) {
      throw new Error(
        "BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID must be set to distribute",
      );
    }

    const records: DistributionRecord[] = [];
    const now = new Date().toISOString();

    // ── English edition ──────────────────────────────────────────────────────
    try {
      const enBody = renderToMarkdown(payload.enContent);
      const enPostId = await createBeehiivDraft(
        apiKey,
        publicationId,
        payload.enContent.subject,
        payload.enContent.preheader,
        enBody,
        payload.scheduledAt,
      );

      this.logger.info("Beehiiv EN draft created", {
        runId: context.runId,
        postId: enPostId,
      });

      records.push({
        platform: "beehiiv",
        distributedAt: now,
        externalId: enPostId,
        status: payload.scheduledAt ? "scheduled" : "sent",
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
      const esBody = renderToMarkdown(payload.esContent);
      const esPostId = await createBeehiivDraft(
        apiKey,
        publicationId,
        payload.esContent.subject,
        payload.esContent.preheader,
        esBody,
        payload.scheduledAt,
      );

      this.logger.info("Beehiiv ES draft created", {
        runId: context.runId,
        postId: esPostId,
      });

      records.push({
        platform: "beehiiv",
        distributedAt: now,
        externalId: esPostId,
        status: payload.scheduledAt ? "scheduled" : "sent",
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
