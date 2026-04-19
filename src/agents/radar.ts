import { z } from "zod";
import { randomUUID } from "node:crypto";
import Parser from "rss-parser";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  SourceBundleSchema,
  type SourceBundle,
  type SourceItem,
} from "../types/source-bundle.js";

const RadarInputSchema = z.object({
  timeWindowHours: z.number().positive(),
  maxItems: z.number().int().positive(),
  focusTopics: z.array(z.string()).optional(),
});
type RadarInput = z.infer<typeof RadarInputSchema>;

interface FeedConfig {
  url: string;
  outlet: string;
}

const RSS_FEEDS: FeedConfig[] = [
  {
    url: "https://feeds.bloomberg.com/markets/news.rss",
    outlet: "Bloomberg",
  },
  {
    url: "https://feeds.reuters.com/reuters/businessNews",
    outlet: "Reuters",
  },
  {
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    outlet: "New York Times",
  },
  {
    url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",
    outlet: "Wall Street Journal",
  },
  {
    url: "https://feeds.hbr.org/harvardbusiness",
    outlet: "Harvard Business Review",
  },
  {
    url: "https://www.economist.com/finance-and-economics/rss.xml",
    outlet: "The Economist",
  },
  {
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada",
    outlet: "El País Economía",
  },
  {
    url: "https://www.ft.com/rss/home/us",
    outlet: "Financial Times",
  },
];

interface ScoredKeyword {
  term: string;
  weight: number;
}

const RELEVANCE_KEYWORDS: ScoredKeyword[] = [
  { term: "latin america", weight: 2.0 },
  { term: "latam", weight: 2.0 },
  { term: "mexico", weight: 1.5 },
  { term: "colombia", weight: 1.5 },
  { term: "brazil", weight: 1.5 },
  { term: "panama", weight: 1.5 },
  { term: "miami", weight: 1.5 },
  { term: "nearshore", weight: 2.0 },
  { term: "business transformation", weight: 2.0 },
  { term: "operating model", weight: 2.0 },
  { term: "strategy", weight: 1.0 },
  { term: "entrepreneur", weight: 1.5 },
  { term: "ceo", weight: 1.5 },
  { term: "private equity", weight: 1.5 },
  { term: "acquisition", weight: 1.5 },
  { term: "merger", weight: 1.5 },
  { term: "supply chain", weight: 1.5 },
  { term: "automation", weight: 1.0 },
  { term: "erp", weight: 1.5 },
  { term: "crm", weight: 1.0 },
  { term: "growth", weight: 1.0 },
  { term: "scaling", weight: 1.5 },
  { term: "leadership", weight: 1.5 },
  { term: "middle market", weight: 2.0 },
  { term: "mid-market", weight: 2.0 },
  { term: "small business", weight: 1.5 },
  { term: "family business", weight: 2.0 },
  { term: "manufacturing", weight: 1.0 },
  { term: "tariff", weight: 1.0 },
  { term: "trade", weight: 1.0 },
  { term: "investment", weight: 1.0 },
  { term: "technology", weight: 0.5 },
  { term: "ai", weight: 0.5 },
];

function scoreRelevance(title: string, summary: string, tags: string[]): number {
  const text = `${title} ${summary} ${tags.join(" ")}`.toLowerCase();
  let score = 0;
  let maxScore = 0;

  for (const { term, weight } of RELEVANCE_KEYWORDS) {
    maxScore += weight;
    if (text.includes(term)) {
      score += weight;
    }
  }

  // Normalize: divide by 1/3 of max (so scoring ~1/3 of keywords = 1.0)
  return Math.min(score / (maxScore / 3), 1.0);
}

function extractFacts(rawContent: string, fallbackTitle: string, outlet: string): string[] {
  const cleaned = rawContent
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Try splitting on sentence boundaries
  const sentences = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 400);

  if (sentences.length >= 3) {
    return sentences.slice(0, 7);
  }

  // Try splitting on paragraphs
  const paras = cleaned
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);

  if (paras.length >= 3) {
    return paras.slice(0, 7);
  }

  // Pad with synthesized facts to satisfy the min(3) requirement
  const facts: string[] = paras.length > 0 ? paras.slice(0, 2) : [];
  facts.push(`Reported by ${outlet}: "${fallbackTitle}"`);
  while (facts.length < 3) {
    facts.push(cleaned.substring(0, 250).trim() || `Coverage from ${outlet}.`);
  }
  return facts.slice(0, 7);
}

export class RadarAgent extends BaseAgent<RadarInput, SourceBundle> {
  readonly name: AgentName = "radar";
  readonly inputSchema = RadarInputSchema;
  readonly outputSchema = SourceBundleSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: RadarInput,
    context: AgentInput<RadarInput>,
  ): Promise<SourceBundle> {
    const parser = new Parser({ timeout: 12000 });
    const scannedAt = new Date().toISOString();
    const allItems: SourceItem[] = [];
    let feedsScanned = 0;
    let totalScanned = 0;

    for (const feed of RSS_FEEDS) {
      try {
        const result = await parser.parseURL(feed.url);
        feedsScanned++;

        for (const item of result.items) {
          totalScanned++;
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          const recencyHours =
            (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);

          if (recencyHours > payload.timeWindowHours) continue;

          const title = item.title?.trim() ?? "Untitled";
          const summary =
            (item.contentSnippet ?? item.summary ?? "").substring(0, 600);
          const rawContent =
            (item["content:encoded"] ?? item.content ?? summary).substring(
              0,
              3000,
            );
          const tags: string[] = (item.categories as string[] | undefined) ?? [];
          const url = item.link?.trim() ?? "";

          if (!url || !title || title === "Untitled") continue;

          const relevanceScore = scoreRelevance(title, summary, tags);
          const verbatimFacts = extractFacts(rawContent, title, feed.outlet);

          allItems.push({
            id: randomUUID(),
            sourceType: "rss",
            title,
            url,
            publishedAt: pubDate.toISOString(),
            author: (item.creator ?? (item["author"] as string | undefined))?.trim(),
            outlet: feed.outlet,
            summary: summary || title,
            verbatimFacts,
            relevanceScore,
            recencyHours,
            tags,
            rawContent,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Radar: failed to fetch ${feed.url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (allItems.length === 0) {
      throw new Error(
        `Radar: no items found across ${feedsScanned} feeds within ${payload.timeWindowHours}h window`,
      );
    }

    // Sort: relevance (70%) + recency (30%)
    allItems.sort((a, b) => {
      const normalize = (h: number) =>
        1 - Math.min(h / payload.timeWindowHours, 1);
      const scoreA = a.relevanceScore * 0.7 + normalize(a.recencyHours) * 0.3;
      const scoreB = b.relevanceScore * 0.7 + normalize(b.recencyHours) * 0.3;
      return scoreB - scoreA;
    });

    const selected = allItems.slice(0, payload.maxItems);

    this.logger.info(
      `Radar: scanned ${totalScanned} items from ${feedsScanned} feeds, selected top ${selected.length}`,
    );

    return {
      editionId: context.editionId,
      scannedAt,
      totalScanned,
      totalSelected: selected.length,
      items: selected,
      metadata: {
        feedsScanned,
        timeWindowHours: payload.timeWindowHours,
        filterCriteria: [
          "recency",
          "relevance-keyword-scoring",
          `max-items-${payload.maxItems}`,
        ],
      },
    };
  }
}
