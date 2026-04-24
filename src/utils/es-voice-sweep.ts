import type Anthropic from "@anthropic-ai/sdk";
import type { LocalizedContent } from "../types/edition.js";
import type { CostTracker } from "./cost-tracker.js";

/**
 * Voice sweep — a Sonnet pass over the ES body that rewrites translation-
 * tells (calques, non-native syntax, gerund openers, 'de de de' stacks)
 * in native Mexican business-press register. Preserves every fact, every
 * named company, every URL, every number, and every Markdown link.
 *
 * Rationale: the 18-step self-check inside the Localizer prompt asks the
 * model to scan for these patterns, but Opus has shipped calques anyway
 * multiple times. A dedicated Sonnet pass with ONE job (voice) and the
 * anti-calque rules in front of it is more reliable — and at Sonnet
 * pricing, adding ~$0.05-0.10 to the run is worth the voice delta.
 */

const SWEEP_MODEL = "claude-sonnet-4-6";

// Sections worth sweeping. The Door is a fixed template (no prose). The
// Signal has its own repair passes inside Opus; sweeping it too risks
// breaking the strict bullet shape the Validator expects.
const SWEEP_SECTION_TYPES = new Set([
  "lead", // Apertura
  "analysis", // Insight
  "spotlight", // Field Report
  "tool", // Tool
  "quickTakes", // Compass
]);

const SWEEP_SYSTEM = `Eres editor de prensa de negocios mexicana (Expansión, El Financiero, Whitepaper.mx, El País economía).
Recibes un texto en español que fue producido por un traductor y lo refines a voz mexicana nativa.

REGLAS INVIOLABLES:
1. NO cambies ningún número, fecha, porcentaje, nombre de empresa, nombre de persona, URL, ni contenido dentro de links Markdown [texto](url).
2. NO agregues afirmaciones nuevas. NO borres afirmaciones existentes.
3. NO cambies el contenido dentro de **negritas** (son punch lines editoriales — respétalas tal cual).
4. NO alteres el formato Markdown: mismos bullets, mismos párrafos, mismos links, mismos headers.
5. El registro es Mexican business press. Usted, no tú. Sin lunfardo, sin castellano de España.

QUÉ REESCRIBIR (busca esto y refínalo):
- Calcos de inglés: "al final del día", "mover la aguja", "hacer sentido", "en orden de", "tomar una decisión" → *"al fin de cuentas"*, *"hacer una diferencia real"*, *"tener sentido"*, *"para"*, *"decidir"*.
- Frases que huelen a inglés: "la forma más rápida de empezar a" → *"lo primero es"*; "cada X se vuelve Y" → *"cada X termina siendo Y"*; "el tipo de Y que Z" → reformular sin *"el tipo de"*.
- Sintaxis inglesa: pasiva excesiva, posesivos redundantes (su mano → la mano), gerundios como sujeto, stacks de *de de de*.
- Metáforas que no viajan: *"aterrizar una idea en"*, *"el piso institucional"*, *"hacer legible el lenguaje a escala"*.
- Aperturas de párrafo con *"En el mundo de hoy"*, *"En un entorno cada vez más competitivo"*, *"Siendo el sector…"*.
- Verbosidad traducida: *"la toma de decisiones"* → *"decidir"*; *"el establecimiento de"* → *"establecer"*; nominalizaciones innecesarias.
- Conectores pobres: *y / pero* repetidos como únicos conectores → rotar (*sin embargo, no obstante, en cambio, ahora bien, de ahí que, a ello se suma*).

QUÉ MANTENER:
- Nombres de marca y framework en inglés (Operating Model OS, Strategy OS, Fathom, Claude Projects).
- Acrónimos mexicanos correctos (COFECE, CNBV, SAT, IMSS, Banxico, T-MEC, STPS, PROFECO).
- Anglicismos aceptados por la prensa MX: fintech, startup, pyme, mipyme, nearshoring, e-commerce, marketplace, wallet, ETF, ESG, venture capital, private equity.

ENTREGA: solo el texto reescrito, mismo formato, sin preámbulo, sin comentario.`;

interface SweepClient {
  anthropic: Anthropic;
}

export async function runVoiceSweep(
  content: LocalizedContent,
  client: SweepClient,
  costTracker: CostTracker,
  logger: { info: (msg: string) => void; warn: (msg: string) => void },
): Promise<LocalizedContent> {
  const sweptSections = await Promise.all(
    content.sections.map(async (s) => {
      if (!SWEEP_SECTION_TYPES.has(s.type)) return s;
      if (!s.body.trim()) return s;

      try {
        const response = await client.anthropic.messages.create({
          model: SWEEP_MODEL,
          max_tokens: 4000,
          system: SWEEP_SYSTEM,
          messages: [
            {
              role: "user",
              content:
                `Sección: ${s.type}\n\n` +
                `Texto a refinar (preserva números, URLs, **negritas** y Markdown):\n\n${s.body}`,
            },
          ],
        });
        costTracker.recordUsage(
          SWEEP_MODEL,
          response.usage.input_tokens,
          response.usage.output_tokens,
        );
        const block = response.content[0];
        const rewritten = block?.type === "text" ? block.text.trim() : s.body;
        // Sanity: don't accept a sweep that dropped more than half the
        // original length — probably the model misunderstood and rewrote
        // into a summary instead of refining.
        if (rewritten.length < s.body.length * 0.5) {
          logger.warn(
            `Voice sweep on [${s.type}] produced a much shorter body (${s.body.length} → ${rewritten.length} chars) — keeping original`,
          );
          return s;
        }
        logger.info(`Voice sweep on [${s.type}] applied (${s.body.length} → ${rewritten.length} chars)`);
        return { ...s, body: rewritten };
      } catch (err) {
        logger.warn(
          `Voice sweep on [${s.type}] failed: ${err instanceof Error ? err.message : String(err)} — keeping original`,
        );
        return s;
      }
    }),
  );

  return { ...content, sections: sweptSections };
}
