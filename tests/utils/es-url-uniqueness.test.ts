import { describe, it, expect } from "vitest";
import { findEsFieldReportDuplicates } from "../../src/utils/es-url-uniqueness.js";
import type { LocalizedContent } from "../../src/types/edition.js";

function mkContent(signalBody: string, fieldReportBody: string): LocalizedContent {
  return {
    language: "es",
    subject: "s",
    preheader: "p",
    sections: [
      { id: "a", type: "news", heading: "LA SEÑAL", body: signalBody, sourceRefs: [] },
      { id: "b", type: "spotlight", heading: "EL REPORTE DE CAMPO", body: fieldReportBody, sourceRefs: [] },
    ],
  };
}

describe("findEsFieldReportDuplicates", () => {
  it("returns empty when Signal and Field Report cite different URLs", () => {
    const content = mkContent(
      "- **Estrategia:** a. **b.** [Leer ->](https://expansion.mx/x)",
      "Field Report about [Grupo Bimbo](https://elfinanciero.com.mx/y).",
    );
    expect(findEsFieldReportDuplicates(content)).toEqual([]);
  });

  it("flags the exact duplicate case from edition 2026-26 (FR cites a Signal URL)", () => {
    const signal =
      "- **Estrategia:** México llega al T-MEC el 26 de mayo. **punch.** [Leer ->](https://expansion.mx/economia/tmec-ebrard)\n" +
      "- **Modelos Operativos:** COFECE demanda a 53 distribuidoras. **punch.** [Leer ->](https://elceo.com/gas-lp)";
    const fieldReport =
      "El martes, Marcelo Ebrard [presentó el equipo](https://expansion.mx/economia/tmec-ebrard) para la revisión del T-MEC.";
    const dups = findEsFieldReportDuplicates(mkContent(signal, fieldReport));
    expect(dups).toHaveLength(1);
    expect(dups[0]?.url).toBe("https://expansion.mx/economia/tmec-ebrard");
    expect(dups[0]?.signalPillar).toBe("Estrategia");
  });

  it("handles Field Report with no URLs (sector framing)", () => {
    const content = mkContent(
      "- **Estrategia:** a. **b.** [Leer ->](https://expansion.mx/x)",
      "En el segmento medio mexicano, el patrón que se ve esta semana es sectorial — sin empresa nombrada.",
    );
    expect(findEsFieldReportDuplicates(content)).toEqual([]);
  });

  it("handles multiple Field Report URLs, flags only those also in Signal", () => {
    const signal = "- **Estrategia:** a. **b.** [Leer ->](https://expansion.mx/x)";
    const fieldReport =
      "Story cites [Source A](https://expansion.mx/x) and [Source B](https://milenio.com/y).";
    const dups = findEsFieldReportDuplicates(mkContent(signal, fieldReport));
    expect(dups).toHaveLength(1);
    expect(dups[0]?.url).toBe("https://expansion.mx/x");
  });

  it("returns empty when Signal or Field Report is missing", () => {
    const content: LocalizedContent = {
      language: "es",
      subject: "s",
      preheader: "p",
      sections: [
        { id: "a", type: "news", heading: "LA SEÑAL", body: "- **E:** a. [Leer ->](https://x.com)", sourceRefs: [] },
        // no spotlight
      ],
    };
    expect(findEsFieldReportDuplicates(content)).toEqual([]);
  });
});
