# The Transformation Letter — Newsletter Automation System

## Project Overview

**The Transformation Letter** is a production-grade multi-agent publishing engine
for a bilingual (EN/ES) weekly newsletter.

**Tagline:** *AI business transformation playbooks for $5–100M owner-operators in
the US-LATAM corridor.*

Audience: owner-operators of $5M–$100M businesses across the US-LATAM corridor
(Miami, Monterrey, Bogotá, Panama City, Mexico City).

## Editorial Mandate

Coverage spans the full business transformation lifecycle. Each edition leads with
**AI business transformation news** (high cadence) and rotates through three
foundational OS pillars in a non-negotiable causal sequence — Strategy comes
first, then Operating Model, then Technology — at the rotation below:

| Pillar | Rotation | Scope |
|---|---|---|
| **Strategy OS** | 35% | vision, value cases, prioritization, portfolio choices |
| **Operating Model OS** | 35% | process redesign, governance, decision rights, org structure |
| **Technology OS** | 30% | architecture, data, platforms, integration, security, vendor selection |

### People is the always-on dimension

Field experience consistently shows **People is the dominant bottleneck of
change**. Rather than slot People as a 4th pillar (which would make it
sometimes-relevant), the Strategist declares a required `peopleAngle` on
**every** issue regardless of pillar:

- **`peopleAngle.challenge`** — the named human shift the recommendation
  creates: what behavior, mindset, capability, or trust must change, and in whom.
- **`peopleAngle.framework`** — anchor in a change-management framework:
  ADKAR step (Awareness/Desire/Knowledge/Ability/Reinforcement),
  Kotter stage (1–8), or McKinsey 7S element (Strategy/Structure/Systems/
  Shared Values/Skills/Style/Staff).

The Writer weaves the People dimension into the Insight without naming the
framework out loud — readers feel the principle, not the label. The Validator
enforces that every Insight engages the declared challenge substantively.

### Editorial stance

- Ground recommendations in change-management methodology (ADKAR, Kotter, McKinsey 7S,
  etc.) — name the framework when it sharpens the take.
- Assume many readers are already deploying AI but doing so partially or incorrectly.
  Write to surface the gap between *applying AI* and *capturing its full value*, and
  make the corrective move concrete.
- Diagnose first, prescribe second. Avoid hype-cycle takes.

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
