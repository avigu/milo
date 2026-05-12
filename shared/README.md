# Shared Workspace

This is the shared coordination layer for the transparent workshop workflow.

## Purpose
The agents now have separate private workspaces, but they still need a common surface for task-level state.
This shared area supports that.

## Subfolders
### `drive/`
References, exported artifacts, and mirrored structure related to the Drive task folder.

### `slack/`
Slack thread references, summaries, and workflow-oriented coordination notes.

### `decisions/`
Short decision logs, resolved questions, and milestone summaries that belong to the task rather than one specific role.

### `artifacts/`
Outputs produced by the workflow that should remain shared across roles.

## Workflow model
- Slack thread = live workshop engine
- Drive folder = structured documentation/state
- Shared workspace = local cross-role coordination layer
- Milo = orchestrator and gatekeeper

## Rule of thumb
If a file belongs to one role's private working process, keep it in that agent's folder.
If it belongs to the task as a whole, put it here.
