# Proposed OpenClaw Agent Team

Status: draft only. Nothing here has been applied yet.

## Goal
Create 4 persistent configured agents on this OpenClaw install for the myfinapp / strategy workflow:
- Product Manager
- Architect
- Developer
- Investment Analyst

All four are designed to:
- inherit the current global workspace
- inherit the current primary/fallback models
- use the full tool profile
- have access to messaging/channel tools available to this gateway, including Slack and WhatsApp, plus email access through the existing environment/tooling
- collaborate in role-specific threads and sessions

## Shared conventions
- Every Slack message should start with a role tag.
- PRD before implementation.
- Architecture before code.
- Investment agent informs but does not overrule product/engineering constraints.
- Developer does not start implementation until PM + Architect are aligned.

## Proposed agents
1. **Iris** — Product Manager (`pm`)
2. **Atlas** — Architect (`architect`)
3. **Amy** — Developer (`developer`)
4. **Sage** — Investment Analyst (`investment`)

## Draft config strategy
- Keep `main` unchanged.
- Add 4 new entries under `agents.list`.
- Give each a stable `id`, human-readable `name`, `identity`, and `systemPromptOverride`.
- Set `tools.profile` to `full` for all four.
- Keep model inheritance from `agents.defaults` unless Avi later wants per-agent model specialization.

## Files in this folder
- `pm-iris.md`
- `architect-atlas.md`
- `developer-forge.md` (content updated to Amy)
- `investment-sage.md`
- `proposed-agents.json`
- `generate-agent-patch.mjs`

## Notes
- This is a preparation package for review in the morning.
- No config patch has been applied.
- No restart has been requested.
