# Prompt Templates

Each `.md` file in this directory is a prompt template for one of the 9 pipeline agents.

## Template Convention

Templates use `{{variable}}` placeholders that agent code interpolates at runtime:

- `{{agentName}}` — Name of the agent
- `{{runId}}` — Current run identifier
- `{{editionId}}` — Current edition identifier
- `{{currentDate}}` — ISO date string
- `{{input}}` — JSON-serialized agent input payload

Agent-specific variables are documented in each template file.

## Version Control

These templates are version-controlled so that prompt changes are tracked,
diffable, and auditable alongside the code that uses them.
