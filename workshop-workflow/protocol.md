# Protocol — Transparent Workshop Workflow

## Core idea
Each task is handled as a transparent workshop:
- **Slack thread** = live discussion and handoffs
- **Drive task folder** = structured state, docs, and artifacts
- **Milo** = orchestrator, gatekeeper, and bridge to Avi

## Roles
- **Milo** — manager / CEO layer; Avi talks to Milo, not directly to internal agents
- **Iris [PM]** — PRD, product framing, open questions, acceptance criteria
- **Atlas [Architect]** — architecture, boundaries, tradeoffs, structure
- **Amy [Developer]** — execution plan and implementation after gates are cleared
- **Sage [Investment]** — financial/domain logic, realism, scoring caveats

## Operating rules
1. One task = one Slack thread
2. One task = one Drive folder
3. Every agent message in Slack starts with a role tag
4. Stage transitions must be explicit
5. Developer does not implement before PRD and architecture are closed
6. Questions for Avi are routed through Milo in Slack or control UI, not WhatsApp
7. Drive mirrors state; Slack remains the engine of the workflow

## What Milo does
- opens the task thread and Drive folder
- makes sure the correct role speaks next
- enforces stage transitions
- collects questions for Avi
- blocks premature implementation
- summarizes status and next steps

## What agents do
Agents react to the current thread state:
- new task -> PM starts
- PRD draft present -> Architect reviews
- architecture present but PRD still open -> PM resolves open questions
- PRD + architecture locked -> Developer writes execution plan
- scoring/business-logic discussion -> Investment joins where relevant

## Workflow shape
1. Task opened
2. PRD draft
3. PRD review / questions
4. PRD locked
5. Architecture draft
6. Architecture locked
7. Execution plan
8. Ready for implementation
9. Implementation in progress
10. Done

## State sources
- Slack thread = narrative + discussion
- Drive status doc = current authoritative structured snapshot
- Milo = transition control and human interface
