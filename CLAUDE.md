# Newsletter Automation System

## Project Overview

A production-grade multi-agent publishing engine for a bilingual (EN/ES) newsletter on
**AI business transformation news**, targeting $5M–$100M company executives across the
US-LATAM corridor.

## Architecture

- 11 agents: Supervisor, Radar, Strategist, Writer, Designer, Localizer, Validator,
  QualityGate, Distributor, Amplifier, Analyst
- Orchestration layer manages run lifecycle with run_id and edition_id tracking
- Structured JSON I/O between all agents, validated with Zod
- **Curator email approval gate**: before publish, Supervisor emails the human editor
  a digest (Strategist shortlist + Writer drafts + Designer hero/section assets).
  Publish is blocked until the editor approves, edits, or rejects via reply-to-email
  or a one-click approval link. Decisions are written back to the run ledger.

### Designer agent

- Produces hero image and section imagery for each edition
- Applies brand visual style (palette, typography, layout tokens) consistently
  across email, web, and social variants
- Generates alt-text and caption copy in EN/ES (handed to Localizer for parity)

## Tech Stack

- Runtime: Node.js / TypeScript
- Orchestration: Make.com (or custom with n8n)
- Data: Airtable (pipeline, run ledger) + Google Sheets (metrics, scores)
- Email: Beehiiv API (publish) + transactional provider for curator approval emails
- RSS: Feedly API
- AI: Anthropic Claude API
  - Writer, Localizer: `claude-opus-4-7` (highest quality, main editorial work)
  - Writer repair fallback: `claude-sonnet-4-6`
  - Strategist, Validator, QualityGate, Amplifier, Designer (style/caption logic): `claude-sonnet-4-5`
  - Radar, Analyst, Distributor: no LLM (data/HTTP only)
- Image generation: external provider for Designer hero/section imagery
- Social: LinkedIn API, X/Twitter API

## Code Conventions

- TypeScript strict mode
- Each agent is a standalone module in /src/agents/
- Shared types in /src/types/
- All agent I/O uses Zod schemas for validation
- Environment variables in .env (never committed)
- Costs tracked per-agent per-run

## Key Files

- /src/agents/ — Individual agent modules
- /src/orchestrator/ — Supervisor and state machine
- /src/types/ — Shared TypeScript interfaces and Zod schemas
- /src/utils/ — Helpers (logging, cost tracking, API clients)
- /src/voice-bible/ — Voice Bible and golden examples
- /config/ — Agent prompt templates (version controlled)
- /tests/ — Agent unit and integration tests
