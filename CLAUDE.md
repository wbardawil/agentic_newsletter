# The Transformation Letter — Newsletter Automation System

## Project Overview

**The Transformation Letter** is a production-grade multi-agent publishing engine
for a bilingual (EN/ES) weekly newsletter, with a member portal under `/portal`
modeled on Garry's List.

**Tagline:** *Diagnostics for $5–100M owner-operators across business
transformation, conscious capital, family business, family office, AI, and tech —
in the US-LATAM corridor.*

Audience: owner-operators of $5M–$100M businesses across the US-LATAM corridor
(Miami, Monterrey, Bogotá, Panama City, Mexico City).

## Editorial Mandate

Coverage spans **six adjacent topics** for one audience. Every issue carries one
topic and ends with a concrete recommendation plus the People-side shift it
creates.

| Topic | Scope | Byline |
|---|---|---|
| **Business transformation** | The Business Transformation OS sequence (Strategy → Operating Model → Technology). Lead with AI business transformation; rotate through the OS layers. | Wadi Bardawil |
| **Conscious capital** | Stewardship of capital — long-term, values-aware returns over hype-cycle exits. | Named guest contributor |
| **Family business** | Generational continuity, governance, succession. | Named guest contributor |
| **Family office** | Single- and multi-family offices: investment posture, principal–staff dynamics, multi-generational stewardship. | Named guest contributor |
| **AI** | Practical AI for mid-market operations — where it captures value vs. where it just adds noise. | Wadi Bardawil (or contributor) |
| **Technology** | Architecture, data, integration, vendor selection — the third OS layer. | Wadi Bardawil (or contributor) |

The taxonomy lives in `/portal/lib/topics.ts` (single source of truth). Add a
new topic there; no schema migration is required.

### The OS sequence — scoped to business transformation

Within the **business transformation** topic, the three OS layers rotate in a
non-negotiable causal sequence — Strategy first, then Operating Model, then
Technology — at the rotation below:

| Pillar | Rotation | Scope |
|---|---|---|
| **Strategy OS** | 35% | vision, value cases, prioritization, portfolio choices |
| **Operating Model OS** | 35% | process redesign, governance, decision rights, org structure |
| **Technology OS** | 30% | architecture, data, platforms, integration, security, vendor selection |

Other topics do not rotate through OS layers. Conscious capital, family
business, and family office issues use topic-native diagnostic frames; the
OS sequence is invoked only when it sharpens the take.

### People is the always-on dimension — across every topic

Field experience consistently shows **People is the dominant bottleneck of
change**. Rather than slot People as a 4th pillar (which would make it
sometimes-relevant), the Strategist declares a required `peopleAngle` on
**every** issue regardless of topic:

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

The system has two halves:

1. **Agent pipeline (`/src`)** — produces and ships each issue.
2. **Member portal (`/portal`)** — Next.js 15 + Supabase. Apply gate, member
   sign-in, bilingual archive, personalization preferences (region, industry,
   topics), Transformation AI assistant grounded in the archive + Voice Bible,
   convenings/RSVPs, admin queue for application review. See `/portal/README.md`.

### Agent pipeline

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
- /portal/ — Member portal (Next.js 15 + Supabase). See `/portal/README.md`
- /portal/lib/topics.ts — Single source of truth for the six-topic taxonomy
- /portal/supabase/migrations/ — Portal schema + RLS
