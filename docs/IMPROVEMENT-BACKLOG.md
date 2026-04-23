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

### 1.3 Signal word count hard-retry (MED / S / P)
The Signal consistently comes in at 195–210 words against the 185
cap. The self-check notices and the model ignores. Convert the
word-count check into a deterministic retry: if `signal.split(/\s+/)`
exceeds 185, make one Haiku pass with a targeted trim prompt.
Same mechanism as 1.1, different trigger.

### 1.4 SourceBundle snapshot for replay (HIGH / M / I)
At the end of Radar, write the full SourceBundle to
`drafts/{editionId}-sources.json`. If the orchestrator detects the
snapshot on a subsequent run, use it instead of rescanning RSS. Gives
deterministic replay when a downstream agent fails — today, rerunning
after a Writer failure pulls a different corridor news window and
invalidates the Strategist's angle.

### 1.5 End-to-end smoke test (HIGH / M / I)
One integration test that mocks `anthropic.messages.stream` and runs
the pipeline end-to-end for a fixed SourceBundle fixture. Asserts:
draft JSON is valid, ES has `thesis` populated, Citation Guard flags
nothing, Validator score ≥ 70. Would have caught the English-leakage
`thesis` bug before production. Currently there are 148 unit tests
and zero integration tests.

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
