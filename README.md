# The Transformation Letter — Pipeline

A production-grade multi-agent publishing engine for a bilingual (EN/ES)
weekly strategic newsletter for $5M–$100M business owners in the
US-LATAM corridor. Each week the pipeline reads the corridor's news,
picks a strategic angle, drafts the issue in English, transcreates it
to Spanish, validates both, and saves drafts for review before publish.

## Pipeline flow

```
Radar        → scans 80+ RSS feeds, selects top 20 corridor-relevant items
  │
Strategist   → picks the week's angle + OS pillar (Strategy / Operating Model / Technology)
  │
Writer       → drafts the EN issue (Opus 4.7) — 7 sections, 1,000–1,200 words
  │
Validator    → voice + structure check against the Voice Bible (Sonnet 4.5)
  │
Localizer    → transcreates to ES (Opus 4.7) — Mexican business-press register
  │
QualityGate  → fact-check + citation discipline + voice + source diversity (Sonnet 4.5)
  │
Citation Guard (deterministic) → flags attribution-without-link patterns
  │
Drafts saved to drafts/{editionId}-{en|es}.{md,html} for Wadi's review
  │
(Wadi picks Apertura option, edits, approves)
  │
Distributor  → publishes to Beehiiv (one edition per language)
Amplifier    → posts LinkedIn / X teasers
Analyst      → pulls open/click/reply stats back into the run ledger
```

Ten agents total: Supervisor, Radar, Strategist, Writer, Localizer,
Validator, QualityGate, Distributor, Amplifier, Analyst. Each one is a
module in `src/agents/`. See `CLAUDE.md` for architecture notes.

## Quickstart

```bash
pnpm install

# Generate a draft for the current week's edition
pnpm draft --edition 2026-20

# Record the Apertura option Wadi picked (A / B / C or "own edit")
pnpm choose 2026-20 A

# Publish the approved edition
pnpm publish:edition --edition 2026-20

# Run tests
pnpm test

# Type-check without emitting
pnpm typecheck
```

`.env` must contain the Anthropic, Beehiiv, LinkedIn, and Feedly keys
referenced by the agents. See `src/utils/api-clients.ts` for the full
list.

## Where things live

| Path | What's there |
|---|---|
| `src/agents/` | One module per pipeline agent |
| `src/orchestrator/` | Run lifecycle, state machine, supervisor loop |
| `src/types/` | Shared Zod schemas (RunLedger, SourceBundle, Edition, AgentOutput) |
| `src/utils/` | Cross-cutting helpers (logging, cost tracking, citation guard, sanitize-output) |
| `src/voice-bible/` | Voice Bible + golden examples (edition Markdown files scored ≥ 90 get promoted here) |
| `config/prompts/` | Versioned Markdown prompt templates, one per agent |
| `config/voice-profiles.md` | Reference voices (Justin Welsh, Matt Gray, etc.) that shape the house voice |
| `config/localization-memory.json` | Running log of ES corrections Wadi has made |
| `docs/` | Editorial and operational docs — read these first |
| `drafts/` | Local output of each run (gitignored, produced by `pnpm draft`) |
| `tests/` | Vitest unit + integration tests |

## Read these docs in this order

1. **`docs/BRAND.md`** — Wadi, Business Transformation OS, what the publication never claims.
2. **`docs/ICP.md`** — the reader. Everything else calibrates to this operator.
3. **`docs/CONTENT-STRATEGY.md`** — three OS pillars, quarterly narrative, topic boundaries.
4. **`docs/NEWSLETTER-FORMAT.md`** — the seven fixed sections. What each one does, what it is not.
5. **`docs/EVALUATION-RUBRIC.md`** — 0–100 quality bar benchmarked against top advisory newsletters.
6. **`docs/EVALUATE-EDITION.md`** — how to run the rubric against a draft in any Claude / Codex session.
7. **`docs/PROJECT-EVOLUTION.md`** — where the project has been, why the current shape.
8. **`docs/IMPROVEMENT-BACKLOG.md`** — prioritized systemic improvements not yet shipped.
9. **`CLAUDE.md`** — agent architecture, model mapping, code conventions for contributors.

## Tech stack

- **Runtime:** Node.js ≥ 22, TypeScript (strict mode), pnpm
- **LLM:** Anthropic Claude — Opus 4.7 for editorial agents, Sonnet 4.5 for checks, no LLM for Radar/Analyst/Distributor
- **Validation:** Zod at every agent boundary
- **Orchestration:** in-process state machine (Make.com / n8n planned)
- **Data:** Airtable (pipeline + run ledger), Google Sheets (metrics)
- **Email:** Beehiiv API
- **RSS:** Feedly API + 80+ direct feeds
- **Social:** LinkedIn, X/Twitter
- **Tests:** Vitest

## Conventions

- TypeScript strict. No `any` in new code.
- All agent I/O validated with Zod schemas.
- Prompts live in `config/prompts/` as `.md` files, versioned alongside
  the code that interpolates them. `promptVersion` is recorded in the
  run ledger for every run.
- Costs tracked per agent per run in `cost-tracker.ts`.
- Em-dashes (—) and en-dashes (–) are an AI-tell; `sanitize-output.ts`
  strips them before drafts hit disk. Write as if they did not exist.
- Secrets in `.env`. Never committed. Gitleaks / secret scanning before push.
