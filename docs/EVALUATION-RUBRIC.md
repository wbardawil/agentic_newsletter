# Evaluation Rubric
*The 0–100 quality bar every edition is measured against. Versioned.
Auditable. Reused every week.*

**Rubric version:** 1.0
**Last updated:** 2026-04-21

This rubric defines the contract for the `qaScore` field on
`EditionSchema` (`src/types/edition.ts`). Every published edition is
scored against it. A future Evaluator agent will run this automatically
after the Writer / Localizer, store the score in the run ledger, and
save the full breakdown to `docs/evaluations/{editionId}-{lang}.md`.

Until that agent ships, the rubric is run manually from any Claude /
Codex session using the prompt in `docs/EVALUATE-EDITION.md`.

---

## What this rubric assumes

Before scoring, read:
- `docs/BRAND.md` — voice, positioning, what the publication never claims
- `docs/ICP.md` — the operator the issue is written for
- `docs/CONTENT-STRATEGY.md` — the three OS pillars and quarterly arcs
- `docs/NEWSLETTER-FORMAT.md` — the seven-section structure and word targets

The rubric does not restate those. It measures whether the specific
draft honors them and lands with a top-tier reader.

---

## Benchmark newsletters

The 90+ band is calibrated against these. When we say "top tier," this
is what we mean:

**EN**
- **Lenny's Newsletter** (Lenny Rachitsky) — hook formula, one-question
  discipline, 1:1 voice from operator to operator, tactical tools.
- **Stratechery** (Ben Thompson) — single-thesis essays, original
  frameworks, reframe density.
- **Not Boring** (Packy McCormick) — narrative arc, scene-setting,
  brand-story-as-business-lesson.
- **The Diff** (Byrne Hobart) — insight density per sentence, tight
  finance/strategy synthesis.
- **Money Stuff** (Matt Levine, Bloomberg) — voice consistency,
  micro-humor, recurring "the bit" frames.

**ES**
- **De Jefes** (El Financiero column) — Mexican third-person
  declarative business voice, named characters.
- **Bloomberg Línea ES** — tight bilingual business register,
  regulation-frame openings.
- **Expansión opinion columns** — asesor tone, mid-sentence colon for
  the payoff.

---

## The six dimensions (100 pts total)

### 1. ENGAGEMENT — 25 pts
Does the reader keep reading?

| Sub-criterion | Pts | Test |
|---|---|---|
| Hook ≤ 25 words that produces *"keep reading"* | 8 | First sentence of the Apertura or Insight. Does it state a claim or set one up? |
| Sustained tension — each section opens something new | 6 | Read the first sentence of every section. Does each one introduce a fresh tension, not a summary? |
| Time-to-aha ≤ 30 seconds of scroll | 5 | Could the reader hit the Insight's framework in the first 30 seconds of reading? |
| Close that invites the next issue | 3 | The Compass. Does it create expectation, or does it restate the thesis? |
| Zero filler — every word earns its place | 3 | Cut every sentence. Is the piece weaker? If not, that sentence was filler. |

### 2. CLARITY — 20 pts (the 5 Cs)
| Sub-criterion | Pts | Test |
|---|---|---|
| Readability: FK grade 7.5–9.5 (EN) or equivalent (ES) | 5 | Count syllables in 5 random sentences. Avg 1–2 syllables/word. |
| One thesis per edition, not three | 5 | State the Insight in one sentence. If you can't, there are two theses. |
| Coherence: Insight in Problem → Diagnosis → Framework → Application order | 4 | Check paragraph order against format doc. |
| Concision: word counts within target | 3 | Signal 95–185, Apertura ≤120, Insight ~450, total 1,000–1,200 |
| Correctness: grammar, citation discipline | 3 | Every number/quote has a link. No banned phrases. |

### 3. CRAFT — 20 pts
Sentence-level work.

| Sub-criterion | Pts | Test |
|---|---|---|
| Avg sentence length: 12–18 EN / 18–24 ES | 4 | Count words in every 5th sentence. |
| Passive voice < 5% of sentences | 3 | Grep for *was/were/is/are + past participle*. |
| `-ly` / `-mente` adverbs ≤ 3 across the edition | 3 | Grep for *simply, clearly, basically, actually, really*. |
| Voice consistency | 5 | Does the draft sound like one writer, or a committee? |
| Show > tell — concrete scene, not abstraction | 5 | Does the Apertura contain a named person, named company, specific moment? |

### 4. ORIGINALITY — 15 pts
What does this edition say that no one else said this week?

| Sub-criterion | Pts | Test |
|---|---|---|
| Reframe that inverts conventional wisdom | 8 | Shape: *"What you call X is actually Y."* Not a headline, a thesis. |
| Named framework with humility (not invented jargon) | 4 | The framework has a name and uses established industry terms where they exist. Coined terms are flagged as Wadi's framing. |
| Unexpected cross-domain connection | 3 | Does the Insight borrow a concept from a different domain to illuminate this one? |

### 5. TRUST — 10 pts
Does the reader believe what they're reading?

| Sub-criterion | Pts | Test |
|---|---|---|
| Every number/quote has a source link | 4 | The Citation Guard catches misses; the score deducts if the Guard flagged anything. |
| Zero fabrication — verbatim match against the SourceBundle | 3 | Named companies, cited statistics, quoted people must appear in `verbatimFacts` from the Radar output. |
| Source diversity ≥ 3 outlets | 2 | QualityGate flags <3; full credit for ≥ 3. |
| Skin-in-the-game visible | 1 | The writer has been in the room with this operator problem. The Apertura proves it. |

### 6. MEMORABILITY — 10 pts
Does the reader remember this next week?

| Sub-criterion | Pts | Test |
|---|---|---|
| One shareable sentence ≤ 20 words, declarative, no hedging | 5 | The Validator surfaces a `shareableSentence` candidate; apply the length + hedging filter. |
| One sticky concept (name + one-line definition) | 3 | Could the reader paraphrase the framework to a peer in 15 seconds? |
| Memorable subject line, not generic | 2 | Applies the *"Your AI is a witness, not a tool"* test: claim, not description. |

---

## Score bands

| Score | Band | What it means |
|---|---|---|
| **90–100** | top tier | Lenny / Stratechery week — reader keeps, shares, returns |
| **80–89** | solid pro | Good, not memorable — will not lose subscribers, will not gain them |
| **70–79** | competent | Reads fine, but would not recommend to a peer |
| **60–69** | average | Unpolished draft — needs a revision pass before publish |
| **< 60** | needs rewrite | Do not publish in current state |

**Publish threshold: 80.** Below 80, the pre-publish actions from the
evaluation are mandatory before send. Below 70, the edition is held
for full rewrite.

---

## ES-specific auto-deductions

On ES drafts, deduct points in **Craft** and **Clarity** if any of the
following appear. The Localizer prompt enforces these; the evaluator
catches what slipped through.

### Calques that must NOT appear (deduct 2 pts each, up to 10)
*el instinto es, artefacto de estrategia, la varianza* (interpersonal
sense), *a velocidad, al final del día, mover la aguja, hacer sentido,
tomar ventaja de, en orden de, aplicar para, actores clave, jugadores
clave, en el espacio de negocios, el lado operador, product-first.*

### Gerund openings (deduct 2 pts each, up to 6)
*Siendo…, Teniendo en cuenta que…, Pensando en…, Considerando…* at
the start of any section or paragraph.

### Untranslated anglicisms outside the keep-list (deduct 2 pts each)
Deduct if: *output(s), prompt, rollout, pipeline, repricing, stack,
workflow, framework, mindset, insight* (as a noun in prose), *case
study, deep dive, benchmark, actionable, stakeholder* appear
untranslated.

Keep without penalty: *fintech, startup, pyme(s), mipyme, nearshoring,
e-commerce, marketplace, wallet, ETF, ESG, T-MEC, venture capital,
private equity*, brand names (*Claude Projects, Canva, Slack,* etc.).

### Formatting (deduct 1 pt each)
- Em-dashes (—) or en-dashes (–) residual in the output
- Title Case on headlines (should be sentence case)
- `Su / sus` in consecutive sentences where possession is already
  obvious (calque of English "your")
- Missing peso context when a USD figure large enough to need scale
  context is cited

---

## Deliverable format

When evaluating, produce this exact structure and save to
`docs/evaluations/{editionId}-{lang}.md`:

```
# Edition {editionId} — {EN|ES}

**Score:** XX/100  **Band:** [top tier | solid pro | competente |
promedio | rewrite]
**Rubric version:** 1.0
**Evaluated:** YYYY-MM-DD

## Dimensions
| Dimension | Score | Status |
|---|---|---|
| Engagement | XX/25 | ✅ / ⚠️ / ❌ |
| Clarity | XX/20 | ✅ / ⚠️ / ❌ |
| Craft | XX/20 | ✅ / ⚠️ / ❌ |
| Originality | XX/15 | ✅ / ⚠️ / ❌ |
| Trust | XX/10 | ✅ / ⚠️ / ❌ |
| Memorability | XX/10 | ✅ / ⚠️ / ❌ |

## Measured stats
- Word counts by section: [Signal X / Apertura X / Insight X / ...]
- Avg sentence length: X words
- Longest sentence: X words [section, verbatim quote]
- Passive voice: X% of sentences
- -ly (or -mente) adverbs: X total

## Top 3 strengths (verbatim quotes)
1. [section] "..."
2. [section] "..."
3. [section] "..."

## Top 3 issues (verbatim quote → proposed rewrite)
1. [section, paragraph N] "original" → "rewrite"
2. ...
3. ...

## Pre-publish actions (fix before sending this edition)
1. ...
2. ...
3. ...

## Prompt iterations for next edition (systemic improvements)
1. ...
2. ...
3. ...

## Path to +90
One paragraph describing the single highest-leverage move that would
push this edition into the top-tier band.
```

For ES evaluations, append this section after "Path to +90":

```
## ES purity check
- Calques detected (should be 0): [list verbatim or "none"]
- Anglicisms from ban list (should be 0): [list or "none"]
- Gerund openings (should be 0): [list or "none"]
- Em-dashes / en-dashes detected (should be 0): [count + first location]
- Sentence case on headlines: ✅ / ⚠️ / ❌
- Mexican number format compliance: ✅ / ⚠️ / ❌
```

---

## Promotion policy — feeding the rubric back into the system

- Any edition scoring **≥ 90** in its final published form is promoted
  to `src/voice-bible/golden-examples/` and becomes future Writer /
  Localizer reference material.
- Any edition scoring **< 80** has its top 3 issues folded into the
  Writer / Localizer prompts (as banned patterns or added examples)
  before the next edition is drafted.
- Rubric changes are versioned. When we bump the rubric, we re-score
  the last 4 editions under the new version to keep trend data
  comparable.

---

## Rubric changelog

- **1.0 (2026-04-21)** — Initial version. Six dimensions, 100 pts,
  benchmarks against Lenny / Stratechery / Not Boring / The Diff /
  Money Stuff (EN) and De Jefes / Bloomberg Línea / Expansión opinion
  (ES). ES-specific calque / anglicism / gerund / format deductions.
