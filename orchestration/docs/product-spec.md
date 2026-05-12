# Product Specification: File-First Multi-Agent Orchestration (Phase 1 MVP)

## 1. Problem Statement
The current assistant model struggles with long-running, complex tasks that require parallel execution or continuous user interaction. When a task is initiated, the assistant is blocked until the task completes, preventing further user engagement or the initiation of other concurrent work. This leads to a suboptimal user experience, limited throughput for complex projects, and a lack of transparency into ongoing background operations. There's a need for a system that allows the assistant to delegate work to child agents, monitor their progress asynchronously, and maintain responsiveness to the user.

## 2. User Stories
*   **As an Assistant**, I want to launch long-running tasks to child agents so that I can continue to interact with the user without being blocked.
*   **As an Assistant**, I want to monitor the status and output of child agents so that I can provide updates to the user.
*   **As a User**, I want to initiate a complex task and receive immediate confirmation that it's being handled in the background, allowing me to continue chatting with the assistant.
*   **As a User**, I want to inquire about the progress of my background tasks at any time.
*   **As a User**, I want to receive notifications or summaries when a background task completes or requires my attention.

## 3. Task Lifecycle and Statuses
In Phase 1, task tracking will be file-based. Each task will have a directory within `orchestration/tasks/` containing its state and output.

*   **QUEUED**: Task is awaiting execution.
*   **RUNNING**: Task is actively being processed by a child agent.
*   **PAUSED**: Task execution is temporarily suspended (e.g., awaiting user input, external resource).
*   **COMPLETED**: Task finished successfully.
*   **FAILED**: Task terminated with an error.
*   **CANCELLED**: Task was explicitly stopped by the user or assistant.

Status updates will be written to a `status.json` file within the task's directory.

## 4. MVP Scope
The MVP will focus on the core functionality for file-first orchestration:

*   **Task Creation**: Assistant can define a new task, which creates a new directory under `orchestration/tasks/<task_id>/`.
*   **Child Agent Launch**: Assistant can launch a child agent (via `sessions_spawn`) associated with a specific task directory.
*   **File-Based State Management**: Task status, output, and intermediate results are stored as files within the task's directory.
*   **Asynchronous Monitoring**: The main assistant can poll task directories for status updates without blocking.
*   **User Interaction**: Users can query the status of their active tasks.
*   **Basic Completion/Failure Reporting**: The main assistant can report task completion or failure to the user.

## 5. Non-Goals (Phase 1)
*   **Slack Integration**: Integration with Slack or other external messaging platforms for notifications.
*   **Complex Workflow Orchestration**: Advanced conditional logic, branching, or sophisticated dependency management between tasks.
*   **Persistence Layer beyond Files**: Database or other structured storage for task metadata.
*   **Built-in Retry Mechanisms**: Automatic retries for failed tasks.
*   **Advanced Resource Management**: Dynamic allocation or load balancing of child agents.
*   **User Interface (UI)**: A dedicated graphical user interface for task management.

## 6. Acceptance Criteria
*   The assistant can successfully launch a child agent for a long-running task and immediately return to an interactive state with the user.
*   The status of a running task (QUEUED, RUNNING, COMPLETED, FAILED, etc.) is accurately reflected in its `status.json` file.
*   The user can ask "What are my active tasks?" and receive a list of tasks with their current statuses.
*   The user can ask "What is the status of [task_name]?" and receive its detailed status.
*   Upon task completion (success or failure), the main assistant can summarize the outcome to the user.
*   Child agents can write output and intermediate results to their designated task directory.
*   The system operates entirely within the `/data/.openclaw/workspace/orchestration/` directory structure.

## 7. Risks and Open Questions
*   **Race Conditions**: How will we ensure atomicity and prevent race conditions when multiple agents or the main assistant are writing to task files concurrently?
*   **File System Performance**: Will file-based tracking introduce performance bottlenecks for a large number of concurrent tasks or frequent status updates?
*   **Error Handling and Recovery**: How will the system gracefully handle unexpected agent termination or file corruption?
*   **Scalability**: How will the file-based approach scale as the number of tasks and agents grows?
*   **Security**: What are the security implications of file-based communication between agents, especially regarding data access and modification?
*   **Notification Mechanism**: What is the minimal viable notification mechanism for the user about task progress without Slack (e.g., simple message from main agent)?
*   **Task Definition Standard**: What format will be used to define tasks for child agents (e.g., a simple shell command, a script path)?
