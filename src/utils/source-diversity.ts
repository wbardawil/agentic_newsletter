import type { LocalizedContent } from "../types/edition.js";
import type { SourceBundle } from "../types/source-bundle.js";

/**
 * Count distinct outlets cited in a draft by parsing markdown links from the
 * body of every section and matching each URL back to a SourceBundle item.
 * URLs that do not match any bundle item fall back to their hostname (minus
 * any leading `www.`).
 *
 * Replaces an LLM-driven count in the Quality Gate prompt — the operation
 * is pure URL parsing and set-membership, no semantic judgment involved.
 */
export function computeDistinctOutlets(
  content: LocalizedContent,
  sourceBundle: SourceBundle,
): { distinctOutlets: string[]; outletCount: number } {
  const body = content.sections.map((s) => s.body).join("\n\n");
  const urlRegex = /\]\((https?:\/\/[^)]+)\)/g;

  const outlets = new Set<string>();
  const bundleByUrl = new Map<string, string>();
  for (const item of sourceBundle.items) {
    if (item.outlet) bundleByUrl.set(item.url, item.outlet);
  }

  urlRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(body)) !== null) {
    const url = match[1]!;
    const fromBundle =
      bundleByUrl.get(url) ??
      [...bundleByUrl.entries()].find(([u]) => url.startsWith(u))?.[1];
    if (fromBundle) {
      outlets.add(fromBundle);
      continue;
    }
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      outlets.add(host);
    } catch {
      // skip malformed URLs silently — they will be caught upstream
    }
  }

  const distinctOutlets = [...outlets].sort();
  return { distinctOutlets, outletCount: distinctOutlets.length };
}
