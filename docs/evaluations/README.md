# Edition Evaluations
*One file per language per edition. The record of how the newsletter
improved.*

Each evaluation scores a single draft against `docs/EVALUATION-RUBRIC.md`
and saves the result here. Both the manual evaluator command
(`docs/EVALUATE-EDITION.md`) and the future in-pipeline Evaluator
agent write to this folder using the same format.

---

## Filename convention

`{editionId}-{lang}.md`

- `editionId` follows the schema regex in `src/types/enums.ts`:
  `YYYY-WW` (ISO week). Example: `2026-20`.
- `lang` is `en` or `es`.

Examples:
- `2026-20-en.md`
- `2026-20-es.md`
- `2026-21-en.md`

One file per language per edition. Never more. If an edition is
re-evaluated under a new rubric version, overwrite — the rubric version
is recorded inside the file, so the diff in git history preserves
the prior score.

---

## File contents

Exactly the deliverable format defined in
`docs/EVALUATION-RUBRIC.md` → *Deliverable format*. Do not deviate. The
format is parseable by tooling (score trends, golden example
promotion, prompt-iteration backlog updates), so consistency matters
more than creativity.

---

## Lifecycle

1. Pipeline produces draft (`drafts/{editionId}-{lang}.md`).
2. Evaluator (manual today, agent soon) scores it, writes to
   `docs/evaluations/{editionId}-{lang}.md`.
3. Wadi reads the evaluation, applies the pre-publish actions to
   the draft, optionally re-evaluates.
4. Edition publishes. `qaScore` is recorded on the edition's run ledger.
5. If the published edition scored ≥ 90, the rendered Markdown is
   promoted to `src/voice-bible/golden-examples/` as future Writer /
   Localizer reference. The evaluation file itself stays here.
6. Top 3 "prompt iterations for next edition" items are triaged into
   the Writer / Localizer prompt changes before the next run.

---

## What this folder is not

- **Not a draft folder.** Drafts live in `drafts/` and are gitignored.
  Evaluations of drafts live here and are committed.
- **Not a publishing log.** The run ledger is the source of truth for
  what shipped, when, to whom. These evaluations are about craft
  quality, not distribution.
- **Not edited by humans after the fact.** If a score needs revision,
  re-evaluate the edition and overwrite the file. Git preserves the
  history.
