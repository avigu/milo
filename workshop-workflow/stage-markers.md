# Stage Markers

## Required stage markers
Use these exact markers in Slack and in the Drive status doc.

- `STAGE: TASK_OPEN`
- `STAGE: PRD_DRAFT`
- `STAGE: PRD_REVIEW`
- `STAGE: QUESTIONS_OPEN`
- `STAGE: PRD_LOCKED`
- `STAGE: ARCHITECTURE_DRAFT`
- `STAGE: ARCHITECTURE_REVIEW`
- `STAGE: ARCHITECTURE_LOCKED`
- `STAGE: EXECUTION_PLAN`
- `STAGE: READY_FOR_IMPLEMENTATION`
- `STAGE: IMPLEMENTATION_IN_PROGRESS`
- `STAGE: DONE`

## Ownership rules
### PM can advance
- TASK_OPEN -> PRD_DRAFT
- PRD_REVIEW -> QUESTIONS_OPEN
- QUESTIONS_OPEN -> PRD_LOCKED

### Architect can advance
- PRD_LOCKED -> ARCHITECTURE_DRAFT
- ARCHITECTURE_DRAFT -> ARCHITECTURE_REVIEW
- ARCHITECTURE_REVIEW -> ARCHITECTURE_LOCKED

### Developer can advance
- ARCHITECTURE_LOCKED -> EXECUTION_PLAN
- EXECUTION_PLAN -> READY_FOR_IMPLEMENTATION
- READY_FOR_IMPLEMENTATION -> IMPLEMENTATION_IN_PROGRESS
- IMPLEMENTATION_IN_PROGRESS -> DONE

## Gate rules
### PRD_LOCKED requires
- explicit PRD summary
- open questions resolved or intentionally deferred
- acceptance criteria present

### ARCHITECTURE_LOCKED requires
- component boundaries or implementation structure stated
- major tradeoffs surfaced
- no unresolved blocker from PM

### READY_FOR_IMPLEMENTATION requires
- PRD_LOCKED
- ARCHITECTURE_LOCKED
- execution plan written
- no open blocker

## Milo enforcement
Milo may stop or reject a transition if:
- a required prior stage is missing
- a blocker is still open
- a question for Avi is unresolved
- Developer is trying to implement too early
