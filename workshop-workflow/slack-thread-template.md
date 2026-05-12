# Slack Thread Template

## Top-level task opener
Use one top-level Slack message per task.

Suggested format:

`[Milo] TASK: <short task title>`

Body:
- goal / problem statement
- why it matters
- requested outcome
- link to Drive folder/status doc once created
- `STAGE: TASK_OPEN`

## First PM response
`[PM] ...`
- restate job-to-be-done
- list goals / non-goals
- draft PRD direction
- list open questions if any
- `STAGE: PRD_DRAFT`

## Architect response
`[Architect] ...`
- review PRD
- challenge request shape / system boundaries
- note tradeoffs
- add blockers or questions if needed
- `STAGE: PRD_REVIEW` or `STAGE: ARCHITECTURE_DRAFT`

## PM question summary
`[PM] ...`
- convert unresolved issues into numbered questions
- use `QUESTION_FOR_AVI:` for anything that needs Avi
- `STAGE: QUESTIONS_OPEN`

## Closure examples
- PM closes PRD -> `STAGE: PRD_LOCKED`
- Architect closes architecture -> `STAGE: ARCHITECTURE_LOCKED`
- Developer publishes execution plan -> `STAGE: EXECUTION_PLAN`

## Important
Do not create a new top-level Slack message for every sub-step. Keep the task in one thread unless Milo intentionally splits it.
