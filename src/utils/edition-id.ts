/**
 * ISO 8601 week number for the given date (1–53).
 * Moves to the nearest Thursday to determine which week-year the date belongs to.
 */
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Returns the YYYY-WW edition identifier for the given date (defaults to now).
 *
 * Uses ISO 8601 week-year (not calendar year) so that dates straddling year
 * boundaries (e.g. Dec 30–31) map to the correct edition.
 * Example: 2024-12-30 → "2025-01", not "2024-01".
 */
export function getCurrentEditionId(override?: string, date?: Date): string {
  if (override) return override;
  const now = date ?? new Date();

  // Shift to the nearest Thursday — that Thursday's calendar year IS the ISO week-year
  const thursday = new Date(now);
  thursday.setHours(0, 0, 0, 0);
  thursday.setDate(thursday.getDate() + 4 - (thursday.getDay() || 7));

  const isoYear = thursday.getFullYear();
  const week = String(getISOWeek(now)).padStart(2, "0");
  return `${isoYear}-${week}`;
}
