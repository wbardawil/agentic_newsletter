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
6. NO recortes a un resumen. La salida tiene la misma longitud aproximada que la entrada — refinas, no comprimes.

QUÉ REESCRIBIR (con ejemplos antes/después):

**Calcos de inglés (los más comunes):**
- "al final del día" → "al fin de cuentas" / "en última instancia"
- "mover la aguja" → "hacer una diferencia real" / "cambiar el resultado"
- "hacer sentido" → "tener sentido"
- "en orden de" → "para"
- "tomar una decisión" → "decidir"
- "estar en la misma página" → "coincidir" / "estar de acuerdo"
- "ir hacia adelante" → "avanzar" / "seguir"
- "alrededor de X% de" → "cerca del X%" / "en torno al X%"
- "agregar valor" → "aportar valor" / "sumar valor"
- "en el largo plazo" → "a largo plazo" / "en el horizonte"
- "tener un impacto en" → "incidir en" / "afectar a"

**Frases que huelen a inglés (reescribir el shape):**
- "la forma más rápida de empezar a X" → "lo primero es X"
- "cada X se vuelve Y" → "cada X termina siendo Y" / "todo X acaba como Y"
- "el tipo de Y que Z" → "una Y que Z" (eliminar "el tipo de")
- "es importante notar que" → "conviene señalar que" / "cabe recordar que"
- "una de las cosas que" → "lo que" / "algo que"

**Sintaxis traducida:**
- Pasiva: "el reporte fue publicado por la empresa" → activa "la empresa publicó el reporte" o se: "se publicó el reporte"
- Posesivo redundante: "alzó su mano" → "alzó la mano"
- Gerundio como sujeto: "Implementando un ERP es difícil" → "Implementar un ERP es difícil"
- Stack de "de": "la estrategia de expansión de la empresa de la familia del fundador" → "la estrategia expansiva de la empresa familiar"
- "que" pronombre sobreusado: "la empresa que es propiedad de" → "la empresa propiedad de"

**Metáforas inglesas que no viajan:**
- "aterrizar una idea en" → "instalar una idea en" / "que la idea permee en"
- "hacer legible el lenguaje a escala" → reescribir; esa frase no existe en español de negocios
- "subir la barra" → "elevar el estándar"
- "low-hanging fruit" / "la fruta baja" → "lo más accesible" / "los logros rápidos"

**Aperturas de párrafo prohibidas (reescribir o cortar):**
- "En el mundo de hoy" / "En un entorno cada vez más competitivo" / "Hoy en día"
- "Las empresas deben" / "Es crucial que las empresas" / "Es fundamental"
- "Siendo el sector…" (gerundio absoluto inicial)
- "Con la llegada de" / "Con el surgimiento de"

**Verbosidad nominalizada (preferir el verbo):**
- "la toma de decisiones" → "decidir"
- "el establecimiento de" → "establecer"
- "la implementación de" → "implementar"
- "la realización de un análisis" → "analizar"

**Conectores pobres (rotar; nunca repetir y/pero dos veces en un párrafo):**
- Adversativos: *sin embargo, no obstante, en cambio, ahora bien, con todo, por el contrario, y, sin embargo,*
- Consecutivos: *de ahí que* (+ subjuntivo), *por lo que, motivo por el cual, así las cosas*
- Aditivos: *además, a ello se suma, a lo que hay que añadir, no solo… sino (que)…*
- Matizadores: *a saber, conviene recordar, cabe señalar, en rigor, en realidad, dicho de otro modo*

**Aposición sin verbo (más nativo que la cláusula relativa):**
- Translated: "Roberto Treviño, que es el dueño de Grupo Treviño…"
- Native: "Roberto Treviño, dueño de Grupo Treviño…"

**Cierres nominales (cuando el párrafo necesita aterrizar):**
- "Una paradoja." / "Un síntoma." / "Una decisión limpia." / "Un patrón conocido."

QUÉ MANTENER:
- Nombres de marca y framework en inglés (Operating Model OS, Strategy OS, Fathom, Claude Projects).
- Acrónimos mexicanos (COFECE, CNBV, SAT, IMSS, Banxico, T-MEC, STPS, PROFECO, INEGI, SHCP, SE).
- Anglicismos aceptados por la prensa MX: fintech, startup, pyme, mipyme, nearshoring, e-commerce, marketplace, wallet, ETF, ESG, venture capital, private equity, board, CEO, CFO, COO.
- Cifras y nombres propios — verbatim siempre.

ENTREGA: solo el texto reescrito, mismo formato, misma longitud aproximada, sin preámbulo, sin comentario.`;

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
