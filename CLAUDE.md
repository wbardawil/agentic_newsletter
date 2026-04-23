# Newsletter Automation System

## Project Overview

A production-grade multi-agent publishing engine for a bilingual (EN/ES)
strategic newsletter targeting $5M–$100M company executives across the US-LATAM corridor.

## Architecture

- 10 agents: Supervisor, Radar, Strategist, Writer, Localizer, Validator,
  QualityGate, Distributor, Amplifier, Analyst
- Orchestration layer manages run lifecycle with run_id and edition_id tracking
- Structured JSON I/O between all agents, validated with Zod
- Human approval gate before publish

## Tech Stack

- Runtime: Node.js / TypeScript
- Orchestration: Make.com (or custom with n8n)
- Data: Airtable (pipeline, run ledger) + Google Sheets (metrics, scores)
- Email: Beehiiv API
- RSS: Feedly API
- AI: Anthropic Claude API
  - Writer, Localizer: `claude-opus-4-7` (highest quality, main editorial work)
  - Writer repair fallback: `claude-sonnet-4-6`
  - Strategist, Validator, QualityGate, Amplifier: `claude-sonnet-4-5`
  - Radar, Analyst, Distributor: no LLM (data/HTTP only)
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
