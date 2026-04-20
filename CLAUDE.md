# Newsletter Automation System

## Project Overview

A production-grade multi-agent publishing engine for a bilingual (EN/ES)
strategic newsletter targeting $5M–$100M company executives across the US-LATAM corridor.

## Architecture

- 9 agents: Supervisor, Radar, Strategist, Writer, Localizer, Validator, Distributor, Amplifier, Analyst
- Orchestration layer manages run lifecycle with run_id and edition_id tracking
- Structured JSON I/O between all agents
- Human approval gate before publish

## Tech Stack

- Runtime: Node.js / TypeScript
- Orchestration: Make.com (or custom with n8n)
- Data: Airtable (pipeline, run ledger) + Google Sheets (metrics, scores)
- Email: Beehiiv API
- RSS: Feedly API
- AI: Anthropic Claude API (claude-sonnet-4-5 for most agents, claude-opus-4-6 for Writer)
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
