import { describe, it, expect } from "vitest";
import {
  replaceMxEntities,
  replaceContentMxEntities,
} from "../../src/utils/mx-entity-replacer.js";
import type { LocalizedContent } from "../../src/types/edition.js";

describe("replaceMxEntities", () => {
  it("replaces 'Comisión Nacional Antimonopolio' with COFECE on first mention", () => {
    const body = "La Comisión Nacional Antimonopolio demandó a 53 distribuidoras.";
    const { output, report } = replaceMxEntities(body);
    expect(output).toContain("COFECE (Comisión Federal de Competencia Económica)");
    expect(output).not.toContain("Comisión Nacional Antimonopolio");
    expect(report).toHaveLength(1);
    expect(report[0]?.occurrences).toBe(1);
  });

  it("uses the acronym on subsequent mentions to avoid verbosity", () => {
    const body =
      "Comisión Nacional Antimonopolio ha investigado ese sector antes. " +
      "Esta semana, Comisión Nacional Antimonopolio demandó a 53 distribuidoras.";
    const { output } = replaceMxEntities(body);
    // First occurrence: full canonical name.
    expect(output).toContain("COFECE (Comisión Federal de Competencia Económica) ha investigado");
    // Second occurrence: acronym only, no repeated long form.
    expect(output).toContain("Esta semana, COFECE demandó");
    // There's exactly one full canonical name in the output.
    const longForms = output.match(/Comisión Federal de Competencia Económica/g);
    expect(longForms?.length).toBe(1);
  });

  it("replaces 'IRS mexicano' with SAT", () => {
    const { output } = replaceMxEntities("El IRS mexicano impuso una multa.");
    expect(output).toContain("SAT (Servicio de Administración Tributaria)");
    expect(output).not.toContain("IRS mexicano");
  });

  it("replaces 'SEC mexicana' with CNBV", () => {
    const { output } = replaceMxEntities("La SEC mexicana reguló la emisión.");
    expect(output).toContain("CNBV (Comisión Nacional Bancaria y de Valores)");
  });

  it("replaces 'Fed mexicano' with Banxico", () => {
    const { output } = replaceMxEntities("El Fed mexicano subió tasas.");
    expect(output).toContain("Banxico");
  });

  it("leaves correct Mexican names untouched", () => {
    const body =
      "COFECE multó a 53 distribuidoras. El SAT publicó nuevas reglas. " +
      "Banxico mantuvo la tasa. CNBV aprobó la emisión.";
    const { output, report } = replaceMxEntities(body);
    expect(output).toBe(body);
    expect(report).toHaveLength(0);
  });

  it("returns empty report when no calques are present", () => {
    const { report } = replaceMxEntities("Este texto no tiene entidades calcadas.");
    expect(report).toHaveLength(0);
  });
});

describe("replaceContentMxEntities", () => {
  it("applies replacements across all sections and aggregates the report", () => {
    const content: LocalizedContent = {
      language: "es",
      subject: "s",
      preheader: "p",
      sections: [
        {
          id: "a",
          type: "news",
          heading: "LA SEÑAL",
          body: "La Comisión Nacional Antimonopolio demandó a gasoleras.",
          sourceRefs: [],
        },
        {
          id: "b",
          type: "analysis",
          heading: "EL INSIGHT",
          body: "El IRS mexicano publicó reglas. La Comisión Nacional Antimonopolio ya había investigado.",
          sourceRefs: [],
        },
      ],
    };
    const { content: out, report } = replaceContentMxEntities(content);
    expect(out.sections[0]?.body).toContain("COFECE");
    expect(out.sections[1]?.body).toContain("SAT");
    expect(out.sections[1]?.body).toContain("COFECE");
    // Aggregated report includes both kinds
    const notes = report.map((r) => r.note);
    expect(notes).toContain("Comisión Nacional Antimonopolio → COFECE");
    expect(notes).toContain("IRS mexicano → SAT");
  });

  it("returns empty report when no sections contain calques", () => {
    const content: LocalizedContent = {
      language: "es",
      subject: "s",
      preheader: "p",
      sections: [
        {
          id: "a",
          type: "analysis",
          heading: "EL INSIGHT",
          body: "Texto limpio sin entidades mal nombradas.",
          sourceRefs: [],
        },
      ],
    };
    const { report } = replaceContentMxEntities(content);
    expect(report).toHaveLength(0);
  });
});
