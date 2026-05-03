/**
 * Render a fully-formed sample edition WITHOUT calling any APIs.
 *
 * Why: until the cron runs against real Anthropic credits, you have no
 * concrete preview of what the *current* system produces. This script
 * bakes a realistic synthetic edition that exercises the latest schema
 * (peopleAngle, OS pillar, validator score, magic-link digest) and
 * writes it to drafts/sample/ so you can open the HTML in a browser
 * and see exactly what the pipeline output looks like today.
 *
 * Usage:
 *   pnpm sample
 *
 * Outputs (drafts/sample/):
 *   2026-18-sample-en.md            — Writer-style markdown
 *   2026-18-sample-en.html          — same, rendered for browser preview
 *   2026-18-sample-digest.html      — Resend digest email (open in browser)
 *   2026-18-sample-digest.txt       — plain-text fallback
 *   2026-18-sample-image-prompt.txt — what the Designer would send to Gemini
 *   2026-18-sample-draft.json       — full DraftJson, usable by other scripts
 *
 * To produce a real hero image: see `pnpm sample:hero` (requires GEMINI_API_KEY).
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderDigestHtml, renderDigestText } from "./send-draft-digest.js";

// ── Synthetic edition (matches the LATEST schema as of this commit) ─────

const EDITION_ID = "2026-18-sample";

const ANGLE = {
  headline: "Your AI agent is doing exactly what you asked. That is the problem.",
  thesis:
    "The agent's reliability is a diagnostic instrument — it surfaces every gap in your operating model your team had quietly worked around.",
  targetPersona: "$5M–$100M owner-operator who has just deployed (or is about to deploy) an agentic workflow",
  relevanceToAudience:
    "Every corridor operator in the AI-rollout phase will hit this wall. The diagnosis arrives faster than they expect.",
  suggestedSources: [],
  talkingPoints: [
    "AI agents do not fix operating models — they execute against them, ruthlessly.",
    "The owner's first behavior shift is recognizing the agent is the messenger, not the problem.",
    "Three artifacts the agent will reveal you do not have: decision rights map, system of record, process documentation.",
    "This week's move: pick the one place the agent is failing — the failure is the prescription.",
  ],
  osPillar: "Operating Model OS",
  peopleAngle: {
    challenge:
      "The owner must accept that the agent's reliability surfaces gaps the org has been tolerating — and resist blaming the AI for failures it merely exposes.",
    framework: "ADKAR: Awareness",
  },
  quarterlyTheme: "The Machine",
};

const APERTURA =
  "Three owners I work with deployed AI agents this quarter. All three came back with the same complaint, in different words. The agent did exactly what they configured it to do. The work still did not get done. One of them said it most clearly: I built a tireless employee, and now I can see how dysfunctional my company has been the whole time. He thought he was telling me the agent had failed. He was telling me something else.";

const INSIGHT =
  "You deployed an AI agent expecting it to compress a workflow. It did. The agent does its part in seconds. The work still stalls. The instinct is to blame the model.\n\n" +
  "It is not the model. The agent is doing exactly what you asked, against the operating model you actually have — not the one you think you have. It escalates to whoever the configuration said to escalate to. It cites whichever system you connected as the source of truth. It follows the process documentation that exists. Where decision rights are undefined, it requests authorization. Where the system of record is fragmented, it confidently surfaces inconsistent data. The agent is reliable. Your operating model is not.\n\n" +
  "Most advisors call this an AI rollout problem. It is not a rollout problem. It is a mirror. The reliability of the agent is the diagnostic instrument. Every place the agent is surprising you, frustrating you, or producing the wrong result is a place your team had quietly worked around the gap and the agent will not. The team's tolerance for ambiguity was a feature you did not know you depended on. The agent has none.\n\n" +
  "The first move is yours, before it is anyone else's. Before the team can absorb the change, before the process owners can rewrite anything, the owner has to recognize what the agent is actually showing. That recognition is harder than it sounds — the natural reflex is to demand a better model, not to read the deployment as the audit it has become. The owners who get value from this technology are the ones who let the agent's failures redirect them. The ones who keep tuning prompts in search of a fix that does not depend on changing how the business runs are paying for the most expensive set of consulting findings they will ever receive, and ignoring them.\n\n" +
  "Three artifacts the agent will reveal you do not have. A decision rights map: the agent escalates to whoever the config says, and you discover that role is undefined. A system of record: the agent reports the version of the customer's status from the source you connected, and your team reports a different one because they have been silently reconciling between three. Process documentation that survives turnover: the agent executes the documented version, and the team's actual workflow — the one that has been getting things done for years — was never written down.\n\n" +
  "This week, pick the one place the agent is failing or surprising you most. Not the one with the highest impact — the one that is the most embarrassing or the most surprising. Ask the question that earns its keep: what artifact am I missing here? Then write the first draft of that artifact. The agent's failure is not a bug report. It is the prescription.";

const FIELD_REPORT =
  "A Texas-based industrial distributor deployed an agent in February to handle the inbound RFQ flow that had been backing up since November. The agent was configured to route quotes through three approval tiers based on margin, customer tier, and contract value. Within two weeks the operations director had escalated five times that the agent was 'breaking,' and the founder had asked whether they should switch vendors. When his team mapped the failures, three of the five involved the same root cause: a customer category that had grown organically over the past two years and was being treated by the human team as a hybrid of two existing tiers. The category had no formal definition. It existed only in the heads of two senior account managers. The agent had no choice but to misroute. The fix was not a better agent. It was a Tuesday afternoon spent writing down what the team had been improvising for eighteen months. The RFQ throughput doubled the following week.";

const COMPASS =
  "I have been asking myself this lately: when an AI tool surfaces a gap in how my own work runs, do I receive that as information, or do I receive it as a threat? The honest answer is sometimes one and sometimes the other, depending on the day, depending on how exposed the gap makes me feel. I am not sure that asymmetry serves the work I want to do. It seems worth naming.";

const DOOR =
  "If something in this issue landed, reply — I read every response.\n\nWhen you're ready to work together directly, here is how we start: [link]";

const EN_CONTENT = {
  language: "en",
  subject: "Your AI agent is doing exactly what you asked. That is the problem.",
  preheader: "The agent is reliable. Your operating model is not. The deployment is the audit.",
  sections: [
    { type: "lead", heading: "The Apertura", body: APERTURA },
    { type: "analysis", heading: "The Insight", body: INSIGHT },
    { type: "spotlight", heading: "The Field Report", body: FIELD_REPORT },
    { type: "quickTakes", heading: "The Compass", body: COMPASS },
    { type: "cta", heading: "The Door", body: DOOR },
  ],
};

const totalWords = [APERTURA, INSIGHT, FIELD_REPORT, COMPASS, DOOR].reduce(
  (n, s) => n + s.split(/\s+/).filter(Boolean).length,
  0,
);

const VALIDATION = {
  isValid: true,
  score: 87,
  issues: [
    {
      severity: "warning",
      section: "insight",
      message:
        "Reframe lands but the second paragraph stacks two rebuttals — consider tightening to one for cleaner rhythm.",
    },
    {
      severity: "info",
      section: "fieldReport",
      message:
        "Texas distributor example is strong on intelligence; could anchor harder in the corridor by naming the cross-border dimension explicitly.",
    },
  ],
  recommendations: [
    "Tighten the second paragraph of the Insight; the framework name appears implicitly twice.",
    "Field Report could add one line on why this matters specifically to a US-LATAM operator.",
    "Compass is genuine — preserve as written.",
  ],
  wordCounts: {
    signal: 0,
    apertura: APERTURA.split(/\s+/).filter(Boolean).length,
    insight: INSIGHT.split(/\s+/).filter(Boolean).length,
    fieldReport: FIELD_REPORT.split(/\s+/).filter(Boolean).length,
    tool: 0,
    compass: COMPASS.split(/\s+/).filter(Boolean).length,
    total: totalWords,
  },
  shareableSentence:
    "The reliability of the agent is the diagnostic instrument; every place the agent is surprising you is a place your team had quietly worked around the gap and the agent will not.",
};

// ── Markdown renderer (mirrors run.ts:renderMarkdown structure) ──────────

function renderMarkdown(): string {
  return [
    `# The Transformation Letter — Edition ${EDITION_ID}`,
    ``,
    `**Subject:** ${EN_CONTENT.subject}  `,
    `**Preheader:** ${EN_CONTENT.preheader}  `,
    `**OS Pillar:** ${ANGLE.osPillar}  `,
    `**People dimension:** ${ANGLE.peopleAngle.framework} — ${ANGLE.peopleAngle.challenge}`,
    ``,
    `---`,
    ``,
    `## THE APERTURA`,
    ``,
    APERTURA,
    ``,
    `---`,
    ``,
    `## THE INSIGHT`,
    ``,
    INSIGHT,
    ``,
    `---`,
    ``,
    `## THE FIELD REPORT`,
    ``,
    FIELD_REPORT,
    ``,
    `---`,
    ``,
    `## THE COMPASS`,
    ``,
    COMPASS,
    ``,
    `---`,
    ``,
    `## THE DOOR`,
    ``,
    DOOR,
    ``,
  ].join("\n");
}

function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line === "---") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<hr>");
    } else if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function renderHtml(md: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${EN_CONTENT.subject}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #0F1A2B; line-height: 1.7; font-size: 17px; background: #F4EFE6; }
  h1 { font-family: "Cormorant Garamond", Garamond, serif; font-size: 1.6rem; line-height: 1.25; margin: 0 0 8px 0; }
  h2 { font-size: 0.95rem; text-transform: uppercase; letter-spacing: .12em; margin-top: 2.5rem; color: #1F4E5F; border-bottom: 1px solid #C7892A; padding-bottom: 6px; }
  p { margin: 1rem 0; }
  blockquote { border-left: 3px solid #C7892A; margin: 1.2rem 0; padding: .5rem 1rem; color: #1F4E5F; font-style: italic; }
  hr { border: none; border-top: 1px solid rgba(199,137,42,0.3); margin: 1.5rem 0; }
  strong { color: #0F1A2B; }
</style>
</head>
<body>
${mdToHtml(md)}
</body>
</html>`;
}

// ── Designer image prompt (the real thing the Designer would send) ───────

function loadBrandTokens(): {
  imageStyle: { approach: string; constraints: string[]; preferences: string[]; model: string };
  layout: { heroDimensions: { width: number; height: number } };
} {
  const tokensPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config",
    "brand-style-tokens.json",
  );
  return JSON.parse(readFileSync(tokensPath, "utf-8"));
}

function composeImagePrompt(): string {
  const tokens = loadBrandTokens();
  return [
    `Editorial illustration, ${tokens.layout.heroDimensions.width}x${tokens.layout.heroDimensions.height} (16:9). ${tokens.imageStyle.approach}.`,
    ``,
    `Visual concept for "${ANGLE.headline}":`,
    `An abstract architectural composition rendered in deep navy (#0F1A2B) and muted teal (#1F4E5F) with selective ochre (#C7892A) accents. The visual metaphor: a structure being illuminated from within by an external light, revealing the joints and seams that had been invisible. Show this as overlapping geometric planes — a building schematic rendered partially in blueprint line and partially in solid form — where the solid sections reveal load-bearing elements that were not visible in the schematic. Negative space dominates the upper-right quadrant. Cream paper-grain background. Matte finish, hand-drawn feel.`,
    ``,
    `Constraints (DO NOT produce these):`,
    ...tokens.imageStyle.constraints.map((c) => `  - ${c}`),
    ``,
    `Preferences:`,
    ...tokens.imageStyle.preferences.map((p) => `  - ${p}`),
  ].join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  const outDir = join(process.cwd(), "drafts", "sample");
  mkdirSync(outDir, { recursive: true });

  const md = renderMarkdown();
  const html = renderHtml(md);
  const imagePrompt = composeImagePrompt();

  const draft = {
    runId: "00000000-0000-0000-0000-000000000000",
    editionId: EDITION_ID,
    angle: ANGLE,
    enContent: EN_CONTENT,
    validation: VALIDATION,
  };

  const links = {
    prUrl: "https://github.com/wbardawil/agentic_newsletter/pull/SAMPLE",
    publishWorkflowUrl:
      "https://github.com/wbardawil/agentic_newsletter/actions/workflows/publish-to-beehiiv.yml",
    reRunDraftUrl:
      "https://github.com/wbardawil/agentic_newsletter/actions/workflows/weekly-draft.yml",
    approveUrl:
      "https://approve.example.workers.dev/approve?t=SAMPLE-TOKEN-not-functional",
  };

  const digestHtml = renderDigestHtml(draft as never, links);
  const digestText = renderDigestText(draft as never, links);

  writeFileSync(join(outDir, `${EDITION_ID}-en.md`), md);
  writeFileSync(join(outDir, `${EDITION_ID}-en.html`), html);
  writeFileSync(join(outDir, `${EDITION_ID}-digest.html`), digestHtml);
  writeFileSync(join(outDir, `${EDITION_ID}-digest.txt`), digestText);
  writeFileSync(join(outDir, `${EDITION_ID}-image-prompt.txt`), imagePrompt);
  writeFileSync(
    join(outDir, `${EDITION_ID}-draft.json`),
    JSON.stringify(draft, null, 2),
  );

  console.log(`Sample edition written to ${outDir}/`);
  console.log("");
  console.log("Open in browser:");
  console.log(`  ${EDITION_ID}-en.html       (the newsletter, mobile-styled)`);
  console.log(`  ${EDITION_ID}-digest.html   (the digest email as it lands in your inbox)`);
  console.log("");
  console.log("Read in editor:");
  console.log(`  ${EDITION_ID}-en.md          (the markdown source)`);
  console.log(`  ${EDITION_ID}-image-prompt.txt (what the Designer sends to Gemini)`);
  console.log("");
  console.log(`Word count: ${totalWords}, QA: ${VALIDATION.score}/100, ${VALIDATION.isValid ? "valid" : "invalid"}`);
  console.log(`To generate a real hero image: pnpm sample:hero (requires GEMINI_API_KEY)`);
}

main();
