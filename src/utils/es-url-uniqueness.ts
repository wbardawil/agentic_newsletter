import type { LocalizedContent } from "../types/edition.js";

/**
 * Deterministic post-check for the ES edition: the Field Report URL must
 * not match any URL cited in the Signal bullets. When the Localizer picks
 * the same Mexican company for both (as happened on edition 2026-26 with
 * the T-MEC Expansión note appearing in both Signal.Estrategia and the
 * Field Report), the reader sees the same citation twice in one email.
 *
 * Returns a list of duplicate URLs. Empty array means the ES is clean.
 * The caller decides what to do — warn, block, or trigger a repair pass.
 */

const MD_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;

function extractUrls(body: string): Set<string> {
  const urls = new Set<string>();
  for (const match of body.matchAll(MD_LINK_RE)) {
    if (match[1]) urls.add(match[1]);
  }
  return urls;
}

export interface EsDuplicateIssue {
  url: string;
  signalPillar: string | null;
}

export function findEsFieldReportDuplicates(
  content: LocalizedContent,
): EsDuplicateIssue[] {
  const signal = content.sections.find((s) => s.type === "news");
  const fieldReport = content.sections.find((s) => s.type === "spotlight");
  if (!signal || !fieldReport) return [];

  const signalUrls = extractUrls(signal.body);
  const fieldReportUrls = extractUrls(fieldReport.body);

  const duplicates: EsDuplicateIssue[] = [];
  for (const url of fieldReportUrls) {
    if (signalUrls.has(url)) {
      // Try to identify which pillar bullet the URL is in — cheap heuristic:
      // scan each bullet line for the URL and pull the bold pillar label.
      const bulletRe = /^\s*[-*]\s+\*\*([^:*]+):\*\*[^\n]*\]\(([^)]+)\)/gm;
      let matchedPillar: string | null = null;
      for (const m of signal.body.matchAll(bulletRe)) {
        if (m[2] === url) {
          matchedPillar = (m[1] ?? "").trim() || null;
          break;
        }
      }
      duplicates.push({ url, signalPillar: matchedPillar });
    }
  }
  return duplicates;
}
