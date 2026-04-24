import type { LocalizedContent } from "../types/edition.js";

/**
 * Deterministic fix for Mexican regulator / agency names that the ES Writer
 * has been caught translating literally or inventing. The self-check Paso
 * 6.3 tells the model to use the correct Mexican names, but Opus has shipped
 * "Comisión Nacional Antimonopolio" multiple times — the model ignored
 * its own instruction.
 *
 * These replacements are narrow and safe: we only match strings that are
 * unambiguous calques of US/English agency names, and we replace them with
 * the correct Mexican acronym + full name on first mention. The set is
 * small on purpose — we're fixing a specific drift, not translating
 * everything.
 */

interface Replacement {
  pattern: RegExp;
  canonical: string;
  note: string;
}

const REPLACEMENTS: Replacement[] = [
  {
    pattern: /\bComisi[óo]n Nacional Antimonopolio\b/g,
    canonical: "COFECE (Comisión Federal de Competencia Económica)",
    note: "Comisión Nacional Antimonopolio → COFECE",
  },
  {
    pattern: /\bComisi[óo]n Antimonopolios?\b/g,
    canonical: "COFECE",
    note: "Comisión Antimonopolio → COFECE",
  },
  {
    pattern: /\bFTC mexicana\b/gi,
    canonical: "COFECE",
    note: "FTC mexicana → COFECE",
  },
  {
    pattern: /\bSEC (mexicana|de México)\b/gi,
    canonical: "CNBV (Comisión Nacional Bancaria y de Valores)",
    note: "SEC mexicana → CNBV",
  },
  {
    pattern: /\bIRS (mexicano|de México)\b/gi,
    canonical: "SAT (Servicio de Administración Tributaria)",
    note: "IRS mexicano → SAT",
  },
  {
    pattern: /\bServicio de Impuestos Mexicano\b/g,
    canonical: "SAT (Servicio de Administración Tributaria)",
    note: "Servicio de Impuestos Mexicano → SAT",
  },
  {
    pattern: /\bSeguro Social mexicano\b/gi,
    canonical: "IMSS",
    note: "Seguro Social mexicano → IMSS",
  },
  {
    pattern: /\bFed (mexicano|de México)\b/gi,
    canonical: "Banxico",
    note: "Fed mexicano → Banxico",
  },
  {
    pattern: /\bdepartamento del trabajo mexicano\b/gi,
    canonical: "STPS (Secretaría del Trabajo y Previsión Social)",
    note: "departamento del trabajo mexicano → STPS",
  },
];

export interface EntityReplacementReport {
  note: string;
  occurrences: number;
}

export function replaceMxEntities(
  body: string,
): { output: string; report: EntityReplacementReport[] } {
  let output = body;
  const report: EntityReplacementReport[] = [];
  for (const { pattern, canonical, note } of REPLACEMENTS) {
    const matches = output.match(pattern);
    if (!matches || matches.length === 0) continue;
    // First mention gets the full canonical; subsequent mentions get just
    // the acronym (to avoid "COFECE (Comisión Federal…)" repeated five times
    // in the same paragraph).
    let first = true;
    output = output.replace(pattern, () => {
      if (first) {
        first = false;
        return canonical;
      }
      // Extract the acronym (text before the first space/paren) as the
      // short form for subsequent mentions.
      const shortForm = canonical.split(/[\s(]/)[0] ?? canonical;
      return shortForm;
    });
    report.push({ note, occurrences: matches.length });
  }
  return { output, report };
}

export function replaceContentMxEntities(
  content: LocalizedContent,
): { content: LocalizedContent; report: EntityReplacementReport[] } {
  const aggregated = new Map<string, number>();
  const sections = content.sections.map((s) => {
    const { output, report } = replaceMxEntities(s.body);
    for (const r of report) {
      aggregated.set(r.note, (aggregated.get(r.note) ?? 0) + r.occurrences);
    }
    return { ...s, body: output };
  });
  const report: EntityReplacementReport[] = Array.from(aggregated.entries()).map(
    ([note, occurrences]) => ({ note, occurrences }),
  );
  return { content: { ...content, sections }, report };
}
