# Improvement Backlog
*Prioritized systemic work not yet shipped. Read top to bottom —
impact × effort is already in the order.*

**Last updated:** 2026-04-21

Legend:
- **Impact:** HIGH / MED / LOW — effect on reader-visible quality or
  cost per edition
- **Effort:** S (≤ 2 hours) / M (half a day) / L (multi-day)
- **Category:** A = agent-level, P = prompt-level, I = infrastructure,
  E = editorial

---

## Tier 1 — ship in the next 2 weeks (immediate payback)

### 1.2 Prompt caching on Localizer, Validator, QualityGate (HIGH / S / I)
Today only the Writer uses `cache_control` on the Voice Bible block.
The other three LLM agents load the same static templates every run
without caching. Add an ephemeral cache block to each prompt — the
first run pays full input cost, subsequent runs pay 10% of cached
tokens. Estimated cut: 40–60% of input-token cost on those three
agents, $0.15–0.25 saved per edition.

---

## Tier 2 — ship in the next month (compounding returns)

### 2.1 Insight history parallel to Apertura history (HIGH / M / E+P)
`src/utils/apertura-history.ts` loads Wadi's chosen Aperturas and
feeds them to the Writer / Localizer so future output matches his
style. Nothing analogous exists for the Insight — the hardest
section to get right. Add `src/utils/insight-history.ts` with the
same interface; hook it into `publish.ts` so approved editions write
their Insight body to `{lang}-insight-history.json`; load into the
Writer and Localizer prompts.

### 2.2 Localization memory CLI (`pnpm memory add ...`) (HIGH / S / E)
`config/localization-memory.json` has one entry after four months.
The data structure works (the Localizer prompt interpolates it), but
there is no CLI for Wadi to add a correction in under 10 seconds.
Write a `src/scripts/add-localization-correction.ts` tool that takes
`--en "X" --avoid "Y" --prefer "Z" --note "..."` and appends to the
JSON with a timestamp. Without this, the memory does not grow, and
the corrections for each edition stay in Wadi's head.

### 2.3 Diff of published edition vs generated draft (HIGH / M / E)
On `pnpm publish:edition`, diff the draft JSON against whatever Wadi
actually shipped (from Beehiiv or the approved file) and write the
edits to `docs/edits/{editionId}.md`. This is the gold feedback the
system needs to train future prompt iterations — it shows exactly
what the model got wrong in a way Wadi cared enough to fix.

### 2.4 In-pipeline Evaluator agent (MED / L / A)
The manual rubric run (`docs/EVALUATE-EDITION.md`) becomes a new
agent: after the Localizer finishes, `EvaluatorAgent` runs the rubric
on both EN and ES drafts using Sonnet 4.5 or Haiku 4.5, writes the
evaluation files to `docs/evaluations/`, and populates the `qaScore`
field on the edition. If `qaScore < 80`, the pipeline refuses to
publish until Wadi either fixes issues or overrides. Additional cost
per edition: ~$0.05.

### 2.5 Feed health tracker (MED / M / I)
29 of 81 RSS feeds fail on every run. A simple `config/feed-health.json`
tracks successive failures per feed; after N failures, the feed is
auto-paused and an issue is opened. Radar's log warnings become
actionable. Alternative feeds for 403 / 404 outlets are slotted in
via the same file.

### 2.6 Retry classifier in `BaseAgent` (MED / S / I)
Current retry is blind exponential backoff for any error. Split into:
- 429 / 5xx / timeouts → retry with backoff
- 400 / schema validation / banned-phrase failure → no retry, escalate
Saves tokens and time on unrecoverable errors.

### 2.8 Cohort benchmarks woven into Signal (HIGH / S / E+P)
The Signal today reports what is happening in the market. The reader
has to translate it into "where am I vs. peers." Add a rule to the
Strategist + Writer prompts: when a source-bundle item carries a
cohort statistic for the ICP segment ($5M–$150M owner-operated, MX
or US corridor), surface it as a peer mirror — *"X% of $20M–$50M
Mexican family businesses have an external board member. Where are
you?"* The Radar already pulls Coparmex, IMCO, ACG, Vistage; the
Strategist is not yet instructed to favour items with peer-cohort
data. Cost: prompt-only.

### 2.9 Failure post-mortem rotation in Field Report (HIGH / M / E+P)
McKinsey publishes case studies of success. Owner-operators learn
faster from failure. Once every three editions, the Field Report
rotates from "company worth studying" to "transformation effort
that failed." 200 words. The Strategist gets an additional rule:
when a source-bundle item names a cancelled ERP implementation, a
failed reorg, a board fight, an aborted M&A — flag it as
post-mortem-eligible. The Writer has a dedicated Field Report
sub-style for the post-mortem ("Effort. Failure point. What the
owner did not see coming. What it teaches the next operator."). The
Lincoln-International-style filings cited in recent runs are exactly
this material; we just have not given the agents permission to use
them this way.

### 2.10 Reader dilemma micro-section (replaces Door 1×/month) (MED / M / E+I)
Once a month, a reader writes in with a stuck decision; the issue
features that dilemma in place of (or alongside) the Door, with
Wadi's working-it-through response in 100–150 words. Three layers
needed: (a) an inbox / form (or a manual `pnpm dilemma add` script
that captures the submission to `config/reader-dilemmas.json`), (b)
a new Writer section type or a Door variant that loads the next
queued dilemma when the run-day matches the rotation, (c) a Validator
rule that the response is genuinely a working-through — not a sales
pitch for Wadi's services. This is the single highest-conversion
mechanism for the newsletter to grow into Wadi's consulting funnel
without becoming a marketing channel.

### 2.11 Compass evolution to owner inner-game (MED / S / E+P)
The Compass is currently "an open question Wadi is sitting with."
Tighten the prompt so the question is explicitly about the owner's
psychology of transformation — identity shift from doer to architect,
soltar control, miedo a la sucesión, soledad del dueño, faith /
character intersection. This is the only beat in the newsletter that
no large competitor (HBR, McKinsey, Strategy+Business, Lenny's,
First Round) covers consistently for the mid-market owner-operator.
Evolution, not new section: Compass stays at ~75 words; Validator's
"Compass genuineness" check tightens to require an inner-game pivot,
not just an intellectual one.

### 2.12 Tool variants for people / talent decisions (MED / S / E+P)
The Tool today over-indexes on systems and methodology. Transformation
is 80% people. Add a Tool sub-style for "people decision" templates:
*"Cómo entrevistar a un candidato a COO en 3 sesiones"*, *"Qué señales
buscar en un VP que ya no escala"*, *"Cómo armar la primera junta de
consejo independiente"*, *"Cuándo despedir al gerente leal pero
estancado"*. Strategist gets a coverage rule: at least 1 of every 4
Tool sections is a people decision. Writer gets a sub-style template.
Same word target.

---

## Tier 3 — opportunistic (high value, not urgent)

### 3.1 Banned phrases externalized (MED / S / E)
Today banned phrases are hard-coded in `src/agents/validator.ts` as
regex arrays. Move to `config/banned-phrases.{en,es}.json` so Wadi
can add new patterns without a code change. Connects to
`localization-memory.json`.

### 3.2 A/B subject line via Beehiiv (HIGH / S / I)
The Writer generates three subject lines (A direct, B curiosity,
C urgent) and the pipeline arbitrarily picks one. Beehiiv supports
subject-line A/B — push all three, let the provider pick the winner
by open rate. Feeds back into the Strategist's angle selection over
time.

### 3.3 Analytics feedback to Strategist (HIGH / L / A+I)
The Analyst pulls Beehiiv metrics into the run ledger, but the
Strategist does not read them. Cross-reference opens / CTR / replies
against each edition's `angle.headline`; feed the top-CTR angles as
"these resonated" context into the Strategist prompt. This is the
loop that would move the newsletter from "competent" to "growing."

### 3.4 Golden example auto-promotion (MED / S / I)
Policy in `EVALUATION-RUBRIC.md` says scores ≥ 90 are promoted to
`src/voice-bible/golden-examples/`. Automate: at the end of the
evaluation, if score ≥ 90, copy the rendered Markdown there with
the edition ID in the filename.

### 3.5 Rubric trend graph (LOW / M / I)
Tiny script that reads every file in `docs/evaluations/`, graphs
score-by-dimension over time, outputs to
`docs/evaluations/trends.md` (Markdown with embedded chart SVG).
Visible regression detection.

### 3.6 Supervisor is a stub (MED / L / A)
`src/agents/supervisor.ts` throws `NotImplemented`. The orchestrator
coordinates directly. For production resiliency, implement the
Supervisor as documented in `CLAUDE.md`: stateful run management,
retry arbitration, partial-failure handling, cost budget
enforcement.

---

## Recently shipped (do not re-implement)

- **Citation Guard false-positive fix** — italicized thread sentences
  no longer flagged as signal bullets (commits `07ea142`, `e756102`).
- **Hemingway + Mexican press register + 12-step self-check + `thesis`
  field** — PR #15 (`5e1c478`).
- **Core Zod schemas including `qaScore`** — PR #14 (`a675a9a`).
- **Docs alignment and evaluation framework** — commits `defe499`,
  `c5bf2be`, `1dab8e4`.
- **1.1 Deterministic bullet-stripper in Writer** — already in
  production. `WriterAgent.repairInsightBullets` (src/agents/writer.ts)
  runs a targeted Sonnet 4.6 rewrite pass whenever `hasBulletPoints`
  matches in the Insight body. Cost ~$0.02 when triggered, $0
  otherwise.
- **1.6 Validator counts in deterministic code** — already in
  production. `src/agents/validator.ts` computes word counts,
  banned-phrase detection, bullet detection, and long-sentence
  detection in code; the LLM pass is reserved for qualitative
  judgments (reframe, misdiagnosis, shareable sentence, OS pillar
  consistency, Compass genuineness, Apertura mid-thought).
- **1.7 Source-diversity in deterministic code** — `src/utils/source-diversity.ts`
  parses markdown links from the English draft and maps them to
  outlets via the SourceBundle. `QualityGateAgent.execute` overrides
  the LLM's count with the computed value.
- **1.2 Prompt caching on Localizer, Validator, QualityGate** — all
  three now put their full prompt in a system block marked with
  `cache_control: { type: "ephemeral" }`. Matches the Writer pattern.
  Within-run retries and same-session reruns hit the cache at ~10%
  of input cost.
- **1.3 Signal word count hard-retry** — `WriterAgent.repairSignalLength`
  mirrors `repairInsightBullets`: after the main Writer call, if the
  Signal body exceeds 185 words, a Sonnet 4.6 trim pass runs. The
  repair preserves the italicized thread sentence, the four pillar
  bullets in order, and every `[Read ->](url)` link; it only shortens
  the implication sentences. Cost when triggered: ~$0.02. Cost when
  not triggered: $0. The Validator still reports the final count as
  a warning if the repair itself overshoots; that is a second line
  of defense, not the primary check.
- **1.4 SourceBundle snapshot for replay** — `src/utils/source-bundle-snapshot.ts`
  writes `drafts/{editionId}-sources.json` after Radar returns.
  `src/run.ts` checks for the snapshot before running Radar and loads
  it instead of rescanning RSS when present. Makes pipeline reruns
  deterministic: a Writer failure no longer invalidates the
  Strategist's angle with a fresh news window.
- **1.5 End-to-end smoke tests** — `tests/helpers/fake-anthropic.ts`
  provides a queueable fake of the Anthropic SDK;
  `tests/integration/pipeline-smoke.test.ts` wires real agents to it
  and asserts the three coordination invariants that past bugs have
  violated: (1) LocalizerAgent populates `thesis` in ES output so the
  "Resumen del Insight" render does not leak English; (2) QualityGate
  overrides the LLM's `sourceDiversity` with the deterministic count;
  (3) Validator's `wordCounts` and `score` come from code, not the
  LLM. Future agent-level changes now have a safety net.
- **1.8 Deterministic banned-phrase stripper in Writer** —
  `src/utils/banned-phrases.ts` is now the single source of truth for
  the voice-bible ban list (Validator refactored to import from it).
  `WriterAgent.repairBannedPhrases` runs a Sonnet 4.6 rewrite pass on
  every prose section (Signal, Apertura options, Insight, Field
  Report, Tool, Compass, Subject, Preheader) whenever a banned phrase
  is detected. The scan is O(n) regex; the LLM call only fires on
  match. Shipped after edition 2026-24 reached the Validator with
  "disruption" in the Insight despite the Writer prompt's 12-step
  self-check banning it. Mirrors the same pattern as 1.1
  (bullet-stripper) and 1.3 (signal length).
- **2.7 Regional anchoring — hybrid US / MX architecture** —
  `SourceItemSchema.region: "us" | "mx" | "corridor"` propagates from
  `FeedConfig.region` at Radar construction (global→corridor, us→us,
  latam→mx). The `LocalizerAgent` receives the full `SourceBundle`,
  filters to MX + corridor items via `filterMxBundle`, and renders
  them as a `{{mxSourceBundle}}` block in the prompt. The localizer
  prompt now operates in dual mode: TRANSCREATE the Insight, Tool,
  Apertura, thesis, subject, preheader (universal across regions);
  AUTHOR fresh the Signal bullets, Field Report, and Compass from the
  MX source pool. Citation discipline same as Writer — only items
  present in the MX bundle are eligible for inline links in the
  authored sections. Empty-bundle fallback: keep EN content with
  honest reframing for Mexican reader rather than fabricate. Two new
  smoke tests verify the prompt contains MX/corridor items and
  excludes US-only items, plus the empty-bundle fallback message.

---

## How to work this backlog

1. Pick one item from Tier 1. Ship it. Mark it below under "Recently
   shipped" with the commit hash.
2. Re-score Tier 1 / Tier 2 after each ship — priorities shift.
3. Every prompt iteration from `docs/evaluations/*.md` surfaces new
   small items; fold them in at their right tier.
4. When a Tier 1 item grows to Tier 2 size during implementation, say
   so and re-triage instead of pushing through.

The point of this file is to make the invisible visible: the
difference between the product today and the product the
documentation describes.
