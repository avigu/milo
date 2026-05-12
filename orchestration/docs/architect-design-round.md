# Architect Design Round: V2 Orchestration Contract

## 1. Short response to the PM objective

I agree with the PM framing: the next problem is not storage, it is coordination semantics.

The current tracker already proves a file-first task record can work. V2 should keep that inspectable foundation, but add a stricter orchestration contract so the system can answer, at any moment: who owns this work, what state is it in, what can happen next, what should be surfaced externally, and what must come back to the orchestrator before the user sees it as done.

The design below intentionally stays narrow. It defines a minimal contract that supports ownership, hierarchy, review, handoff, and Slack visibility without prematurely introducing a database, retries, or workflow automation.

## 2. Proposed system contract

### 2.1 Core entities

V2 should treat the following as canonical entities.

#### Task
A task is the unit of orchestration and accountability.

Minimal canonical task fields:
- `id`: stable task ID
- `title`: short human-readable label
- `goal`: desired outcome
- `parentTaskId`: nullable; links delegated work to a parent
- `role`: assigned role identity, such as `software-architect`
- `ownerType`: `orchestrator` or `child`
- `ownerSessionKey`: session currently accountable for advancing the task
- `status`: current lifecycle state
- `priority`: `low|medium|high|urgent`
- `requestedDeliverable`: explicit expected output
- `summary`: latest concise state summary
- `nextAction`: next required step
- `escalationTarget`: who should act if blocked; usually `orchestrator` or `user`
- `slackThreadKey`: nullable logical reference for parent-thread continuity
- `reviewState`: `none|pending_parent|approved|needs_revision`
- `createdAt`
- `updatedAt`
- `completedAt`: nullable
- `tags`: optional flat labels

#### Status snapshot
A mutable current view of the task used for fast reads.

Fields:
- `status`
- `summary`
- `nextAction`
- `ownerType`
- `ownerSessionKey`
- `reviewState`
- `waitingReason`: nullable; `child|user|external|none`
- `updatedAt`
- `staleAt`: nullable expected latest check-in time
- `lastProgressAt`: nullable

#### Event
An append-only fact about something that happened.

Required event fields:
- `ts`
- `taskId`
- `type`
- `actorType`: `orchestrator|child|system`
- `actorRole`
- `message`
- `data`: optional structured payload
- `visibility`: `internal|parent|slack_candidate|slack_emitted`

#### Handoff
A structured child-to-parent completion or blocker package. This can be stored as the latest structured handoff document plus an event referencing it.

Fields:
- `taskId`
- `kind`: `completion|blocker|review_ready`
- `completedWork`
- `artifacts`
- `decisions`
- `unresolvedIssues`
- `recommendation`
- `validationNote`
- `confidence`: `low|medium|high`
- `createdAt`

### 2.2 Responsibilities by entity

- `task.json` defines durable task identity, ownership, hierarchy, and requested outcome.
- `status.json` is the mutable coordination snapshot.
- `events.jsonl` is the audit log and notification source.
- `result.md` remains optional human-readable output.
- `handoff.json` should be added in V2 as the structured child return contract.

### 2.3 Canonical statuses

Use the following statuses for coordination behavior:
- `planning`
- `assigned`
- `running`
- `waiting_on_child`
- `waiting_on_user`
- `waiting_on_external`
- `blocked`
- `review`
- `done`
- `failed`
- `cancelled`

`queued` from the current tracker can remain as an implementation convenience, but it should not be part of the long-term coordination vocabulary unless the orchestrator truly maintains a backlog. If retained, treat it as pre-`assigned`.

### 2.4 Allowed transitions

Allowed task transitions:
- `planning -> assigned`
- `planning -> cancelled`
- `assigned -> running`
- `assigned -> cancelled`
- `running -> waiting_on_user`
- `running -> waiting_on_external`
- `running -> blocked`
- `running -> review`
- `running -> failed`
- `running -> cancelled`
- `waiting_on_user -> running`
- `waiting_on_user -> cancelled`
- `waiting_on_external -> running`
- `waiting_on_external -> blocked`
- `waiting_on_external -> cancelled`
- `blocked -> running`
- `blocked -> failed`
- `blocked -> cancelled`
- `review -> running`
- `review -> done`
- `review -> failed`
- `review -> cancelled`
- `waiting_on_child -> running`
- `waiting_on_child -> review`
- `waiting_on_child -> blocked`
- `waiting_on_child -> cancelled`

Additional contract rules:
- Only the orchestrator may move a parent task into `assigned`, `waiting_on_child`, `review`, `done`, or `cancelled`.
- A child may move its own child task into `running`, waiting states, `blocked`, `review`, or `failed`, but not `done` unless it has also written a handoff.
- `done` means orchestrator-accepted completion, not merely child-finished work.
- Child-complete work should usually become `review` with `reviewState=pending_parent` before `done`.

## 3. Orchestrator responsibilities vs child-agent responsibilities

### 3.1 Orchestrator responsibilities

The orchestrator is responsible for:
- interpreting the user objective;
- decomposing work into parent and child tasks;
- assigning role, scope, deliverable, and escalation target;
- setting and changing ownership;
- spawning child sessions when needed;
- maintaining parent-child linkage;
- rolling up child state into parent state;
- deciding whether an update is internal, parent-only, or Slack-visible;
- reviewing child handoffs;
- requesting user input when required;
- deciding when a parent objective is actually done.

The orchestrator is the only component that can:
- close a parent task as `done`;
- dismiss or cancel unfinished child work as part of parent closure;
- emit final user-facing completion by default;
- resolve cross-task priority conflicts.

### 3.2 Child-agent responsibilities

A child agent is responsible for:
- executing one bounded assignment;
- staying inside its role and scope;
- updating progress at meaningful checkpoints;
- declaring blockers quickly;
- producing a structured handoff when finished or stuck;
- returning control to the orchestrator at review or blocker boundaries.

A child agent must not:
- redefine the parent goal;
- represent itself as overall workflow owner;
- mark a parent objective user-ready;
- post broad Slack updates without permission;
- silently expand into unmanaged sub-work.

### 3.3 Boundary rule

If a decision changes external visibility, affects sibling tasks, changes task scope, or changes what the user should expect, it belongs to the orchestrator.

## 4. How tracking, task hierarchy, and handoffs should work

### 4.1 Tracking model

Keep the current file-first shape, but tighten semantics.

Per task directory:
- `task.json`: immutable-ish identity plus slowly changing ownership fields
- `status.json`: current snapshot for coordination
- `events.jsonl`: append-only event log
- `handoff.json`: latest structured child return package
- `result.md`: optional narrative result

Operational rule:
- state changes must update `status.json` and append a corresponding event in `events.jsonl`
- important ownership changes must also update `task.json`

### 4.2 Parent-child hierarchy

Hierarchy rules:
- every child task must have exactly one `parentTaskId`
- parent tasks may have zero or more child tasks
- child tasks cannot outlive parent closure unless explicitly dismissed with an event reason
- parent completion requires all non-dismissed children to be in `done`, `failed`, or `cancelled`, and any unresolved failed/cancelled children must be explicitly acknowledged in the parent review/completion summary

Recommended parent roll-up logic:
1. If any child is `blocked` or `failed`, parent becomes `blocked` unless orchestrator intentionally keeps parent `running` while handling it.
2. If any child is `review` and no child is `blocked` or `failed`, parent becomes `review` if parent action is required now.
3. If any child is `running`, `assigned`, or waiting states, and parent itself is coordinating, parent becomes `waiting_on_child`.
4. Parent becomes `done` only by explicit orchestrator action after review.

This keeps the parent state meaningful for coordination rather than mechanically derived in all cases.

### 4.3 Handoff contract

Every child task ending in review, blocked, failed, or done-adjacent state should write `handoff.json` with:
- what was completed
- artifacts produced
- decisions made
- unresolved issues
- recommendation to parent
- validation/confidence note

Recommended behavior:
- child task completion path is usually `running -> review` plus `handoff.json`
- orchestrator reads handoff, then either:
  - approves and marks child `done`
  - requests revision and returns child to `running`
  - escalates and marks parent `blocked` or `waiting_on_user`

### 4.4 Stale and lost work detection

In a file-first system, use lease-like expected check-ins rather than true heartbeats.

Add to `status.json`:
- `staleAt`: timestamp set when work is assigned or resumed
- `lastProgressAt`: last meaningful update

Detection rule:
- if `now > staleAt` and no newer progress event exists, emit `task.stale_detected`
- if a session is known and has terminated or become unreachable, emit `task.session_lost`
- stale or lost work should not auto-complete or auto-retry in V2; it should become `blocked` and return to orchestrator control

This is the safest minimal model for Phase 2.

## 5. How Slack visibility should be emitted without confusing agent identity

### 5.1 Notification classes

Use four classes:
- `acknowledgement`
- `progress_summary`
- `blocker_escalation`
- `completion_summary`

Internally, events may be marked `slack_candidate`, but only the orchestrator should normally emit Slack messages.

### 5.2 Emission policy

Default rule: children do not post directly to Slack.

Instead:
- children emit structured events and handoffs
- orchestrator decides whether to summarize them into Slack
- direct child-to-Slack posting should be opt-in per task via a field such as `slackPolicy.allowDirectChildUpdates=false` by default

Direct child posting is acceptable only when all are true:
- task is explicitly scoped for it
- message type is limited to progress or blocker
- role identity is fixed in the task record
- thread target is predefined
- orchestrator remains final completion authority

### 5.3 Identity model for Slack

Every Slack-visible message should include:
- parent task title or short ID
- reporting role
- source type: `orchestrator` or `child`
- current state
- concise summary
- next action / ask

Recommended presentation format:
- header identifies workstream/task
- badge/label identifies `Orchestrator` or child role
- body explains state change
- footer/reference includes local task ID and parent ID if relevant

Identity rule:
- role is responsibility, not persona
- child updates must be framed as scoped work updates
- final completion normally comes from the orchestrator, even if it quotes child outputs

### 5.4 Slack reconstruction requirement

Store locally for every emitted Slack message:
- logical message type
- target channel/thread key
- emitted text snapshot
- source task ID
- source actor role/type
- external message timestamp or ID if available
- edit/supersede relationship if later updated

This keeps the local audit trail reconstructible even if Slack delivery, edits, or threading metadata changes later.

## 6. What should remain file-based now vs what should wait

### Keep file-based now

Keep these local and file-first in the next slice:
- task directories as source of truth
- `task.json`, `status.json`, `events.jsonl`, `handoff.json`, `result.md`
- generated index for fast listing
- stale detection timestamps
- local Slack emission ledger per task or central state index
- manual repairability of all important state

### Wait until later

Defer these:
- database migration
- transport-specific Slack implementation details
- automatic retries and reassignment algorithms
- scheduler/queue semantics beyond orchestrator-driven assignment
- advanced dependency graphs beyond parent-child linkage
- real-time event bus
- rich UI

This preserves inspectability while adding the minimum semantics needed for coordination.

## 7. Concrete recommendations for the next implementation slice

1. **Extend the schema, do not replace it.**
   - Add `ownerType`, `requestedDeliverable`, `escalationTarget`, `reviewState`, `slackThreadKey` to `task.json` and/or `status.json`.
   - Add `handoff.json`.

2. **Normalize the lifecycle vocabulary.**
   - Update tracker commands and validation to support the V2 coordination states.
   - Treat `review` as distinct from `done`.

3. **Add event typing discipline.**
   - Standardize event types such as `task.assigned`, `task.started`, `task.progress`, `task.blocked`, `task.review_ready`, `task.approved`, `task.done`, `task.stale_detected`, `task.session_lost`, `slack.message_emitted`.

4. **Implement parent-child queries and roll-up helpers.**
   - Add tracker support to list children, compute parent roll-up suggestions, and detect unresolved descendants.

5. **Add stale detection as a lightweight control-plane guard.**
   - Track `staleAt` and `lastProgressAt`.
   - Emit events and mark blocked for overdue child work rather than retrying automatically.

6. **Introduce an orchestrator-only Slack emission layer.**
   - First version can be local-only planning metadata plus structured emission decisions.
   - Do not let children freeform-post.

7. **Formalize review gates.**
   - Child completion should land in `review` with `reviewState=pending_parent`.
   - Parent `done` should require explicit orchestrator approval.

8. **Preserve manual repair.**
   - Document invariants and repair rules so humans can fix broken task state by editing files and appending repair events.

## 8. Explicit answers to the PM open questions

### 8.1 What is the minimal canonical task schema needed to support ownership, hierarchy, review, and Slack visibility without overfitting Phase 2?

Use:
- `id`, `title`, `goal`, `parentTaskId`, `role`, `ownerType`, `ownerSessionKey`, `status`, `priority`, `requestedDeliverable`, `summary`, `nextAction`, `escalationTarget`, `reviewState`, `slackThreadKey`, `createdAt`, `updatedAt`, `completedAt`, optional `tags`.

This is enough to support ownership, hierarchy, review, and external visibility without introducing workflow DSL complexity.

### 8.2 How should parent and child status roll-up work when siblings are in mixed states such as running, blocked, and review?

Use orchestrator-biased roll-up, not purely automatic roll-up.

Suggested precedence:
1. `blocked` / `failed`
2. `review`
3. `running` / `assigned`
4. waiting states
5. `done`

Practical rule:
- any unresolved blocked/failed child makes the parent `blocked` unless the orchestrator explicitly handles it elsewhere;
- otherwise, any review-ready child can make parent `review` if parent attention is the next bottleneck;
- otherwise, active children keep parent `waiting_on_child`.

### 8.3 What mechanism should detect stale child tasks or lost sessions in a file-first system?

Use expected check-in deadlines stored as `staleAt`, refreshed on assignment and meaningful progress updates. A periodic control-plane check compares current time to `staleAt`. If overdue, emit `task.stale_detected`. If session tracking also shows the child disappeared, emit `task.session_lost`. Then return the task to orchestrator control via `blocked`.

### 8.4 Which events should be append-only versus which fields should be mutable snapshots?

Append-only:
- assignment
- ownership change
- status change
- progress milestones
- blocker declarations
- handoff written
- review approved/rejected
- stale/lost-session detection
- Slack emission records
- repair actions

Mutable snapshots:
- current `status`
- current `summary`
- current `nextAction`
- current owner fields
- `reviewState`
- `staleAt`
- `lastProgressAt`
- `updatedAt`

### 8.5 How should review gates be represented so a parent can distinguish "child finished" from "user-ready finished"?

Represent them separately:
- task `status=review` means child has returned control and parent review is required
- `reviewState=pending_parent` means not yet accepted
- `status=done` requires orchestrator approval and means accepted for workflow purposes

For parent tasks, `done` should also imply user-ready unless the orchestrator intentionally keeps a higher-level task in review.

### 8.6 How should direct child-to-Slack updates be controlled to prevent noisy or conflicting messages?

Default deny. Only orchestrator emits Slack by default. Allow direct child updates only when task metadata explicitly enables it and constrains message type, thread destination, and role identity. All direct emissions must still be logged locally and should never include final completion authority.

### 8.7 What is the failure model when a child agent disappears after partial output: retry, reassign, mark blocked, or require orchestrator intervention?

In V2: mark blocked and require orchestrator intervention.

The orchestrator may then choose to reassign or retry manually, but automatic retry should wait. This avoids duplicate work, conflicting outputs, and hidden control-plane behavior while the contract is still stabilizing.

### 8.8 What data must be stored locally so Slack threads remain reconstructible even if message delivery fails or edits occur later?

Store:
- task ID and parent task ID
- logical Slack thread key
- emitted message class
- full emitted text snapshot
- source actor type and role
- local event timestamp
- remote channel/thread/message IDs when available
- delivery status
- edit/supersede chain

This is enough to reconstruct what the system intended to communicate and how that mapped to the local workflow.

### 8.9 How should role identity be encoded so it is consistent across task records, orchestration logic, and Slack presentation?

Use a canonical role key in records, such as `software-architect`, and optionally a display label mapping such as `Software Architect`. The canonical key should drive routing and policy; the display label should drive Slack presentation. Do not store freeform role names as the system key.

### 8.10 What is the simplest technical path from the current tracker to this orchestration contract without breaking inspectability and manual repair?

The simplest path is an additive evolution:
1. keep the current directory-per-task model;
2. extend `task.json` and `status.json` with ownership/review/slack fields;
3. add `handoff.json`;
4. expand status vocabulary and event taxonomy;
5. add parent-child and stale-detection helper commands;
6. add a local Slack emission ledger before real transport complexity;
7. document invariants and manual repair procedures.

This preserves today’s inspectable model while giving the orchestrator real control-plane semantics.