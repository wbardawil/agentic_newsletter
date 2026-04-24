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
import { fetchFeedlyStream } from "../utils/feedly.js";

const RadarInputSchema = z.object({
  timeWindowHours: z.number().positive(),
  maxItems: z.number().int().positive(),
  focusTopics: z.array(z.string()).optional(),
  /** Override the per-feed RSS parser timeout in ms (default: from config). */
  rssTimeoutMs: z.number().positive().int().optional(),
});
type RadarInput = z.infer<typeof RadarInputSchema>;

interface FeedConfig {
  url: string;
  outlet: string;
  /**
   * Geographic anchor of the feed. Drives which edition(s) the item is
   * eligible for after the regional filter:
   *   - "us": only the EN edition pulls from this feed
   *   - "mx": only the ES edition pulls from this feed
   *   - "corridor": both editions can cite (global research, US-LATAM
   *     trade, pan-LATAM business press, Spanish-language business
   *     commentary that is not MX-specific)
   */
  region: "us" | "mx" | "corridor";
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
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://sloanreview.mit.edu/feed/",
    outlet: "MIT Sloan Management Review",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.mckinsey.com/insights/rss",
    outlet: "McKinsey Insights",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://knowledge.wharton.upenn.edu/feed/",
    outlet: "Knowledge@Wharton",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://blogs.lse.ac.uk/businessreview/feed/",
    outlet: "LSE Business Review",
    region: "corridor",
    tier: 1,
  },

  // ── Mid-Market & LATAM Institutional Research ────────────────────────────
  // RSM is the only major consulting firm with a dedicated mid-market
  // publication.
  {
    url: "https://realeconomy.rsmus.com/feed/",
    outlet: "RSM Real Economy (Middle Market)",
    region: "us",
    tier: 1,
  },
  {
    url: "https://blog.iese.edu/feed/",
    outlet: "IESE Business School",
    region: "corridor",
    tier: 1,
  },

  // ── Leadership, Org Design & Transformation ──────────────────────────────
  // Korn Ferry is the primary research institution on CEO/talent/org structure.
  // Atlantic Council adds the US-LATAM geopolitical trade layer.
  {
    url: "https://kornferryinstitute.libsyn.com/rss",
    outlet: "Korn Ferry Briefings on Talent & Leadership",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.atlanticcouncil.org/category/commentary/feature/feed/",
    outlet: "Atlantic Council (GeoEconomics)",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://chiefexecutive.net/feed/",
    outlet: "Chief Executive Magazine",
    region: "us",
    tier: 1,
  },

  // ── The Economist ─────────────────────────────────────────────────────────
  {
    url: "https://www.economist.com/finance-and-economics/rss.xml",
    outlet: "The Economist",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.economist.com/business/rss.xml",
    outlet: "The Economist — Business",
    region: "corridor",
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
    region: "corridor",
    tier: 2,
  },

  // ── LATAM Business — Mexico ────────────────────────────────────────────────
  {
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada",
    outlet: "El País Economía",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://expansion.mx/rss",
    outlet: "Expansión México",
    region: "mx",
    tier: 2,
  },

  // ── LATAM Business — Regional & Pan-LATAM ─────────────────────────────────
  {
    url: "https://americaeconomia.com/rss.xml",
    outlet: "América Economía",
    region: "corridor",
    tier: 2,
  },

  // ── Supply Chain, Trade & Nearshore ───────────────────────────────────────
  {
    url: "https://nearshoreamericas.com/feed/",
    outlet: "Nearshore Americas",
    region: "corridor",
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
    region: "corridor",
    tier: 3,
    competitive: true,
  },
  {
    url: "https://thegeneralist.substack.com/feed",
    outlet: "The Generalist",
    region: "corridor",
    tier: 3,
    competitive: true,
  },

  // ── Technology & AI in Business ────────────────────────────────────────────
  {
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    outlet: "MIT Technology Review — AI",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://venturebeat.com/category/ai/feed/",
    outlet: "VentureBeat AI",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://www.wired.com/feed/category/business/latest/rss",
    outlet: "Wired Business",
    region: "corridor",
    tier: 2,
  },

  // ── Operations & Process Excellence ──────────────────────────────────────────
  // Source: processexcellencenetwork.com — URL pattern /rss/categories/{slug}
  // "automation" slug confirmed; others follow the same pattern.
  {
    url: "https://www.processexcellencenetwork.com/rss/categories/business-transformation",
    outlet: "Process Excellence Network — Business Transformation",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.processexcellencenetwork.com/rss/categories/change-management",
    outlet: "Process Excellence Network — Organizational Change",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.processexcellencenetwork.com/rss/categories/digital-transformation",
    outlet: "Process Excellence Network — Digital Transformation",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.processexcellencenetwork.com/rss/categories/ai",
    outlet: "Process Excellence Network — AI",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.processexcellencenetwork.com/rss/categories/automation",
    outlet: "Process Excellence Network — Automation & RPA",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://www.processexcellencenetwork.com/rss/categories/opex",
    outlet: "Process Excellence Network — OPEX & BPM",
    region: "corridor",
    tier: 2,
  },

  // ── Human Capital & HR Technology ────────────────────────────────────────────
  // HR Exchange: global feed confirmed at /rss/articles; category pattern mirrors PEX.
  {
    url: "https://www.hrexchangenetwork.com/rss/categories/hr-technology",
    outlet: "HR Exchange Network — HR Technology",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.hrexchangenetwork.com/rss/categories/people-analytics",
    outlet: "HR Exchange Network — People Analytics",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://techrseries.com/feed/",
    outlet: "TechHR Series",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://hrtechfeed.com/feed/",
    outlet: "HR Tech Feed",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://joshbersin.com/feed/",
    outlet: "Josh Bersin",
    region: "corridor",
    tier: 1,
  },

  // ── Tech Signal Layer ─────────────────────────────────────────────────────────
  // Lower relevance scores (80–84) but useful for catching AI/platform signals
  // that translate to mid-market operating model implications.
  {
    url: "https://www.theverge.com/rss/index.xml",
    outlet: "The Verge",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://feeds.arstechnica.com/arstechnica/index",
    outlet: "Ars Technica",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://techcrunch.com/feed/",
    outlet: "TechCrunch",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://blog.bytebytego.com/feed",
    outlet: "ByteByteGo (System Design)",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://news.ycombinator.com/rss",
    outlet: "Hacker News",
    region: "corridor",
    tier: 3,
  },

  // ── Product, Growth & Org Design — Newsletter Intelligence ───────────────────
  // Practitioner-tier sources: frameworks, surveys, mental models.
  // Used to surface "Operating Models" and "Human Capital" pillar angles.
  // These write for PMs/founders, not our exact audience — cite as inspiration,
  // never as competitor overlap. Not marked competitive.
  {
    url: "https://www.lennysnewsletter.com/feed",
    outlet: "Lenny's Newsletter",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://andrewchen.substack.com/feed",
    outlet: "Andrew Chen (Growth & Network Effects)",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.svpg.com/feed/",
    outlet: "SVPG — Marty Cagan (Product Leadership)",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.producttalk.org/feed/",
    outlet: "Product Talk — Teresa Torres (Discovery)",
    region: "corridor",
    tier: 2,
  },
  {
    url: "https://productgrowth.substack.com/feed",
    outlet: "Product Growth — Aakash Gupta (Growth & Metrics)",
    region: "corridor",
    tier: 2,
  },

  // ── Tech-Business Strategy — Executive Tier ────────────────────────────────
  // Stratechery and Benedict Evans are the benchmark for "what smart execs read."
  // Pragmatic Engineer is the best source for engineering org design signals.
  {
    url: "https://stratechery.com/feed/",
    outlet: "Stratechery — Ben Thompson",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://www.ben-evans.com/benedictevans/rss.xml",
    outlet: "Benedict Evans (Tech & Market Structure)",
    region: "corridor",
    tier: 1,
  },
  {
    url: "https://newsletter.pragmaticengineer.com/feed",
    outlet: "The Pragmatic Engineer — Gergely Orosz",
    region: "corridor",
    tier: 2,
  },

  // ── Human Capital — Tier 2/3 ──────────────────────────────────────────────
  // Added 2026-04-23 to fill the consistently under-served HC pillar in Signal.
  // 5 candidates from the original audit (MIT Sloan, strategy+business, WEF,
  // Chief Executive, Josh Bersin) were already present above.
  {
    url: "https://www.bls.gov/feed/empsit.rss",
    outlet: "BLS Employment Situation",
    region: "us",
    tier: 2,
  },
  {
    url: "https://www.bls.gov/feed/eci.rss",
    outlet: "BLS Employment Cost Index",
    region: "us",
    tier: 2,
  },
  {
    url: "https://www.bls.gov/feed/jolts.rss",
    outlet: "BLS Job Openings (JOLTS)",
    region: "us",
    tier: 3,
  },
  {
    url: "https://www.bls.gov/feed/prod2.rss",
    outlet: "BLS Productivity",
    region: "us",
    tier: 3,
  },
  {
    url: "https://hrexecutive.com/feed/",
    outlet: "HR Executive",
    region: "us",
    tier: 2,
  },
  {
    url: "https://expansion.mx/rss/carrera",
    outlet: "Expansión – Carrera",
    region: "mx",
    tier: 2,
  },
  {
    url: "https://factorial.mx/blog/feed/",
    outlet: "Factorial México",
    region: "mx",
    tier: 3,
  },

  // ── US broad-coverage signal feeds ───────────────────────────────────────
  {
    url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",
    outlet: "CNBC Business",
    region: "us",
    tier: 2,
  },
  {
    url: "https://www.entrepreneur.com/latest.rss",
    outlet: "Entrepreneur",
    region: "us",
    tier: 3,
  },
  {
    url: "https://www.businessinsider.com/rss",
    outlet: "Business Insider",
    region: "us",
    tier: 3,
  },

  // ── Mid-market US owner-operator — the ICP's peer coverage ──────────────
  // ACG, Vistage, Family Business and Endeavor speak to a $5M–$150M
  // owner-operator at the altitude the ICP actually operates at.
  {
    url: "https://middlemarketgrowth.org/feed/",
    outlet: "Middle Market Growth (ACG)",
    region: "us",
    tier: 1,
  },
  {
    url: "https://www.vistage.com/research-center/feed/",
    outlet: "Vistage Research Center",
    region: "us",
    tier: 1,
  },
  {
    url: "https://www.familybusinessmagazine.com/rss.xml",
    outlet: "Family Business Magazine",
    region: "us",
    tier: 2,
  },
  {
    url: "https://endeavor.org/feed/",
    outlet: "Endeavor Insight",
    region: "us",
    tier: 2,
  },

  // ── Mexico — non-paywalled commentary & ecosystem ───────────────────────
  // Paywalled outlets (Reforma) and outlets without public RSS (Banxico
  // press, Excélsior Dinero) are intentionally omitted — add them once
  // a working feed URL is confirmed.
  {
    url: "https://elceo.com/feed/",
    outlet: "El CEO",
    region: "mx",
    tier: 2,
  },
  {
    url: "https://coparmex.org.mx/feed/",
    outlet: "Coparmex — Confederación Patronal",
    region: "mx",
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

  // US and MX sources both get a 25% base boost — corridor feeds dominate
  // the pool (65 of 108) and without the boost a typical top-20 is 14
  // corridor items + 6 regional. Giving the two regional buckets equal
  // weight keeps the Writer (filtered to us+corridor) and the Localizer
  // (filtered to mx+corridor) each with 4-6 regional items to work with,
  // rather than the Writer seeing 14 corridor + 2 us items and defaulting
  // to HBR think-pieces.
  if (feed.region === "us" || feed.region === "mx") {
    normalized = Math.min(normalized + 0.25, 1.0);
  }

  // Tier-1 sources (strategy/insight) get a 10% quality boost
  if (feed.tier === 1) normalized = Math.min(normalized + 0.1, 1.0);

  return normalized;
}

/** RSS fields can be strings or objects like { "#": "text", "@": {...} } or { _: "text" }. */
function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    for (const k of ["#", "_", "$t", "name", "text"]) {
      if (typeof obj[k] === "string") return obj[k] as string;
    }
    return "";
  }
  return String(v);
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
    const timeoutMs =
      payload.rssTimeoutMs ?? this.deps.apiClients.rssParserTimeoutMs;
    // Browser-like User-Agent defeats most RSS anti-bot 403 responses.
    // Accept-Language + Accept headers further mimic a real reader.
    const parser = new Parser({
      timeout: timeoutMs,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      },
    });
    const scannedAt = new Date().toISOString();

    // Hard ceiling prevents a single slow feed from stalling the whole pipeline
    const AGGREGATE_TIMEOUT_MS = 10 * 60 * 1000;

    // Fetch all feeds in parallel — with 30 feeds sequential would be ~6 min
    // worst-case. Each fetch carries its feed identity even when it fails,
    // so the failure logs below can name the outlet (not just the generic
    // "Status code 404") — which is what actually lets us prune dead feeds.
    // FeedResult — explicit type `any` on parsed is pragmatic here: the
    // downstream loop reads extension fields like "content:encoded" and
    // "author" that aren't in Parser.Item's base type but are valid RSS/
    // Atom extensions the parser surfaces at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type ParsedOutput = any;
    type FeedResult =
      | { status: "ok"; feed: FeedConfig; parsed: ParsedOutput }
      | { status: "err"; feed: FeedConfig; error: unknown };

    const results = await Promise.race([
      Promise.all(
        RSS_FEEDS.map(async (feed): Promise<FeedResult> => {
          try {
            const parsed = await parser.parseURL(feed.url);
            return { status: "ok", feed, parsed };
          } catch (error) {
            return { status: "err", feed, error };
          }
        }),
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Radar: RSS aggregate timeout after ${AGGREGATE_TIMEOUT_MS / 1000}s`)),
          AGGREGATE_TIMEOUT_MS,
        ),
      ),
    ]);

    const rejected = results.filter((r) => r.status === "err").length;
    if (rejected > 0) {
      this.logger.warn(
        `Radar: ${rejected}/${results.length} feeds failed to load`,
        { runId: context.runId },
      );
    }

    const allItems: SourceItem[] = [];
    let feedsScanned = 0;
    let totalScanned = 0;

    for (const result of results) {
      if (result.status === "err") {
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        this.logger.warn(
          `Radar: feed failed — [${result.feed.outlet}] ${result.feed.url} — ${msg.replace(/\n/g, " ")}`,
        );
        continue;
      }

      const { feed, parsed } = result;
      feedsScanned++;

      for (const item of parsed.items) {
        totalScanned++;
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        // Clamp to 0: some feeds (Fed, Reuters, scheduled corporate releases)
        // publish items with timestamps slightly in the future (timezone skew
        // or embargo-then-publish patterns). The Zod schema on SourceItem
        // requires recencyHours >= 0, and an item published "at" now should
        // count as newest, not rejected.
        const recencyHours = Math.max(
          0,
          (Date.now() - pubDate.getTime()) / (1000 * 60 * 60),
        );

        if (recencyHours > payload.timeWindowHours) continue;

        const title = toStr(item.title).trim() || "Untitled";
        const summary = toStr(item.contentSnippet ?? item.summary).substring(0, 600);
        const rawContent = toStr(
          item["content:encoded"] ?? item.content ?? summary,
        ).substring(0, 3000);
        const tags: string[] = Array.isArray(item.categories)
          ? (item.categories as unknown[]).map(toStr).filter(Boolean)
          : [];
        const url = toStr(item.link).trim();

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
          author: toStr(item.creator ?? item["author"]).trim() || undefined,
          outlet: feed.outlet,
          summary: summary || title,
          verbatimFacts,
          relevanceScore,
          recencyHours,
          tags: itemTags,
          rawContent,
          // FeedConfig.region now matches SourceItem.region one-for-one
          // (us | mx | corridor), so the mapping is identity. Corridor
          // items work for either language edition; mx items are authored
          // fresh into the ES Signal/Field Report/Compass by the Localizer,
          // us items anchor the EN edition.
          region: feed.region,
        });
      }
    }

    // ── Feedly supplemental source (additive, never required) ─────────────────
    const { feedlyApiKey } = this.deps.apiClients;
    if (feedlyApiKey) {
      try {
        const newerThan = Date.now() - payload.timeWindowHours * 60 * 60 * 1000;
        const feedlyItems = await fetchFeedlyStream(feedlyApiKey, 50, newerThan);
        let feedlyAdded = 0;

        for (const fi of feedlyItems) {
          const url = fi.canonical?.[0]?.href ?? fi.originId ?? "";
          const title = fi.title?.trim() ?? "";
          if (!url || !title) continue;

          const pubDate = fi.published ? new Date(fi.published) : new Date();
          const recencyHours = Math.max(
            0,
            (Date.now() - pubDate.getTime()) / (1000 * 60 * 60),
          );
          if (recencyHours > payload.timeWindowHours) continue;

          const rawContent = (fi.content?.content ?? fi.summary?.content ?? "").substring(0, 3000);
          const summary = fi.summary?.content
            ? fi.summary.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 600)
            : title;
          const outlet = fi.origin?.title ?? "Feedly";
          const tags = (fi.tags ?? []).map((t) => t.label ?? "").filter(Boolean);
          const verbatimFacts = extractFacts(rawContent, title, outlet);
          const relevanceScore = scoreRelevance(title, summary, tags, { region: "corridor", tier: 2 } as FeedConfig);

          allItems.push({
            id: randomUUID(),
            sourceType: "rss",
            title,
            url,
            publishedAt: pubDate.toISOString(),
            outlet,
            summary,
            verbatimFacts,
            relevanceScore,
            recencyHours,
            tags,
            rawContent,
            // Feedly items lack a known FeedConfig — default to corridor so
            // either edition can use them without bias.
            region: "corridor",
          });
          feedlyAdded++;
          totalScanned++;
        }

        this.logger.info(`Radar: added ${feedlyAdded} items from Feedly`, {
          runId: context.runId,
        });
      } catch (err) {
        this.logger.warn(
          `Radar: Feedly fetch failed (continuing with RSS only) — ${err instanceof Error ? err.message : String(err)}`,
          { runId: context.runId },
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
