# Architecture Design - Phase 1: File-First Orchestration

## 1. System Goals

The primary goals for Phase 1 of this multi-agent task orchestration system are:

*   **Responsiveness:** The main assistant (parent agent) must remain responsive to user input, even when long-running tasks are in progress.
*   **Parallel Execution:** Enable the execution of long-running tasks in parallel child agents to optimize overall task completion time.
*   **File-Based Tracking:** Establish a robust, file-based mechanism for tracking task status, agent state, and communication, serving as a practical interim solution before more advanced database systems are integrated.
*   **Decoupled Components:** Design components that are loosely coupled to facilitate future migrations and enhancements.
*   **Non-blocking Chat:** Ensure that user interaction with the main assistant is never blocked by ongoing background tasks.

## 2. Components

The system will consist of the following core components:

*   **Main Assistant (Parent Agent):** The primary interface for user interaction. It receives requests, delegates complex or long-running tasks to child agents, monitors their progress, and relays updates to the user.
*   **Child Agents:** Specialized agents responsible for executing specific tasks. They operate independently, communicate their status and results via the file system, and are designed for single-task focus.
*   **Task Queue (File-Based):** A directory where the Main Assistant places task definitions for Child Agents to pick up. Each task will be a file containing its parameters and an identifier.
*   **Status/Results Store (File-Based):** A designated directory where Child Agents write their progress updates, intermediate results, and final outcomes. This allows the Main Assistant to monitor and retrieve information asynchronously.
*   **Communication Protocol (File-Based):** Standardized file formats (e.g., JSON, YAML, plain text) for tasks, status updates, and results to ensure interoperability between agents.

## 3. File-Based Runtime Model

The core of Phase 1 relies heavily on the file system for inter-agent communication and state management.

*   **Task Ingestion:**
    *   The Main Assistant, upon receiving a request for a long-running task, will create a unique task ID.
    *   A task file (e.g., `orchestration/tasks/<task_id>.json`) will be created in the `tasks` directory. This file will contain the task definition (agent type, parameters, etc.).
*   **Task Discovery and Execution:**
    *   Child Agents will periodically poll the `tasks` directory for new task files.
    *   Upon discovering a new task, a Child Agent will read the task file, "claim" it (e.g., by renaming it to `orchestration/tasks/<task_id>.processing` or creating a lock file), and begin execution.
*   **Status Reporting:**
    *   Child Agents will write status updates and intermediate results to dedicated status files (e.g., `orchestration/status/<task_id>.status.json`) in the `status` directory. These updates will include progress, current stage, and any relevant output.
*   **Result Delivery:**
    *   Upon completion, a Child Agent will write the final results to a results file (e.g., `orchestration/results/<task_id>.result.json`) and update the status file to "completed" or "failed". The task file can then be archived or deleted.
*   **Main Assistant Monitoring:**
    *   The Main Assistant will periodically poll the `status` directory, reading the `*.status.json` files to provide updates to the user without blocking.
    *   Once a task is marked as "completed", the Main Assistant retrieves the final result file.

## 4. How Parallel Agents are Spawned and Tracked

*   **Spawning:** The Main Assistant will use `sessions_spawn` (or a similar mechanism if `exec` with `background=true` is used for simpler cases) to launch child agents as separate, independent processes. Each spawned agent will be configured to monitor the shared `tasks` directory.
*   **Identification:** Each task and child agent will be associated with a unique identifier (UUID or similar). This ID will be used in filenames (`<task_id>.json`, `<task_id>.status.json`) to link tasks, status, and results.
*   **Tracking:** The Main Assistant maintains an internal mapping of `task_id` to `session_id` (if spawned via `sessions_spawn`) to track the running process. File-based status updates (as described in the runtime model) provide the actual task progress and completion status.
*   **Resilience:** The file-based approach inherently provides some resilience. If an agent crashes, the task file might remain unclaimed or a partially updated status file would indicate an issue, allowing for potential re-assignment or error handling.

## 5. How Non-blocking Chat is Preserved

The key to preserving non-blocking chat lies in the asynchronous nature of task execution and status monitoring:

*   **Delegation:** The Main Assistant immediately delegates long-running tasks to child agents. It does not wait for the child agent to complete the task before returning control to the user.
*   **Asynchronous Monitoring:** Instead of actively waiting, the Main Assistant periodically checks the file-based status store. This polling is a lightweight operation that does not block the main chat thread.
*   **Event-Driven Updates (Conceptual):** While strictly file-based, the Main Assistant can simulate an event-driven model by checking for new or modified status files. When a significant status change is detected (e.g., task started, progress update, completion), the Main Assistant can then formulate a message to the user.
*   **User Prompts:** The Main Assistant can inform the user that a task has been delegated and will provide updates as they become available, managing user expectations.

## 6. Recommended Migration Path

This file-first approach is designed to be a pragmatic starting point, with a clear path for future enhancements.

### Phase 1: Files (Current)
*   **Pros:** Simple to implement, highly transparent (easy to inspect state via file system), resilient to agent crashes (state persists).
*   **Cons:** Can be slow for large numbers of tasks/updates, requires careful file locking/naming conventions to avoid race conditions, lacks advanced query capabilities.

### Phase 2: SQLite Integration
*   **Description:** Introduce a local SQLite database to manage task metadata, agent states, and structured results. File system will still be used for large binary outputs or complex logs.
*   **Migration Steps:**
    1.  **Introduce Database Schema:** Define tables for `tasks` (task_id, status, agent_id, parameters_path, results_path, start_time, end_time), `agents` (agent_id, type, status, last_heartbeat).
    2.  **Abstract Storage Layer:** Create an abstraction layer (e.g., `TaskStore` interface) that initially interacts with the file system.
    3.  **Implement SQLite `TaskStore`:** Develop a new implementation of `TaskStore` that reads from and writes to the SQLite database.
    4.  **Refactor Agents:** Modify Main and Child Agents to use the `TaskStore` abstraction. Initially, they might still write raw task inputs/outputs to files, with the database storing paths.
    5.  **Data Migration Script:** Create a script to migrate existing file-based task data into the SQLite database.
    6.  **Benefits:** Improved query performance, atomicity of updates, easier data management, reduced file system contention.

### Phase 3: External Message Queue / Slack Integration (Deferred)
*   **Description:** Integrate with an external message queue (e.g., Redis Pub/Sub, RabbitMQ, Kafka) for real-time inter-agent communication and a Slack (or similar chat platform) integration for direct user notifications and command invocation.
*   **Migration Steps:**
    1.  **Message Queue Integration:** Introduce a messaging library. Agents publish status updates to topics, and the Main Assistant subscribes to relevant topics.
    2.  **Slack Bot Development:** Develop a Slack bot that listens for commands, translates them into tasks for the Main Assistant, and receives status updates from the Main Assistant for user notification.
    3.  **API Layer:** Consider introducing a lightweight API layer for external systems (like Slack) to interact with the orchestration system.
    4.  **Refactor Communication:** Gradually replace file-based polling for status updates with message queue subscriptions.
    5.  **Benefits:** Real-time communication, scalability, advanced notification features, rich user experience through chat platforms.

This phased approach allows for incremental development, starting with a practical and understandable file-based system, and gradually migrating to more robust and scalable solutions as requirements evolve.