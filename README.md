# milo workspace backup

Sanitized backup of Milo's OpenClaw workspace.

## Included
- workspace docs, memory structure, workflow docs
- agent role definitions and orchestration materials
- project files that are safe to version

## Excluded
Secrets, runtime tokens, local logs, caches, dependency folders, and machine-local state are ignored via `.gitignore`.

See `GIT_UPDATE_PROCEDURE.md` for the safe update flow.
