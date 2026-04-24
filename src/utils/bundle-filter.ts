import type { SourceBundle, SourceItem } from "../types/source-bundle.js";

/**
 * Regional filters for the SourceBundle. The Localizer uses the MX filter to
 * author the ES Signal/Field Report/Compass from MX-relevant items; the
 * Writer uses the US filter so the EN edition anchors in US (or universal
 * corridor) news rather than reaching for MX-only items that belong in the
 * ES edition. Corridor items are eligible for either edition — they are the
 * trans-border business research, consulting, and policy feeds that speak
 * to both readers.
 */

export function filterUsBundle(items: SourceItem[]): SourceItem[] {
  return items.filter(
    (item) => item.region === "us" || item.region === "corridor",
  );
}

export function filterMxBundle(items: SourceItem[]): SourceItem[] {
  return items.filter(
    (item) => item.region === "mx" || item.region === "corridor",
  );
}

/** Convenience wrappers when the caller holds a full bundle. */
export function filterUsItems(bundle: SourceBundle): SourceItem[] {
  return filterUsBundle(bundle.items);
}

export function filterMxItems(bundle: SourceBundle): SourceItem[] {
  return filterMxBundle(bundle.items);
}
