# Git update procedure for Milo workspace

## Goal
Keep a safe GitHub backup of the workspace without leaking secrets.

## Before every push
1. Review changes: `git status`
2. Check staged diff: `git diff --cached`
3. Make sure no secrets were added accidentally:
   - `.env`
   - token / credential files
   - logs
   - local runtime state
4. If a new secret-like file appears, add it to `.gitignore` before staging.

## First-time repo bootstrap
```bash
git config --global --add safe.directory /data/.openclaw/workspace
git init
git add .gitignore GIT_UPDATE_PROCEDURE.md
git add .
git commit -m "Initial sanitized workspace backup"
git remote add origin <repo-url>
git push -u origin master
```

## Ongoing update flow
```bash
git status
git add -A
git diff --cached
git commit -m "Describe the workspace update"
git push
```

## If a secret was committed by mistake
1. Stop pushing.
2. Remove the file from the repo and add/update `.gitignore`.
3. Rotate the exposed credential.
4. Rewrite history only if needed.

## Current known ignored sensitive/local paths
- `.openclaw/`
- `.trash/`
- `google-calendar-bridge/data/`
- `myfinapp/.env`
- `agent-profiles/full-config-with-agents.json`
- `state/*config-snapshot*.json`
- log files
- dependency directories
