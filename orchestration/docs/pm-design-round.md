# PM Design Round: V2 Tracking and Multi-Agent Orchestration

## 1. Objective of the System
Build an orchestration system that lets a parent assistant reliably plan, assign, monitor, and summarize multi-step work across child agents without losing user visibility or operational control.

The system should move from "task folders that record status" to "an orchestration layer that manages ownership, handoffs, waiting states, and user-facing updates across multiple agents and channels."

Operationally, the system must:
- keep the parent assistant responsive in chat;
- let multiple child agents work in parallel on bounded tasks;
- preserve a durable audit trail of decisions, status changes, and outputs;
- surface the right updates to users in Slack with clear identity and low noise;
- make it obvious when work is active, waiting, blocked, done, or needs escalation.

## 2. What Problem Must Be Solved First Now That a File-First Tracker Exists
The first problem is **control-plane clarity**.

We already have a file-first tracker that can record task state. What is still missing is a dependable model for:
- who owns a task right now;
- what a child agent is allowed to do versus what must return to the orchestrator;
- how parent and child status changes roll up into one coherent view;
- when the system should notify Slack versus stay quiet;
- how waiting, blockage, review, and completion are represented in a way that supports coordination rather than just logging.

In short: Phase 1 gave us storage. V2 must define **orchestration semantics**.

Until this is solved, adding more transport, automation, or UI will mostly produce noisier updates and less predictable execution.

## 3. Required Capabilities for V2 Tracking / Orchestration
V2 should support the following capabilities.

### 3.1 Task model with explicit ownership
Each task must have:
- stable task ID;
- parent task ID if it is delegated work;
- assigned role;
- current owner (orchestrator or child session);
- status;
- priority;
- requested deliverable;
- latest summary;
- next required action;
- escalation target when blocked.

### 3.2 Parent-child task hierarchy
The system must support:
- one parent task spawning multiple child tasks;
- clear linkage between parent and child tasks;
- roll-up status for the parent;
- prevention of orphaned child work;
- closure rules so parent completion requires child completion, cancellation, or explicit dismissal.

### 3.3 Structured lifecycle states for coordination
The status model should distinguish at least:
- planning;
- assigned;
- running;
- waiting_on_child;
- waiting_on_user;
- waiting_on_external;
- blocked;
- review;
- done;
- failed;
- cancelled.

These states are not just labels; they must drive behavior such as notification policy, escalation, and whether another agent may act.

### 3.4 Check-in and heartbeat expectations
A child agent should be able to report:
- started work;
- meaningful progress milestone;
- blocker;
- handoff-ready output;
- final completion.

The orchestrator should be able to detect:
- stale work with no update in expected time;
- completed work that still needs parent review;
- blocked work needing escalation;
- work that is waiting and should not generate repeated updates.

### 3.5 Result and handoff contract
Every child task should end with a structured handoff that includes:
- what was completed;
- artifacts produced;
- decisions made;
- unresolved issues;
- recommendation for the parent;
- confidence or validation note when relevant.

### 3.6 Notification routing and summarization
The system must support distinct update classes:
- internal tracking event;
- parent-only orchestration event;
- Slack-visible progress update;
- Slack-visible blocker/escalation;
- final user summary.

Not every state change should go to Slack. V2 needs batching or summarization logic so external updates are selective and useful.

### 3.7 Role-aware identity
Updates must preserve:
- which agent role is speaking;
- whether the message is from the orchestrator or a child agent;
- which task the update belongs to;
- whether the content is a status note, decision, blocker, or result.

### 3.8 Review and approval gates
The orchestrator must be able to hold a task in review before:
- notifying the user of completion;
- spawning follow-on work;
- marking a larger parent objective complete.

## 4. Clear Boundaries Between Orchestrator vs Child Agents

### Orchestrator responsibilities
The orchestrator is responsible for:
- interpreting the user goal;
- breaking work into tasks;
- assigning tasks to roles;
- setting task scope and expected deliverables;
- owning cross-task priorities and sequencing;
- consolidating child outputs into a coherent answer;
- deciding what should be sent to Slack;
- deciding when to escalate blockers or request user input;
- determining when a parent task is actually done.

The orchestrator is the system of coordination and user accountability.

### Child agent responsibilities
A child agent is responsible for:
- executing one bounded assignment;
- staying within the assigned role and task scope;
- reporting progress at meaningful checkpoints;
- surfacing blockers quickly;
- producing a concrete output or recommendation;
- returning control when the task is done or blocked.

A child agent should not:
- redefine the parent goal;
- spawn uncontrolled parallel work without orchestration rules;
- speak as the overall system owner;
- independently decide broad user-facing notification strategy;
- silently expand scope.

### Boundary rule
If a decision affects more than one task, more than one role, user expectation, or external visibility, it belongs to the orchestrator.

## 5. Requirements for Slack Visibility and Role-Based Identity in Updates
Slack is now assumed to be available, so visibility requirements should be first-class.

### 5.1 Slack update types
The system should support at least four Slack-visible message types:
- **acknowledgement:** work has started and who owns it;
- **progress summary:** meaningful milestone or phase change;
- **blocker/escalation:** something needs user or orchestrator attention;
- **completion summary:** finished result and next step.

### 5.2 Identity requirements
Every Slack update should clearly show:
- task title or short task ID;
- reporting role (for example Product Manager, Architect, Implementer);
- whether the update is from the orchestrator or a child agent;
- current state;
- next action or ask.

### 5.3 Visibility rules
Slack should receive updates when:
- a significant task begins;
- a milestone materially changes user understanding;
- a blocker requires attention;
- a review gate is reached if user awareness matters;
- final completion is ready.

Slack should not receive updates for:
- trivial file writes;
- internal polling/checks;
- repetitive "still working" messages;
- raw agent chatter that has not been summarized.

### 5.4 Role-based presentation
Role identity should improve clarity, not create theater. Requirements:
- roles must map to real responsibility in the workflow;
- the orchestrator may summarize multiple child updates into one Slack message;
- if a child role posts directly, it must be clearly framed as a scoped work update, not the final answer;
- final user-facing completion should normally come from the orchestrator unless a workflow explicitly delegates that authority.

### 5.5 Threading and traceability
Slack messages should support:
- thread continuity per parent task or workstream;
- links or references back to tracked task records;
- enough context in each update that a human can tell what changed without opening local files.

## 6. Stopping Point for This Design Round
This design round stops after **PM <-> Architect convergence on the orchestration contract**.

That means we stop once both sides agree on:
- task ownership model;
- parent/child lifecycle semantics;
- status vocabulary needed for coordination;
- notification classes and Slack visibility rules;
- role/identity model for updates;
- handoff contract between child agents and orchestrator.

We do **not** go further in this round into:
- implementation details;
- file schema finalization;
- database migration mechanics;
- Slack transport details;
- retry algorithms;
- scheduling heuristics;
- UI design.

The output of this round should be precise enough for the architect to produce the next technical design, but narrow enough to avoid premature implementation debate.

## 7. Open Questions for the Architect
1. What is the minimal canonical task schema needed to support ownership, hierarchy, review, and Slack visibility without overfitting Phase 2?
2. How should parent and child status roll-up work when siblings are in mixed states such as running, blocked, and review?
3. What mechanism should detect stale child tasks or lost sessions in a file-first system?
4. Which events should be append-only versus which fields should be mutable snapshots?
5. How should review gates be represented so a parent can distinguish "child finished" from "user-ready finished"?
6. How should direct child-to-Slack updates be controlled to prevent noisy or conflicting messages?
7. What is the failure model when a child agent disappears after partial output: retry, reassign, mark blocked, or require orchestrator intervention?
8. What data must be stored locally so Slack threads remain reconstructible even if message delivery fails or edits occur later?
9. How should role identity be encoded so it is consistent across task records, orchestration logic, and Slack presentation?
10. What is the simplest technical path from the current tracker to this orchestration contract without breaking inspectability and manual repair?
