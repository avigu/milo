#!/usr/bin/env python3
import argparse
import json
import re
import sqlite3
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile

ROOT = Path(__file__).resolve().parent
TASKS_DIR = ROOT / "tasks"
STATE_DIR = ROOT / "state"
INDEX_PATH = STATE_DIR / "index.json"
DB_PATH = STATE_DIR / "tasks.db"

VALID_STATUSES = {
    "queued",
    "planning",
    "assigned",
    "running",
    "waiting_on_child",
    "waiting_on_user",
    "waiting_on_external",
    "blocked",
    "review",
    "done",
    "failed",
    "cancelled",
}
TERMINAL_STATUSES = {"done", "failed", "cancelled"}
WAITING_STATUSES = {"waiting_on_child", "waiting_on_user", "waiting_on_external"}
VALID_REVIEW_STATES = {"none", "pending_parent", "approved", "needs_revision"}
VALID_OWNER_TYPES = {"orchestrator", "child"}
VALID_VISIBILITY = {"internal", "parent", "slack_candidate", "slack_emitted"}
VALID_SLACK_MESSAGE_CLASSES = {
    "acknowledgement",
    "progress_summary",
    "blocker_escalation",
    "completion_summary",
}

ALLOWED_TRANSITIONS = {
    "queued": {"planning", "assigned", "cancelled"},
    "planning": {"assigned", "cancelled"},
    "assigned": {"running", "cancelled"},
    "running": {
        "waiting_on_user",
        "waiting_on_external",
        "blocked",
        "review",
        "failed",
        "cancelled",
    },
    "waiting_on_user": {"running", "cancelled"},
    "waiting_on_external": {"running", "blocked", "cancelled"},
    "waiting_on_child": {"running", "review", "blocked", "cancelled"},
    "blocked": {"running", "failed", "cancelled"},
    "review": {"running", "done", "failed", "cancelled"},
    "done": set(),
    "failed": set(),
    "cancelled": set(),
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str | None):
    if not value:
        return None
    value = value.replace("Z", "+00:00")
    return datetime.fromisoformat(value)


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "task"


def ensure_layout() -> None:
    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not INDEX_PATH.exists():
        write_json(INDEX_PATH, {"tasks": [], "updatedAt": now_iso()})
    ensure_db()


def ensure_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                goal TEXT,
                parent_task_id TEXT,
                role TEXT NOT NULL,
                priority TEXT,
                owner_type TEXT,
                owner_session_key TEXT,
                child_session_key TEXT,
                requested_deliverable TEXT,
                summary TEXT,
                next_action TEXT,
                escalation_target TEXT,
                slack_thread_key TEXT,
                review_state TEXT,
                status TEXT NOT NULL,
                waiting_reason TEXT,
                stale_at TEXT,
                last_progress_at TEXT,
                created_at TEXT,
                updated_at TEXT,
                completed_at TEXT,
                tags_json TEXT,
                child_count INTEGER DEFAULT 0,
                unresolved_child_count INTEGER DEFAULT 0,
                rollup_suggested_status TEXT
            );

            CREATE TABLE IF NOT EXISTS task_events (
                task_id TEXT NOT NULL,
                ordinal INTEGER NOT NULL,
                ts TEXT,
                type TEXT,
                actor_type TEXT,
                actor_role TEXT,
                visibility TEXT,
                status TEXT,
                message TEXT,
                data_json TEXT,
                PRIMARY KEY (task_id, ordinal)
            );

            CREATE TABLE IF NOT EXISTS task_handoffs (
                task_id TEXT PRIMARY KEY,
                kind TEXT,
                completed_work TEXT,
                artifacts_json TEXT,
                decisions_json TEXT,
                unresolved_issues_json TEXT,
                recommendation TEXT,
                validation_note TEXT,
                confidence TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS slack_messages (
                task_id TEXT NOT NULL,
                ordinal INTEGER NOT NULL,
                ts TEXT,
                message_class TEXT,
                channel TEXT,
                thread_key TEXT,
                remote_message_id TEXT,
                actor_type TEXT,
                actor_role TEXT,
                status TEXT,
                text TEXT,
                supersedes TEXT,
                delivery_status TEXT,
                PRIMARY KEY (task_id, ordinal)
            );

            CREATE VIEW IF NOT EXISTS open_tasks AS
            SELECT *
            FROM tasks
            WHERE status NOT IN ('done', 'failed', 'cancelled');
            """
        )


def rebuild_db_from_files() -> None:
    ensure_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM task_events")
        conn.execute("DELETE FROM task_handoffs")
        conn.execute("DELETE FROM slack_messages")
        for task_id in list_task_ids():
            task, status = load_task_record(task_id)
            rollup = compute_rollup(task_id, parent_status=status["status"])
            conn.execute(
                """
                INSERT INTO tasks (
                    id, title, goal, parent_task_id, role, priority, owner_type,
                    owner_session_key, child_session_key, requested_deliverable,
                    summary, next_action, escalation_target, slack_thread_key,
                    review_state, status, waiting_reason, stale_at, last_progress_at,
                    created_at, updated_at, completed_at, tags_json, child_count,
                    unresolved_child_count, rollup_suggested_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task["id"],
                    task.get("title"),
                    task.get("goal"),
                    task.get("parentTaskId"),
                    task.get("role"),
                    task.get("priority"),
                    status.get("ownerType"),
                    status.get("ownerSessionKey"),
                    task.get("childSessionKey"),
                    task.get("requestedDeliverable"),
                    status.get("summary"),
                    status.get("nextAction"),
                    task.get("escalationTarget"),
                    task.get("slackThreadKey"),
                    status.get("reviewState"),
                    status.get("status"),
                    status.get("waitingReason"),
                    status.get("staleAt"),
                    status.get("lastProgressAt"),
                    task.get("createdAt"),
                    status.get("updatedAt"),
                    task.get("completedAt"),
                    json.dumps(task.get("tags", []), ensure_ascii=False),
                    len(rollup["childIds"]),
                    len(rollup["unresolvedChildIds"]),
                    rollup.get("suggestedStatus"),
                ),
            )

            for idx, event in enumerate(read_jsonl(events_path(task_id)), start=1):
                conn.execute(
                    """
                    INSERT INTO task_events (
                        task_id, ordinal, ts, type, actor_type, actor_role,
                        visibility, status, message, data_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        task_id,
                        idx,
                        event.get("ts"),
                        event.get("type"),
                        event.get("actorType"),
                        event.get("actorRole"),
                        event.get("visibility"),
                        event.get("status"),
                        event.get("message"),
                        json.dumps(event.get("data"), ensure_ascii=False),
                    ),
                )

            hp = handoff_path(task_id)
            if hp.exists():
                handoff = read_json(hp)
                conn.execute(
                    """
                    INSERT INTO task_handoffs (
                        task_id, kind, completed_work, artifacts_json, decisions_json,
                        unresolved_issues_json, recommendation, validation_note,
                        confidence, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        task_id,
                        handoff.get("kind"),
                        handoff.get("completedWork"),
                        json.dumps(handoff.get("artifacts", []), ensure_ascii=False),
                        json.dumps(handoff.get("decisions", []), ensure_ascii=False),
                        json.dumps(handoff.get("unresolvedIssues", []), ensure_ascii=False),
                        handoff.get("recommendation"),
                        handoff.get("validationNote"),
                        handoff.get("confidence"),
                        handoff.get("createdAt"),
                    ),
                )

            for idx, message in enumerate(read_jsonl(slack_messages_path(task_id)), start=1):
                conn.execute(
                    """
                    INSERT INTO slack_messages (
                        task_id, ordinal, ts, message_class, channel, thread_key,
                        remote_message_id, actor_type, actor_role, status, text,
                        supersedes, delivery_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        task_id,
                        idx,
                        message.get("ts"),
                        message.get("messageClass"),
                        message.get("channel"),
                        message.get("threadKey"),
                        message.get("remoteMessageId"),
                        message.get("actorType"),
                        message.get("actorRole"),
                        message.get("status"),
                        message.get("text"),
                        message.get("supersedes"),
                        message.get("deliveryStatus"),
                    ),
                )
        conn.commit()


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", delete=False, dir=str(path.parent), encoding="utf-8") as tmp:
        json.dump(data, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def append_jsonl(path: Path, entry: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_jsonl(path: Path):
    if not path.exists():
        return []
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def task_dir(task_id: str) -> Path:
    return TASKS_DIR / task_id


def task_path(task_id: str) -> Path:
    return task_dir(task_id) / "task.json"


def status_path(task_id: str) -> Path:
    return task_dir(task_id) / "status.json"


def events_path(task_id: str) -> Path:
    return task_dir(task_id) / "events.jsonl"


def result_path(task_id: str) -> Path:
    return task_dir(task_id) / "result.md"


def handoff_path(task_id: str) -> Path:
    return task_dir(task_id) / "handoff.json"


def slack_messages_path(task_id: str) -> Path:
    return task_dir(task_id) / "slack_messages.jsonl"


def task_defaults(task: dict) -> dict:
    task.setdefault("goal", task.get("title", ""))
    task.setdefault("parentTaskId", None)
    task.setdefault("priority", "medium")
    task.setdefault("ownerType", "orchestrator")
    task.setdefault("ownerSessionKey", "agent:main:main")
    task.setdefault("childSessionKey", task.get("ownerSessionKey") if task.get("ownerType") == "child" else None)
    task.setdefault("requestedDeliverable", "")
    task.setdefault("summary", "")
    task.setdefault("nextAction", "")
    task.setdefault("escalationTarget", "orchestrator")
    task.setdefault("slackThreadKey", None)
    task.setdefault("reviewState", "none")
    task.setdefault("completedAt", None)
    task.setdefault("tags", [])
    return task


def status_defaults(status: dict, task: dict) -> dict:
    raw = status.get("status", "planning")
    if raw == "waiting":
        raw = "waiting_on_external"
    status["status"] = raw
    status.setdefault("summary", task.get("summary", ""))
    status.setdefault("nextAction", task.get("nextAction", ""))
    status.setdefault("ownerType", task.get("ownerType", "orchestrator"))
    status.setdefault("ownerSessionKey", task.get("ownerSessionKey", "agent:main:main"))
    status.setdefault("reviewState", task.get("reviewState", "none"))
    status.setdefault("waitingReason", infer_waiting_reason(raw))
    status.setdefault("staleAt", None)
    status.setdefault("lastProgressAt", None)
    status.setdefault("updatedAt", task.get("updatedAt", now_iso()))
    return status


def infer_waiting_reason(status: str) -> str:
    return {
        "waiting_on_child": "child",
        "waiting_on_user": "user",
        "waiting_on_external": "external",
    }.get(status, "none")


def load_task_record(task_id: str):
    tp = task_path(task_id)
    sp = status_path(task_id)
    if not tp.exists() or not sp.exists():
        raise SystemExit(f"Task not found: {task_id}")
    task = task_defaults(read_json(tp))
    status = status_defaults(read_json(sp), task)
    return task, status


def save_task_record(task_id: str, task: dict, status: dict) -> None:
    write_json(task_path(task_id), task_defaults(task))
    write_json(status_path(task_id), status_defaults(status, task))


def list_task_ids():
    ensure_layout()
    if not TASKS_DIR.exists():
        return []
    ids = []
    for path in TASKS_DIR.iterdir():
        if path.is_dir() and (path / "task.json").exists() and (path / "status.json").exists():
            ids.append(path.name)
    return sorted(ids)


def get_children(parent_task_id: str):
    children = []
    for task_id in list_task_ids():
        task, status = load_task_record(task_id)
        if task.get("parentTaskId") == parent_task_id:
            children.append({"task": task, "status": status})
    return children


def compute_rollup(parent_task_id: str, parent_status: str | None = None):
    children = get_children(parent_task_id)
    counts = Counter()
    for child in children:
        counts[child["status"]["status"]] += 1
    unresolved = [c for c in children if c["status"]["status"] not in TERMINAL_STATUSES]
    if parent_status in TERMINAL_STATUSES:
        suggestion = None
        reason = "parent_terminal"
    elif not children:
        suggestion = None
        reason = "no_children"
    elif counts["blocked"] or counts["failed"]:
        suggestion = "blocked"
        reason = "blocked_or_failed_child_present"
    elif counts["review"]:
        suggestion = "review"
        reason = "child_waiting_for_parent_review"
    elif counts["running"] or counts["assigned"]:
        suggestion = "waiting_on_child"
        reason = "child_actively_executing"
    elif counts["waiting_on_child"] or counts["waiting_on_user"] or counts["waiting_on_external"]:
        suggestion = "waiting_on_child"
        reason = "child_waiting_state_present"
    elif unresolved:
        suggestion = "waiting_on_child"
        reason = "unresolved_children_present"
    else:
        suggestion = "review"
        reason = "all_children_resolved_parent_should_review"
    return {
        "childCounts": dict(counts),
        "suggestedStatus": suggestion,
        "reason": reason,
        "childIds": [c["task"]["id"] for c in children],
        "unresolvedChildIds": [c["task"]["id"] for c in unresolved],
    }


def sync_index() -> None:
    rows = []
    for task_id in list_task_ids():
        task, status = load_task_record(task_id)
        rollup = compute_rollup(task_id, parent_status=status["status"])
        rows.append({
            "id": task["id"],
            "title": task["title"],
            "role": task["role"],
            "status": status["status"],
            "priority": task["priority"],
            "ownerType": status.get("ownerType"),
            "ownerSessionKey": status.get("ownerSessionKey"),
            "parentTaskId": task.get("parentTaskId"),
            "reviewState": status.get("reviewState"),
            "updatedAt": status["updatedAt"],
            "summary": status.get("summary", ""),
            "nextAction": status.get("nextAction", ""),
            "staleAt": status.get("staleAt"),
            "childCount": len(rollup["childIds"]),
            "unresolvedChildCount": len(rollup["unresolvedChildIds"]),
            "rollupSuggestedStatus": rollup["suggestedStatus"],
        })
    write_json(INDEX_PATH, {"tasks": rows, "updatedAt": now_iso()})
    rebuild_db_from_files()


def validate_status(status: str) -> None:
    if status not in VALID_STATUSES:
        raise SystemExit(f"Invalid status: {status}")


def validate_transition(current: str, new: str, force: bool = False) -> None:
    if force or current == new:
        return
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise SystemExit(f"Invalid transition: {current} -> {new}")


def emit_event(task_id: str, event_type: str, message: str, *, actor_type: str = "orchestrator", actor_role: str = "orchestrator", visibility: str = "internal", status: str | None = None, data=None, ts: str | None = None):
    append_jsonl(events_path(task_id), {
        "ts": ts or now_iso(),
        "taskId": task_id,
        "type": event_type,
        "actorType": actor_type,
        "actorRole": actor_role,
        "visibility": visibility,
        "status": status,
        "message": message,
        "data": data,
    })


def create_task(args) -> None:
    ensure_layout()
    validate_status(args.status)
    if args.owner_type not in VALID_OWNER_TYPES:
        raise SystemExit(f"Invalid owner type: {args.owner_type}")
    task_id = args.id or f"task-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{slugify(args.title)[:24]}-{uuid.uuid4().hex[:6]}"
    created_at = now_iso()
    td = task_dir(task_id)
    td.mkdir(parents=True, exist_ok=False)
    stale_at = None
    if args.stale_in_minutes:
        stale_at = (datetime.now(timezone.utc) + timedelta(minutes=args.stale_in_minutes)).isoformat().replace("+00:00", "Z")
    task = {
        "id": task_id,
        "title": args.title,
        "goal": args.goal or args.title,
        "parentTaskId": args.parent_task_id,
        "role": args.role,
        "priority": args.priority,
        "ownerType": args.owner_type,
        "ownerSessionKey": args.owner_session or "agent:main:main",
        "childSessionKey": args.child_session,
        "requestedDeliverable": args.requested_deliverable or "",
        "summary": args.summary or "",
        "nextAction": args.next_action or "",
        "escalationTarget": args.escalation_target or "orchestrator",
        "slackThreadKey": args.slack_thread_key,
        "reviewState": args.review_state,
        "createdAt": created_at,
        "updatedAt": created_at,
        "completedAt": created_at if args.status == "done" else None,
        "tags": args.tags or [],
    }
    status = {
        "status": args.status,
        "summary": args.summary or "",
        "nextAction": args.next_action or "",
        "ownerType": args.owner_type,
        "ownerSessionKey": args.owner_session or "agent:main:main",
        "reviewState": args.review_state,
        "waitingReason": infer_waiting_reason(args.status),
        "staleAt": stale_at,
        "lastProgressAt": created_at if args.status in {"running", "review"} else None,
        "updatedAt": created_at,
    }
    save_task_record(task_id, task, status)
    emit_event(
        task_id,
        "task.created",
        args.summary or f"Task created for role={args.role}",
        actor_type="orchestrator",
        actor_role="orchestrator",
        visibility="internal",
        status=args.status,
        data={
            "requestedDeliverable": task["requestedDeliverable"],
            "parentTaskId": task["parentTaskId"],
        },
        ts=created_at,
    )
    sync_index()
    print(task_id)


def list_tasks(args) -> None:
    ensure_layout()
    index = read_json(INDEX_PATH)
    rows = index.get("tasks", [])
    if args.status:
        rows = [r for r in rows if r["status"] == args.status]
    if args.role:
        rows = [r for r in rows if r["role"] == args.role]
    if args.parent_task_id:
        rows = [r for r in rows if r.get("parentTaskId") == args.parent_task_id]
    if args.open_only:
        rows = [r for r in rows if r["status"] not in TERMINAL_STATUSES]
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return
    if not rows:
        print("No tasks")
        return
    for row in rows:
        print(f"{row['id']} | {row['status']} | {row['role']} | {row['title']}")
        print(f"  owner: {row['ownerType']} {row['ownerSessionKey']}")
        if row.get("summary"):
            print(f"  summary: {row['summary']}")
        if row.get("nextAction"):
            print(f"  next: {row['nextAction']}")
        if row.get("parentTaskId"):
            print(f"  parent: {row['parentTaskId']}")
        if row.get("childCount"):
            print(f"  children: {row['childCount']} (unresolved {row['unresolvedChildCount']})")
        if row.get("rollupSuggestedStatus"):
            print(f"  rollup: {row['rollupSuggestedStatus']}")


def show_task(args) -> None:
    ensure_layout()
    task, status = load_task_record(args.task_id)
    payload = {
        "task": task,
        "status": status,
        "children": [c["task"]["id"] for c in get_children(args.task_id)],
        "rollup": compute_rollup(args.task_id, parent_status=status["status"]),
        "handoff": read_json(handoff_path(args.task_id)) if handoff_path(args.task_id).exists() else None,
        "result": result_path(args.task_id).read_text(encoding="utf-8") if result_path(args.task_id).exists() else None,
    }
    if args.with_events:
        payload["events"] = read_jsonl(events_path(args.task_id))
    if args.with_slack:
        payload["slackMessages"] = read_jsonl(slack_messages_path(args.task_id))
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def update_status(args) -> None:
    ensure_layout()
    validate_status(args.status)
    task, status = load_task_record(args.task_id)
    validate_transition(status["status"], args.status, args.force)
    ts = now_iso()
    old_status = status["status"]
    status["status"] = args.status
    if args.summary is not None:
        status["summary"] = args.summary
        task["summary"] = args.summary
    if args.next_action is not None:
        status["nextAction"] = args.next_action
        task["nextAction"] = args.next_action
    if args.owner_type is not None:
        if args.owner_type not in VALID_OWNER_TYPES:
            raise SystemExit(f"Invalid owner type: {args.owner_type}")
        status["ownerType"] = args.owner_type
        task["ownerType"] = args.owner_type
    if args.owner_session is not None:
        status["ownerSessionKey"] = args.owner_session
        task["ownerSessionKey"] = args.owner_session
    if args.child_session is not None:
        task["childSessionKey"] = args.child_session
    if args.review_state is not None:
        if args.review_state not in VALID_REVIEW_STATES:
            raise SystemExit(f"Invalid review state: {args.review_state}")
        status["reviewState"] = args.review_state
        task["reviewState"] = args.review_state
    status["waitingReason"] = args.waiting_reason if args.waiting_reason is not None else infer_waiting_reason(args.status)
    if args.clear_stale:
        status["staleAt"] = None
    elif args.stale_in_minutes is not None:
        status["staleAt"] = (datetime.now(timezone.utc) + timedelta(minutes=args.stale_in_minutes)).isoformat().replace("+00:00", "Z")
    if args.touch_progress:
        status["lastProgressAt"] = ts
    elif args.last_progress_at is not None:
        status["lastProgressAt"] = args.last_progress_at
    status["updatedAt"] = ts
    task["updatedAt"] = ts
    if args.status == "done":
        task["completedAt"] = ts
        if status.get("reviewState") == "pending_parent":
            status["reviewState"] = "approved"
            task["reviewState"] = "approved"
    elif args.status in {"running", "blocked", "review"} and not args.force:
        task["completedAt"] = None
    save_task_record(args.task_id, task, status)
    emit_event(
        args.task_id,
        args.event_type or "task.status_updated",
        args.event_message or args.summary or f"Status updated: {old_status} -> {args.status}",
        actor_type=args.actor_type,
        actor_role=args.actor_role,
        visibility=args.visibility,
        status=args.status,
        data={"from": old_status, "to": args.status},
        ts=ts,
    )
    sync_index()
    print(args.task_id)


def add_event(args) -> None:
    ensure_layout()
    visibility = args.visibility or "internal"
    if visibility not in VALID_VISIBILITY:
        raise SystemExit(f"Invalid visibility: {visibility}")
    data = json.loads(args.data) if args.data else None
    emit_event(
        args.task_id,
        args.event_type,
        args.message,
        actor_type=args.actor_type,
        actor_role=args.actor_role,
        visibility=visibility,
        status=args.status,
        data=data,
    )
    if args.bump_status:
        class Obj: pass
        obj = Obj()
        obj.task_id = args.task_id
        obj.status = args.bump_status
        obj.summary = None
        obj.next_action = None
        obj.owner_type = None
        obj.owner_session = None
        obj.child_session = None
        obj.review_state = None
        obj.waiting_reason = None
        obj.stale_in_minutes = None
        obj.clear_stale = False
        obj.touch_progress = False
        obj.last_progress_at = None
        obj.event_message = args.message
        obj.event_type = "task.status_updated"
        obj.actor_type = args.actor_type
        obj.actor_role = args.actor_role
        obj.visibility = visibility
        obj.force = False
        update_status(obj)
    else:
        print(args.task_id)


def write_result(args) -> None:
    ensure_layout()
    rp = result_path(args.task_id)
    rp.write_text(args.content, encoding="utf-8")
    emit_event(
        args.task_id,
        "task.result_written",
        "Result updated",
        actor_type=args.actor_type,
        actor_role=args.actor_role,
        visibility=args.visibility,
    )
    if args.mark_done:
        class Obj: pass
        obj = Obj()
        obj.task_id = args.task_id
        obj.status = "done"
        obj.summary = args.summary or "Task completed"
        obj.next_action = args.next_action or "Review result"
        obj.owner_type = None
        obj.owner_session = None
        obj.child_session = None
        obj.review_state = "approved"
        obj.waiting_reason = None
        obj.stale_in_minutes = None
        obj.clear_stale = True
        obj.touch_progress = True
        obj.last_progress_at = None
        obj.event_message = obj.summary
        obj.event_type = "task.done"
        obj.actor_type = args.actor_type
        obj.actor_role = args.actor_role
        obj.visibility = args.visibility
        obj.force = False
        update_status(obj)
    else:
        sync_index()
        print(args.task_id)


def set_handoff(args) -> None:
    ensure_layout()
    task, status = load_task_record(args.task_id)
    ts = now_iso()
    handoff = {
        "taskId": args.task_id,
        "kind": args.kind,
        "completedWork": args.completed_work or "",
        "artifacts": args.artifacts or [],
        "decisions": args.decisions or [],
        "unresolvedIssues": args.unresolved_issues or [],
        "recommendation": args.recommendation or "",
        "validationNote": args.validation_note or "",
        "confidence": args.confidence,
        "createdAt": ts,
    }
    write_json(handoff_path(args.task_id), handoff)
    if args.kind in {"completion", "review_ready"}:
        status_target = "review"
        review_state = "pending_parent"
    elif args.kind == "blocker":
        status_target = "blocked"
        review_state = status.get("reviewState", "none")
    else:
        status_target = status["status"]
        review_state = status.get("reviewState", "none")
    save_task_record(args.task_id, task, status)
    emit_event(
        args.task_id,
        "task.handoff_written",
        args.summary or f"Handoff written ({args.kind})",
        actor_type=args.actor_type,
        actor_role=args.actor_role,
        visibility=args.visibility,
        status=status_target,
        data={"kind": args.kind, "confidence": args.confidence},
        ts=ts,
    )
    if args.bump_status:
        class Obj: pass
        obj = Obj()
        obj.task_id = args.task_id
        obj.status = status_target
        obj.summary = args.summary or status.get("summary") or f"Handoff ready: {args.kind}"
        obj.next_action = args.next_action or task.get("nextAction") or "Parent review"
        obj.owner_type = None
        obj.owner_session = None
        obj.child_session = None
        obj.review_state = review_state
        obj.waiting_reason = None
        obj.stale_in_minutes = None
        obj.clear_stale = True
        obj.touch_progress = True
        obj.last_progress_at = None
        obj.event_message = args.summary or f"Task moved to {status_target} after handoff"
        obj.event_type = "task.review_ready" if status_target == "review" else "task.blocked"
        obj.actor_type = args.actor_type
        obj.actor_role = args.actor_role
        obj.visibility = args.visibility
        obj.force = args.force
        update_status(obj)
    else:
        sync_index()
        print(args.task_id)


def record_slack(args) -> None:
    ensure_layout()
    if args.message_class not in VALID_SLACK_MESSAGE_CLASSES:
        raise SystemExit(f"Invalid slack message class: {args.message_class}")
    task, status = load_task_record(args.task_id)
    entry = {
        "ts": now_iso(),
        "taskId": args.task_id,
        "messageClass": args.message_class,
        "channel": args.channel,
        "threadKey": args.thread_key,
        "remoteMessageId": args.remote_message_id,
        "actorType": args.actor_type,
        "actorRole": args.actor_role,
        "status": status["status"],
        "text": args.text,
        "supersedes": args.supersedes,
        "deliveryStatus": args.delivery_status,
    }
    append_jsonl(slack_messages_path(args.task_id), entry)
    if args.thread_key and task.get("slackThreadKey") != args.thread_key:
        task["slackThreadKey"] = args.thread_key
        save_task_record(args.task_id, task, status)
    emit_event(
        args.task_id,
        "slack.message_emitted",
        f"Slack {args.message_class} recorded",
        actor_type=args.actor_type,
        actor_role=args.actor_role,
        visibility="slack_emitted",
        status=status["status"],
        data={
            "channel": args.channel,
            "threadKey": args.thread_key,
            "remoteMessageId": args.remote_message_id,
        },
    )
    sync_index()
    print(args.task_id)


def show_children(args) -> None:
    ensure_layout()
    children = get_children(args.task_id)
    payload = []
    for child in children:
        payload.append({
            "id": child["task"]["id"],
            "title": child["task"]["title"],
            "role": child["task"]["role"],
            "status": child["status"]["status"],
            "summary": child["status"].get("summary", ""),
            "reviewState": child["status"].get("reviewState"),
        })
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def rollup(args) -> None:
    ensure_layout()
    print(json.dumps(compute_rollup(args.task_id), ensure_ascii=False, indent=2))


def stale_check(args) -> None:
    ensure_layout()
    now = datetime.now(timezone.utc)
    findings = []
    for task_id in list_task_ids():
        task, status = load_task_record(task_id)
        stale_at = parse_iso(status.get("staleAt"))
        if not stale_at:
            continue
        if status["status"] in TERMINAL_STATUSES:
            continue
        if stale_at <= now:
            findings.append({
                "taskId": task_id,
                "status": status["status"],
                "staleAt": status.get("staleAt"),
                "summary": status.get("summary", ""),
            })
            emit_event(
                task_id,
                "task.stale_detected",
                "Task exceeded staleAt with no newer progress update",
                actor_type="system",
                actor_role="system",
                visibility="parent",
                status=status["status"],
                data={"staleAt": status.get("staleAt")},
            )
            if args.apply and status["status"] != "blocked":
                class Obj: pass
                obj = Obj()
                obj.task_id = task_id
                obj.status = "blocked"
                obj.summary = status.get("summary") or "Task became stale"
                obj.next_action = "Orchestrator intervention required"
                obj.owner_type = None
                obj.owner_session = None
                obj.child_session = None
                obj.review_state = status.get("reviewState")
                obj.waiting_reason = None
                obj.stale_in_minutes = None
                obj.clear_stale = True
                obj.touch_progress = False
                obj.last_progress_at = None
                obj.event_message = "Task marked blocked after stale detection"
                obj.event_type = "task.session_lost"
                obj.actor_type = "system"
                obj.actor_role = "system"
                obj.visibility = "parent"
                obj.force = False
                update_status(obj)
    sync_index()
    print(json.dumps(findings, ensure_ascii=False, indent=2))


def db_sync(args) -> None:
    ensure_layout()
    sync_index()
    print(str(DB_PATH))


def db_summary(args) -> None:
    ensure_layout()
    with sqlite3.connect(DB_PATH) as conn:
        task_count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        open_count = conn.execute("SELECT COUNT(*) FROM open_tasks").fetchone()[0]
        event_count = conn.execute("SELECT COUNT(*) FROM task_events").fetchone()[0]
        handoff_count = conn.execute("SELECT COUNT(*) FROM task_handoffs").fetchone()[0]
        slack_count = conn.execute("SELECT COUNT(*) FROM slack_messages").fetchone()[0]
    payload = {
        "dbPath": str(DB_PATH),
        "tasks": task_count,
        "openTasks": open_count,
        "events": event_count,
        "handoffs": handoff_count,
        "slackMessages": slack_count,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def init_layout(args) -> None:
    ensure_layout()
    sync_index()
    print(str(ROOT))


def build_parser():
    p = argparse.ArgumentParser(description="File-first orchestration task tracker")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("init")
    s.set_defaults(func=init_layout)

    s = sub.add_parser("create")
    s.add_argument("--id")
    s.add_argument("--title", required=True)
    s.add_argument("--role", required=True)
    s.add_argument("--priority", default="medium")
    s.add_argument("--status", default="queued", choices=sorted(VALID_STATUSES))
    s.add_argument("--summary")
    s.add_argument("--goal")
    s.add_argument("--next-action")
    s.add_argument("--parent-task-id")
    s.add_argument("--owner-type", default="orchestrator")
    s.add_argument("--owner-session")
    s.add_argument("--child-session")
    s.add_argument("--requested-deliverable")
    s.add_argument("--escalation-target")
    s.add_argument("--slack-thread-key")
    s.add_argument("--review-state", default="none", choices=sorted(VALID_REVIEW_STATES))
    s.add_argument("--stale-in-minutes", type=int)
    s.add_argument("--tags", nargs="*")
    s.set_defaults(func=create_task)

    s = sub.add_parser("list")
    s.add_argument("--status")
    s.add_argument("--role")
    s.add_argument("--parent-task-id")
    s.add_argument("--open-only", action="store_true")
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=list_tasks)

    s = sub.add_parser("show")
    s.add_argument("task_id")
    s.add_argument("--with-events", action="store_true")
    s.add_argument("--with-slack", action="store_true")
    s.set_defaults(func=show_task)

    s = sub.add_parser("update-status")
    s.add_argument("task_id")
    s.add_argument("status", choices=sorted(VALID_STATUSES))
    s.add_argument("--summary")
    s.add_argument("--next-action")
    s.add_argument("--owner-type")
    s.add_argument("--owner-session")
    s.add_argument("--child-session")
    s.add_argument("--review-state", choices=sorted(VALID_REVIEW_STATES))
    s.add_argument("--waiting-reason")
    s.add_argument("--stale-in-minutes", type=int)
    s.add_argument("--clear-stale", action="store_true")
    s.add_argument("--touch-progress", action="store_true")
    s.add_argument("--last-progress-at")
    s.add_argument("--event-message")
    s.add_argument("--event-type")
    s.add_argument("--actor-type", default="orchestrator")
    s.add_argument("--actor-role", default="orchestrator")
    s.add_argument("--visibility", default="internal", choices=sorted(VALID_VISIBILITY))
    s.add_argument("--force", action="store_true")
    s.set_defaults(func=update_status)

    s = sub.add_parser("event")
    s.add_argument("task_id")
    s.add_argument("event_type")
    s.add_argument("message")
    s.add_argument("--status")
    s.add_argument("--data")
    s.add_argument("--bump-status", choices=sorted(VALID_STATUSES))
    s.add_argument("--actor-type", default="orchestrator")
    s.add_argument("--actor-role", default="orchestrator")
    s.add_argument("--visibility", default="internal", choices=sorted(VALID_VISIBILITY))
    s.set_defaults(func=add_event)

    s = sub.add_parser("write-result")
    s.add_argument("task_id")
    s.add_argument("content")
    s.add_argument("--summary")
    s.add_argument("--next-action")
    s.add_argument("--mark-done", action="store_true")
    s.add_argument("--actor-type", default="orchestrator")
    s.add_argument("--actor-role", default="orchestrator")
    s.add_argument("--visibility", default="internal", choices=sorted(VALID_VISIBILITY))
    s.set_defaults(func=write_result)

    s = sub.add_parser("set-handoff")
    s.add_argument("task_id")
    s.add_argument("--kind", required=True, choices=["completion", "blocker", "review_ready"])
    s.add_argument("--completed-work")
    s.add_argument("--artifacts", nargs="*")
    s.add_argument("--decisions", nargs="*")
    s.add_argument("--unresolved-issues", nargs="*")
    s.add_argument("--recommendation")
    s.add_argument("--validation-note")
    s.add_argument("--confidence", default="medium", choices=["low", "medium", "high"])
    s.add_argument("--summary")
    s.add_argument("--next-action")
    s.add_argument("--bump-status", action="store_true")
    s.add_argument("--actor-type", default="child")
    s.add_argument("--actor-role", default="worker")
    s.add_argument("--visibility", default="parent", choices=sorted(VALID_VISIBILITY))
    s.add_argument("--force", action="store_true")
    s.set_defaults(func=set_handoff)

    s = sub.add_parser("record-slack")
    s.add_argument("task_id")
    s.add_argument("message_class", choices=sorted(VALID_SLACK_MESSAGE_CLASSES))
    s.add_argument("text")
    s.add_argument("--channel", required=True)
    s.add_argument("--thread-key")
    s.add_argument("--remote-message-id")
    s.add_argument("--actor-type", default="orchestrator")
    s.add_argument("--actor-role", default="orchestrator")
    s.add_argument("--supersedes")
    s.add_argument("--delivery-status", default="sent")
    s.set_defaults(func=record_slack)

    s = sub.add_parser("show-children")
    s.add_argument("task_id")
    s.set_defaults(func=show_children)

    s = sub.add_parser("rollup")
    s.add_argument("task_id")
    s.set_defaults(func=rollup)

    s = sub.add_parser("stale-check")
    s.add_argument("--apply", action="store_true")
    s.set_defaults(func=stale_check)

    s = sub.add_parser("db-sync")
    s.set_defaults(func=db_sync)

    s = sub.add_parser("db-summary")
    s.set_defaults(func=db_summary)

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
