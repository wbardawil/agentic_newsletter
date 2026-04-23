# Evaluate an Edition
*How to run the quality rubric against a draft in any Claude, Codex, or
similar session.*

The rubric itself lives in `docs/EVALUATION-RUBRIC.md`. This file is
the how-to.

---

## The command

Paste this prompt into a fresh session of any capable model. Replace
the edition ID and language.

```
You are evaluating a draft of The Transformation Letter against its
published quality rubric.

Read these files from the repo in this order:
  1. docs/EVALUATION-RUBRIC.md   (the rubric, bands, deliverable format)
  2. docs/NEWSLETTER-FORMAT.md   (the seven fixed sections)
  3. docs/ICP.md                 (the reader)
  4. docs/BRAND.md               (voice, what we never claim)
  5. drafts/2026-20-en.md        (the draft to evaluate — change the filename)

Score the draft against the rubric. Produce the deliverable exactly in
the format defined in EVALUATION-RUBRIC.md. Save your output to
docs/evaluations/2026-20-en.md (change the filename to match).

Do not change code. Do not touch git. This is evaluation only.
```

For the Spanish edition, change the draft filename to `-es.md` and
ensure the evaluator also produces the **ES purity check** block at
the end (calques, anglicisms, gerunds, formatting).

---

## Where evaluations live

`docs/evaluations/{editionId}-{lang}.md`

Examples:
- `docs/evaluations/2026-20-en.md`
- `docs/evaluations/2026-20-es.md`

These files are committed to the repo. The history is the record of
how the newsletter's craft evolved week-over-week.

---

## Publish threshold

- **≥ 80:** cleared to send after acting on the pre-publish list.
- **70–79:** needs a manual revision pass; fix top 3 issues and
  re-evaluate before send.
- **< 70:** do not publish in current state. Rewrite from the Writer /
  Localizer.

This is enforced by Wadi today. A future Evaluator agent will block
the publish step automatically when `qaScore < 80`.

---

## After the evaluation

Two feedback loops happen with every evaluation:

1. **Pre-publish actions** — fix the top 3 issues in the draft before
   sending the edition.
2. **Prompt iterations** — the evaluator's systemic suggestions go into
   a follow-up review. Each accepted iteration becomes a change to
   `config/prompts/writer.md` or `config/prompts/localizer.md` before
   the next edition runs.

See `docs/IMPROVEMENT-BACKLOG.md` for the in-flight list.

---

## When the Evaluator agent ships

This manual process is the v1. Item 3.4 in the improvement backlog is
an in-pipeline Evaluator agent using Sonnet or Haiku that runs the
rubric automatically after Writer / Localizer and populates the
`qaScore` field on the run ledger without human intervention. Once
that ships:

- The manual prompt above becomes a fallback.
- `docs/evaluations/` keeps the same format — the agent writes there.
- `qaScore < 80` blocks `pnpm publish:edition`.

Until then: run the manual command every week, both languages.
