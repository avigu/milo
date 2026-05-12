# Orchestration Workspace

This directory contains the first version of the internal multi-agent orchestration system.

## Current focus

The tracker is now in **V2 file-first orchestration mode**:
- durable task identity
- explicit owner/orchestrator semantics
- parent/child hierarchy
- richer lifecycle states
- structured handoff files
- append-only events
- optional Slack emission ledger
- SQLite mirror for queryable state
- generated summary index

## Layout

```text
orchestration/
  README.md
  tracker.py
  agents/
  docs/
  tasks/
    <task-id>/
      task.json
      status.json
      events.jsonl
      handoff.json
      result.md
      slack_messages.jsonl
  state/
    index.json
    tasks.db
```

## Core model

### task.json
Durable identity and orchestration metadata, including:
- `id`
- `title`
- `goal`
- `parentTaskId`
- `role`
- `ownerType`
- `ownerSessionKey`
- `requestedDeliverable`
- `escalationTarget`
- `slackThreadKey`
- `reviewState`

### status.json
Mutable coordination snapshot, including:
- `status`
- `summary`
- `nextAction`
- `ownerType`
- `ownerSessionKey`
- `reviewState`
- `waitingReason`
- `staleAt`
- `lastProgressAt`
- `updatedAt`

### events.jsonl
Append-only audit log with:
- `type`
- `actorType`
- `actorRole`
- `visibility`
- `message`
- `data`

### handoff.json
Structured child-to-parent return package.

### slack_messages.jsonl
Local ledger of Slack-visible updates.

## DB capabilities

The file system remains the **source of truth**.

In addition, the tracker now keeps a SQLite mirror at:

```text
orchestration/state/tasks.db
```

This DB is rebuilt/synced automatically whenever tracker state changes, and provides:
- a `tasks` table for current task state
- a `task_events` table for append-only event history
- a `task_handoffs` table for structured child returns
- a `slack_messages` table for emitted Slack ledger entries
- an `open_tasks` SQL view for active work

## Status vocabulary

- `queued`
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

## Tracker commands

Initialize layout:

```bash
python3 orchestration/tracker.py init
```

Create a task:

```bash
python3 orchestration/tracker.py create \
  --title "Design PM pass" \
  --role product-manager \
  --status assigned \
  --owner-type child \
  --owner-session agent:main:subagent:xyz \
  --requested-deliverable "requirements brief" \
  --summary "Ready for PM execution" \
  --next-action "Spawn PM agent"
```

List tasks:

```bash
python3 orchestration/tracker.py list --open-only
```

Show a task:

```bash
python3 orchestration/tracker.py show <task-id> --with-events --with-slack
```

Update status:

```bash
python3 orchestration/tracker.py update-status <task-id> running \
  --actor-type child \
  --actor-role product-manager \
  --touch-progress \
  --stale-in-minutes 30 \
  --summary "Work started"
```

Write a structured handoff:

```bash
python3 orchestration/tracker.py set-handoff <task-id> \
  --kind review_ready \
  --completed-work "Requirements draft completed" \
  --artifacts docs/pm-design-round.md \
  --recommendation "Hand to architect" \
  --bump-status \
  --actor-role product-manager
```

Record a Slack update locally:

```bash
python3 orchestration/tracker.py record-slack <task-id> acknowledgement "Started" \
  --channel C0B2S81S0NA \
  --thread-key 1778406327.103319
```

Show child tasks:

```bash
python3 orchestration/tracker.py show-children <parent-task-id>
```

Compute parent roll-up suggestion:

```bash
python3 orchestration/tracker.py rollup <parent-task-id>
```

Detect stale tasks:

```bash
python3 orchestration/tracker.py stale-check
python3 orchestration/tracker.py stale-check --apply
```

Force DB sync:

```bash
python3 orchestration/tracker.py db-sync
```

Show DB summary:

```bash
python3 orchestration/tracker.py db-summary
```

## Operational rules

- `review` is a first-class gate; child-finished work is not automatically `done`.
- Parent tasks should usually move to `waiting_on_child` while children are active.
- Parent tasks become `done` only by explicit orchestrator action.
- Child completion should normally create `handoff.json` and move to `review`.
- Slack should be orchestrator-led by default; child direct posting is opt-in policy, not the default.
- All important state changes should append an event.
- After a child task is finished and its outputs are captured, the orchestrator should clean up no-longer-needed child sessions so closed work does not leave session clutter behind.

## Why this stays file-first

This design is intentionally inspectable and repairable by hand.
The planned migration path remains:
- files first
- SQLite later
- richer Slack orchestration after the control plane is stable
