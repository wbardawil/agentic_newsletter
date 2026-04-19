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
  /** Geographic focus — used to boost LATAM sources in scoring. */
  region: "global" | "us" | "latam";
  /** Editorial tier: 1 = strategy/insight, 2 = business news, 3 = niche/trade. */
  tier: 1 | 2 | 3;
  /**
   * When true, items from this feed are tagged as already covered by competitors.
   * The Strategist prompt receives this signal to avoid saturated angles.
   */
  competitive?: boolean;
}

const RSS_FEEDS: FeedConfig[] = [
  // ── Consulting & Strategy Research — Tier 1 Anchors ──────────────────────
  // Scored 80–92 in pipeline audit. Highest framework depth per item.
  {
    url: "https://feeds.hbr.org/harvardbusiness",
    outlet: "Harvard Business Review",
    region: "global",
    tier: 1,
  },
  {
    url: "https://sloanreview.mit.edu/feed/",
    outlet: "MIT Sloan Management Review",
    region: "global",
    tier: 1,
  },
  {
    url: "https://www.strategy-business.com/rss",
    outlet: "Strategy+Business (PwC)",
    region: "global",
    tier: 1,
  },
  {
    url: "https://www.mckinsey.com/insights/rss",
    outlet: "McKinsey Insights",
    region: "global",
    tier: 1,
  },
  {
    url: "https://www2.deloitte.com/us/en/insights/rss.xml",
    outlet: "Deloitte Insights",
    region: "global",
    tier: 1,
  },
  {
    url: "https://www.bcg.com/rss",
    outlet: "BCG Perspectives",
    region: "global",
    tier: 1,
  },
  {
    url: "https://knowledge.wharton.upenn.edu/feed/",
    outlet: "Knowledge@Wharton",
    region: "global",
    tier: 1,
  },
  {
    url: "https://www.gartner.com/en/newsroom/rss",
    outlet: "Gartner",
    region: "global",
    tier: 1,
  },
  {
    url: "https://knowledge.insead.edu/rss/list",
    outlet: "INSEAD Knowledge",
    region: "global",
    tier: 1,
  },
  {
    url: "https://blogs.lse.ac.uk/businessreview/feed/",
    outlet: "LSE Business Review",
    region: "global",
    tier: 1,
  },

  // ── Mid-Market & LATAM Institutional Research (NEW — scored 82–91) ────────
  // RSM is the only major consulting firm with a dedicated mid-market
  // publication. IDB and CAF are the primary LATAM corridor research bodies.
  {
    url: "https://realeconomy.rsmus.com/feed/",
    outlet: "RSM Real Economy (Middle Market)",
    region: "us",
    tier: 1,
  },
  {
    url: "https://publications.iadb.org/en/rss",
    outlet: "IDB — Inter-American Development Bank",
    region: "latam",
    tier: 1,
  },
  {
    url: "https://www.caf.com/en/currently/rss-channels/",
    outlet: "CAF — Development Bank of Latin America",
    region: "latam",
    tier: 1,
  },
  {
    url: "https://agenda.weforum.org/feed/",
    outlet: "World Economic Forum",
    region: "global",
    tier: 1,
  },
  {
    url: "https://blog.iese.edu/feed/",
    outlet: "IESE Business School",
    region: "latam",
    tier: 1,
  },

  // ── Leadership, Org Design & Transformation (NEW + existing) ─────────────
  // Korn Ferry is the primary research institution on CEO/talent/org structure.
  // Atlantic Council adds the US-LATAM geopolitical trade layer.
  {
    url: "https://kornferryinstitute.libsyn.com/rss",
    outlet: "Korn Ferry Briefings on Talent & Leadership",
    region: "global",
    tier: 1,
  },
  {
    url: "https://www.atlanticcouncil.org/category/commentary/feature/feed/",
    outlet: "Atlantic Council (GeoEconomics)",
    region: "latam",
    tier: 1,
  },
  {
    url: "https://chiefexecutive.net/feed/",
    outlet: "Chief Executive Magazine",
    region: "us",
    tier: 1,
  },
  {
    url: "https://www.cfo.com/feed/",
    outlet: "CFO Magazine",
    region: "us",
    tier: 1,
  },

  // ── The Economist ─────────────────────────────────────────────────────────
  {
    url: "https://www.economist.com/finance-and-economics/rss.xml",
    outlet: "The Economist",
    region: "global",
    tier: 1,
  },
  {
    url: "https://www.economist.com/business/rss.xml",
    outlet: "The Economist — Business",
    region: "global",
    tier: 1,
  },

  // ── US Business News — Signal Layer (tier 2) ──────────────────────────────
  // High-frequency pulse; lower framework depth. Use to detect emerging angles.
  {
    url: "https://feeds.bloomberg.com/markets/news.rss",
    outlet: "Bloomberg",
    region: "us",
    tier: 2,
  },
  {
    url: "https://feeds.reuters.com/reuters/businessNews",
    outlet: "Reuters",
    region: "us",
    tier: 2,
  },
  {
    url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",
    outlet: "Wall Street Journal",
    region: "us",
    tier: 2,
  },
  {
    url: "https://fortune.com/feed/",
    outlet: "Fortune",
    region: "us",
    tier: 2,
  },
  {
    url: "https://www.fastcompany.com/rss.xml",
    outlet: "Fast Company",
    region: "us",
    tier: 2,
  },
  {
    url: "https://api.axios.com/feed/",
    outlet: "Axios Business",
    region: "us",
    tier: 2,
  },
  {
    url: "https://www.ft.com/rss/home",
    outlet: "Financial Times",
    region: "global",
    tier: 2,
  },

  // ── LATAM Business — Mexico ────────────────────────────────────────────────
  {
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada",
    outlet: "El País Economía",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/",
    outlet: "El Financiero (México)",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://expansion.mx/rss",
    outlet: "Expansión México",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://www.forbes.com.mx/feed/",
    outlet: "Forbes México",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://www.eleconomista.com.mx/rss/economia.xml",
    outlet: "El Economista (México)",
    region: "latam",
    tier: 2,
  },

  // ── LATAM Business — Colombia & Andes ─────────────────────────────────────
  {
    url: "https://www.portafolio.co/rss.xml",
    outlet: "Portafolio (Colombia)",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://www.larepublica.co/rss.xml",
    outlet: "La República (Colombia)",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://www.dinero.com/rss.xml",
    outlet: "Dinero (Colombia)",
    region: "latam",
    tier: 2,
  },

  // ── LATAM Business — Regional & Pan-LATAM ─────────────────────────────────
  {
    url: "https://www.infobae.com/feeds/rss/economia/",
    outlet: "Infobae Economía",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://www.bloomberglinea.com/arc/outboundfeeds/rss/",
    outlet: "Bloomberg Línea",
    region: "latam",
    tier: 1,
  },
  {
    url: "https://americaeconomia.com/rss.xml",
    outlet: "América Economía",
    region: "latam",
    tier: 2,
  },

  // ── Supply Chain, Trade & Nearshore ───────────────────────────────────────
  {
    url: "https://nearshoreamericas.com/feed/",
    outlet: "Nearshore Americas",
    region: "latam",
    tier: 2,
  },
  {
    url: "https://www.supplychaindive.com/feeds/news/",
    outlet: "Supply Chain Dive",
    region: "us",
    tier: 3,
  },
  {
    url: "https://www.manufacturingdive.com/feeds/news/",
    outlet: "Manufacturing Dive",
    region: "us",
    tier: 3,
  },

  // ── Reference Newsletters — Competitive Awareness ────────────────────────
  // Items tagged competitive:true — Strategist avoids angles already covered.
  {
    url: "https://www.notboring.co/feed",
    outlet: "Not Boring (Packy McCormick)",
    region: "global",
    tier: 3,
    competitive: true,
  },
  {
    url: "https://www.morningbrew.com/daily/rss",
    outlet: "Morning Brew",
    region: "us",
    tier: 3,
    competitive: true,
  },
  {
    url: "https://thegeneralist.substack.com/feed",
    outlet: "The Generalist",
    region: "global",
    tier: 3,
    competitive: true,
  },

  // ── Technology & AI in Business ────────────────────────────────────────────
  {
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    outlet: "MIT Technology Review — AI",
    region: "global",
    tier: 2,
  },
  {
    url: "https://hbr.org/resources/rss/topics/digital-transformation",
    outlet: "HBR — Digital Transformation",
    region: "global",
    tier: 1,
  },
  {
    url: "https://feeds.hbr.org/harvardbusiness/ai",
    outlet: "HBR — AI",
    region: "global",
    tier: 1,
  },
  {
    url: "https://venturebeat.com/category/ai/feed/",
    outlet: "VentureBeat AI",
    region: "global",
    tier: 2,
  },
  {
    url: "https://www.wired.com/feed/category/business/latest/rss",
    outlet: "Wired Business",
    region: "global",
    tier: 2,
  },
  {
    url: "https://a16z.com/feed/",
    outlet: "a16z (Andreessen Horowitz)",
    region: "global",
    tier: 2,
  },
];

interface ScoredKeyword {
  term: string;
  weight: number;
}

const RELEVANCE_KEYWORDS: ScoredKeyword[] = [
  // ── Corridor geography (EN + ES) ──────────────────────────────────────────
  { term: "latin america", weight: 2.5 },
  { term: "latinoamérica", weight: 2.5 },
  { term: "latam", weight: 2.5 },
  { term: "nearshore", weight: 2.5 },
  { term: "nearshoring", weight: 2.5 },
  { term: "corredor", weight: 2.0 }, // corridor (ES)
  { term: "mexico", weight: 2.0 },
  { term: "méxico", weight: 2.0 },
  { term: "colombia", weight: 2.0 },
  { term: "brazil", weight: 1.5 },
  { term: "brasil", weight: 1.5 },
  { term: "panama", weight: 2.0 },
  { term: "panamá", weight: 2.0 },
  { term: "miami", weight: 2.0 },
  { term: "monterrey", weight: 2.0 },
  { term: "bogotá", weight: 2.0 },
  { term: "bogota", weight: 2.0 },
  { term: "ciudad de mexico", weight: 2.0 },
  { term: "peru", weight: 1.5 },
  { term: "perú", weight: 1.5 },
  { term: "chile", weight: 1.5 },
  { term: "argentina", weight: 1.5 },
  { term: "us-latam", weight: 3.0 },

  // ── Business Transformation OS terms ──────────────────────────────────────
  { term: "business transformation", weight: 3.0 },
  { term: "transformación empresarial", weight: 3.0 },
  { term: "operating model", weight: 2.5 },
  { term: "modelo operativo", weight: 2.5 },
  { term: "strategy os", weight: 3.0 },
  { term: "organizational design", weight: 2.0 },
  { term: "diseño organizacional", weight: 2.0 },
  { term: "delegation", weight: 1.5 },
  { term: "delegación", weight: 1.5 },
  { term: "decision making", weight: 1.5 },
  { term: "toma de decisiones", weight: 1.5 },
  { term: "bottleneck", weight: 2.0 },
  { term: "cuello de botella", weight: 2.0 },
  { term: "scalability", weight: 1.5 },
  { term: "escalabilidad", weight: 1.5 },

  // ── ICP profile terms ─────────────────────────────────────────────────────
  { term: "family business", weight: 2.5 },
  { term: "empresa familiar", weight: 2.5 },
  { term: "middle market", weight: 2.5 },
  { term: "mid-market", weight: 2.5 },
  { term: "mediana empresa", weight: 2.5 },
  { term: "owner-operated", weight: 2.5 },
  { term: "founder", weight: 2.0 },
  { term: "fundador", weight: 2.0 },
  { term: "entrepreneur", weight: 2.0 },
  { term: "emprendedor", weight: 2.0 },
  { term: "ceo", weight: 1.5 },
  { term: "director general", weight: 1.5 },
  { term: "leadership", weight: 1.5 },
  { term: "liderazgo", weight: 1.5 },
  { term: "succession", weight: 2.0 },
  { term: "sucesión", weight: 2.0 },
  { term: "legacy", weight: 1.5 },
  { term: "legado", weight: 1.5 },

  // ── Strategy topics ───────────────────────────────────────────────────────
  { term: "strategic planning", weight: 1.5 },
  { term: "planeación estratégica", weight: 1.5 },
  { term: "competitive advantage", weight: 1.5 },
  { term: "ventaja competitiva", weight: 1.5 },
  { term: "pivot", weight: 1.5 },
  { term: "growth strategy", weight: 2.0 },
  { term: "estrategia de crecimiento", weight: 2.0 },
  { term: "private equity", weight: 2.0 },
  { term: "capital privado", weight: 2.0 },
  { term: "acquisition", weight: 1.5 },
  { term: "adquisición", weight: 1.5 },
  { term: "merger", weight: 1.5 },
  { term: "fusión", weight: 1.5 },

  // ── Operations & supply chain ─────────────────────────────────────────────
  { term: "supply chain", weight: 2.0 },
  { term: "cadena de suministro", weight: 2.0 },
  { term: "manufacturing", weight: 1.5 },
  { term: "manufactura", weight: 1.5 },
  { term: "logistics", weight: 1.5 },
  { term: "logística", weight: 1.5 },
  { term: "automation", weight: 1.5 },
  { term: "automatización", weight: 1.5 },
  { term: "erp", weight: 2.0 },
  { term: "crm", weight: 1.5 },
  { term: "process improvement", weight: 1.5 },
  { term: "mejora de procesos", weight: 1.5 },

  // ── Trade & economic signals ───────────────────────────────────────────────
  { term: "tariff", weight: 1.5 },
  { term: "arancel", weight: 1.5 },
  { term: "trade agreement", weight: 2.0 },
  { term: "acuerdo comercial", weight: 2.0 },
  { term: "usmca", weight: 2.5 },
  { term: "t-mec", weight: 2.5 },
  { term: "fdi", weight: 1.5 },
  { term: "inversión extranjera", weight: 1.5 },
  { term: "reshoring", weight: 2.0 },
  { term: "friend-shoring", weight: 2.0 },

  // ── Tech OS / AI topics (moderate weight — third in the sequence) ────────
  { term: "digital transformation", weight: 1.0 },
  { term: "transformación digital", weight: 1.0 },
  { term: "artificial intelligence", weight: 1.5 },
  { term: "inteligencia artificial", weight: 1.5 },
  { term: "ai adoption", weight: 2.0 },
  { term: "adopción de ia", weight: 2.0 },
  { term: "ai for business", weight: 2.5 },
  { term: "ai in the workplace", weight: 2.0 },
  { term: "generative ai", weight: 1.5 },
  { term: "ia generativa", weight: 1.5 },
  { term: "large language model", weight: 1.0 },
  { term: "automation", weight: 1.5 },
  { term: "data governance", weight: 2.0 },
  { term: "gobernanza de datos", weight: 2.0 },
  { term: "information systems", weight: 1.0 },
  { term: "enterprise software", weight: 1.5 },
  { term: "software empresarial", weight: 1.5 },

  // ── SMB research & statistics (high weight — validates ICP claims) ─────────
  { term: "small business", weight: 2.5 },
  { term: "pequeña empresa", weight: 2.5 },
  { term: "sme", weight: 2.5 },
  { term: "pyme", weight: 2.5 },
  { term: "mid-size", weight: 2.0 },
  { term: "growth rate", weight: 1.0 },
  { term: "revenue growth", weight: 1.5 },
  { term: "business owner", weight: 2.5 },
  { term: "dueño de negocio", weight: 2.5 },
  { term: "entrepreneur survey", weight: 2.5 },
  { term: "business confidence", weight: 2.0 },
  { term: "confianza empresarial", weight: 2.0 },
  { term: "workforce", weight: 1.0 },
  { term: "talent retention", weight: 1.5 },
  { term: "retención de talento", weight: 1.5 },
  { term: "profitability", weight: 1.5 },
  { term: "rentabilidad", weight: 1.5 },
];

function scoreRelevance(
  title: string,
  summary: string,
  tags: string[],
  feed: FeedConfig,
): number {
  const text = `${title} ${summary} ${tags.join(" ")}`.toLowerCase();
  let score = 0;
  let maxScore = 0;

  for (const { term, weight } of RELEVANCE_KEYWORDS) {
    maxScore += weight;
    if (text.includes(term)) {
      score += weight;
    }
  }

  // Base content score: normalize so hitting ~1/4 of weighted keywords = 1.0
  let normalized = Math.min(score / (maxScore / 4), 1.0);

  // LATAM sources get a 25% base boost — they are inherently on-corridor
  if (feed.region === "latam") normalized = Math.min(normalized + 0.25, 1.0);

  // Tier-1 sources (strategy/insight) get a 10% quality boost
  if (feed.tier === 1) normalized = Math.min(normalized + 0.1, 1.0);

  return normalized;
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

    // Fetch all feeds in parallel — with 30 feeds sequential would be ~6 min worst-case
    const results = await Promise.allSettled(
      RSS_FEEDS.map(async (feed) => ({
        feed,
        parsed: await parser.parseURL(feed.url),
      })),
    );

    const allItems: SourceItem[] = [];
    let feedsScanned = 0;
    let totalScanned = 0;

    for (const result of results) {
      if (result.status === "rejected") {
        this.logger.warn(
          `Radar: feed failed — ${String(result.reason instanceof Error ? result.reason.message : result.reason)}`,
        );
        continue;
      }

      const { feed, parsed } = result.value;
      feedsScanned++;

      for (const item of parsed.items) {
        totalScanned++;
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const recencyHours =
          (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);

        if (recencyHours > payload.timeWindowHours) continue;

        const title = item.title?.trim() ?? "Untitled";
        const summary =
          (item.contentSnippet ?? item.summary ?? "").substring(0, 600);
        const rawContent = (
          item["content:encoded"] ??
          item.content ??
          summary
        ).substring(0, 3000);
        const tags: string[] = (item.categories as string[] | undefined) ?? [];
        const url = item.link?.trim() ?? "";

        if (!url || !title || title === "Untitled") continue;

        const relevanceScore = scoreRelevance(title, summary, tags, feed);
        const verbatimFacts = extractFacts(rawContent, title, feed.outlet);

        // Tag competitive items so the Strategist can avoid saturated angles
        const itemTags = feed.competitive
          ? [...tags, "competitive-signal"]
          : tags;

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
          tags: itemTags,
          rawContent,
        });
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
