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
**AI business transformation news** (high cadence) and rotates through four
foundational OS pillars at lower cadence. Pillars are weighted to reflect that
**People is the dominant bottleneck of change** observed in field engagements,
and to deliberately under-weight Technology — the pillar readers already
over-index on themselves:

| Pillar | Weight | Scope |
|---|---|---|
| **People OS** | 30% | change management, talent, skills, leadership, culture |
| **Strategy OS** | 25% | vision, value cases, prioritization, portfolio choices |
| **Operating Model OS** | 25% | process redesign, governance, decision rights, org structure |
| **Technology OS** | 20% | architecture, data, platforms, integration, security, vendor selection |

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
