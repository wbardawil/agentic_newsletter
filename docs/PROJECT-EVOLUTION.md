# Project Evolution
*Where this project came from, why it has the shape it has today, and
what that implies for the work ahead.*

**Last updated:** 2026-04-21

This document exists because the newsletter pipeline evolved faster
than its docs, and any new contributor — including Wadi coming back
to the code after a month away, or another model picking up a
session — needs the narrative, not just the current state.

---

## Phase 1 — Editorial design (docs first)

Before the code, the product was documented:

- `docs/BRAND.md` — Wadi, the Business Transformation OS framework,
  what the publication never claims.
- `docs/ICP.md` — the operator it is written for ($5M–$100M, corridor,
  humble enough to read it).
- `docs/CONTENT-STRATEGY.md` — three OS pillars, quarterly narrative
  arcs, topic boundaries.
- `docs/NEWSLETTER-FORMAT.md` — five fixed sections: Apertura, Insight,
  Field Report, Compass, Door. 900–1,000 words. Compass as "a genuine
  open question." Door as ~50 words of fixed text.

These four are the north star. None of them were wrong in principle.

---

## Phase 2 — Pipeline build (code catches up, then passes)

The multi-agent pipeline was built to produce the issue weekly without
Wadi writing from scratch each Tuesday. Ten agents, orchestrated:

Supervisor → Radar → Strategist → Writer → Validator → Localizer →
QualityGate → Distributor / Amplifier / Analyst.

Through real usage, two editorial adjustments emerged and stuck:

1. **THE SIGNAL was added as Section 1.** A 110-word weekly news
   synthesis with four pillar bullets (Strategy, Operating Models,
   Technology, Human Capital). Without it, the Apertura felt
   disconnected from the week the reader was living. With it, the
   issue anchors in the corridor's current reality before any opinion
   is offered.
2. **THE TOOL was added between Field Report and Compass.** A named,
   60-word artifact the reader uses Monday morning. Without it,
   readers reported loving the Insight and not knowing what to do
   with it. With it, every issue ends with one concrete action the
   operator can take.

Both changes shipped in the code but `docs/NEWSLETTER-FORMAT.md` was
not updated. The `2026-04-21 docs alignment` commit reconciled the
doc to production reality: seven sections, 1,000–1,200 words, Compass
as a trackable signal, Door as the three-line CTA block.

---

## Phase 3 — Voice hardening (EN Hemingway + ES Mexican press register)

Two recurring quality failures drove the next round:

- The EN prose was correct but bloated — the Writer produced
  paragraph-length sentences and Latinate business-speak that made
  Insights feel like consulting memos, not peer advice.
- The ES prose was clearly a machine translation — calques
  (*"el instinto es"*, *"artefacto de estrategia"*, *"la varianza"*),
  untranslated anglicisms (*"outputs"*, *"rollout"*, *"pipeline"*),
  gerund openings, English Title Case on headlines.

PR #15 rebuilt both prompts with concrete rules:

- **Writer (EN):** Hemingway targets (12–18 word sentences, active
  voice, cut `-ly` adverbs, open with claims not setups), readability
  benchmarks (Flesch-Kincaid 7.5–9.5), and the Wes Kao / Lenny
  Rachitsky "start right before the bear" opening principle.
- **Localizer (ES):** Mexican business-press register modeled on
  Expansión, Bloomberg Línea, El Financiero — 18–24 word sentences,
  third-person declarative, explicit anti-calque table,
  keep-vs-translate anglicism list, sentence-case headlines, Mexican
  number formatting (*mdp/mdd, 1 de septiembre de 2026*).
- **Both agents:** a 12-step self-check block at the end of each
  prompt that the model walks through before returning JSON. Catches
  the recurring failures (bullets in Insight, word count overruns,
  em-dashes, banned phrases) one LLM cycle earlier than the Validator
  would.

The voice score moved from ~82/100 to 88/100 on the first post-upgrade
edition. The Spanish edition became genuinely readable — not just
grammatically correct.

Separately, a citation-guard bug that flagged the italicized
*"*Esta semana: ...*"* thread sentence as a signal bullet was fixed
(commits `07ea142`, `e756102`).

---

## Phase 4 — Quality as infrastructure (this commit series)

As the pipeline matured, *"good quality"* moved from judgment to
contract. The `EditionSchema` in PR #14 added a `qaScore` field
anticipating this. The `2026-04-21 docs alignment` series fills in
the contract:

- **`docs/EVALUATION-RUBRIC.md`** — the rubric `qaScore` measures,
  versioned, with explicit benchmarks and score bands.
- **`docs/EVALUATE-EDITION.md`** — the manual how-to for running the
  rubric today; becomes a fallback once the in-pipeline Evaluator
  agent ships.
- **`docs/evaluations/`** — the accumulating record. One file per
  language per edition.
- **`docs/PROJECT-EVOLUTION.md`** (this file) — the narrative layer
  so context does not re-rot after each session.
- **`docs/IMPROVEMENT-BACKLOG.md`** — the prioritized systemic work
  not yet shipped, scored by impact and effort.

---

## Where the project is, right now

**Shipping every week (stable):**
- 10-agent pipeline runs end-to-end at ~$0.60 per edition
- Bilingual drafts saved to `drafts/` ready for Wadi's review
- Citation Guard + QualityGate catch most fabrication / attribution
  failures before publish
- Writer and Localizer produce prose at ~88/100 voice score on average

**Knowingly unfinished (see `IMPROVEMENT-BACKLOG.md` for the full
list):**
- No in-pipeline Evaluator agent — rubric is run manually each week
- The Writer's 12-step self-check catches most errors but not all;
  bullets in Insight and Signal word count overruns still recur
- 29 of 81 RSS feeds fail on every run — nobody has curated the feed
  list in months
- Source diversity frequently reports 1–2 outlets cited, below the
  ≥ 3 target
- No SourceBundle snapshot — a mid-pipeline failure requires re-running
  Radar with different inputs
- No end-to-end smoke test — unit tests pass, coordination bugs slip
- Insight-history (the Apertura-history analog for approved Insight
  examples) does not exist yet — the Writer has no reference for
  "an Insight Wadi approved"
- Prompt caching is only on the Writer's Voice Bible block, not on
  Localizer / Validator / QualityGate where it would cut input cost
  40-60%

---

## What this implies for the work ahead

1. **Do not touch `BRAND.md`, `ICP.md`, `CONTENT-STRATEGY.md`.** These
   are stable editorial foundations.
2. **Treat `NEWSLETTER-FORMAT.md` and `EVALUATION-RUBRIC.md` as the
   product contract.** Changes to either should be explicit, versioned,
   and paired with a note on what prompted the change.
3. **Pull items from `IMPROVEMENT-BACKLOG.md` in priority order.** Each
   item lists impact × effort. The top five are what pays in month
   one: Writer self-check for bullets (post-processor, not prompt),
   prompt caching on the other three LLM agents, SourceBundle
   snapshot for reproducibility, memory CLI for localization
   corrections, pipeline smoke test.
4. **Every edition gets evaluated.** Scores feed back into prompt
   iterations. This is the only loop that makes quality compound
   over time.

---

## Appendix — commit trail of the realignment

The work that produced this file, in order:

1. `07ea142` — `fix(citation-guard): don't flag italicized preamble as
   a signal bullet`
2. `e756102` — `refactor(citation-guard): trim comment on bullet regex`
3. PR #15 (squash of `5e333ce` + `a9c4488`) — Hemingway EN, Mexican
   business-press ES, 12-step self-check, `thesis` field for ES draft
   rendering
4. PR #14 — core Zod schemas including the `qaScore` field this
   evaluation framework fills
5. `defe499` / `c5bf2be` / `1dab8e4` / this commit — docs alignment
   and evaluation framework
