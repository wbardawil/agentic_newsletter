import type { LocalizedContent } from "../types/edition.js";

/**
 * Deterministic post-check: the Field Report URL must not match any URL
 * cited in the Signal bullets. Applies to both editions — the Writer has
 * been caught duplicating the Fast Company Microsoft URL across EN
 * Signal.HumanCapital and EN Field Report, and the Localizer has been
 * caught duplicating the Expansión T-MEC note across ES Signal.Estrategia
 * and ES Field Report. When the same citation appears in two sections of
 * the same email, the reader reads the same article twice.
 *
 * Returns a list of duplicate URLs. Empty array means the edition is clean.
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

export interface DuplicateIssue {
  url: string;
  signalPillar: string | null;
}

export function findFieldReportDuplicates(
  content: LocalizedContent,
): DuplicateIssue[] {
  const signal = content.sections.find((s) => s.type === "news");
  const fieldReport = content.sections.find((s) => s.type === "spotlight");
  if (!signal || !fieldReport) return [];

  const signalUrls = extractUrls(signal.body);
  const fieldReportUrls = extractUrls(fieldReport.body);

  const duplicates: DuplicateIssue[] = [];
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

// Back-compat aliases — the original ES-only exports are kept so existing
// imports continue to work unchanged. Both names point at the same
// language-agnostic check.
export const findEsFieldReportDuplicates = findFieldReportDuplicates;
export type EsDuplicateIssue = DuplicateIssue;
