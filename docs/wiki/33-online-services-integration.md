
# Online Services Integration

<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

- [src/components/newtab/workflow/WorkflowShareTeam.vue](src/components/newtab/workflow/WorkflowShareTeam.vue)
- [src/components/newtab/workflow/edit/EditGoogleSheets.vue](src/components/newtab/workflow/edit/EditGoogleSheets.vue)
- [src/components/newtab/workflow/edit/EditGoogleSheetsDrive.vue](src/components/newtab/workflow/edit/EditGoogleSheetsDrive.vue)
- [src/components/newtab/workflows/WorkflowsUserTeam.vue](src/components/newtab/workflows/WorkflowsUserTeam.vue)
- [src/content/services/webService.js](src/content/services/webService.js)
- [src/stores/teamWorkflow.js](src/stores/teamWorkflow.js)
- [src/stores/user.js](src/stores/user.js)
- [src/utils/api.js](src/utils/api.js)
- [src/utils/googleSheetsApi.js](src/utils/googleSheetsApi.js)
- [src/utils/openGDriveFilePicker.js](src/utils/openGDriveFilePicker.js)
- [src/workflowEngine/blocksHandler/handlerGoogleSheets.js](src/workflowEngine/blocksHandler/handlerGoogleSheets.js)

</details>



Automa provides robust integrations with external cloud services to facilitate data storage, external triggering, and collaborative automation. These integrations bridge the gap between local browser automation and the broader web ecosystem, allowing workflows to interact with Google Workspace, external APIs via webhooks, and Automa's own cloud infrastructure for team-based features.

### Integration Architecture Overview

The integration layer is divided into three primary categories:
1.  **Cloud Storage (Google Sheets/Drive):** Direct interaction with the Google Sheets API for data persistence.
2.  **External Communication (Webhooks):** HTTP-based communication for sending and receiving data from external services.
3.  **Automa Cloud Services:** Synchronization of workflows, shared packages, and team-based management through the Automa API.

The following diagram illustrates the relationship between the Workflow Engine, the UI components, and the external service handlers.

**External Service Integration Flow**
```mermaid
graph LR
    subgraph "Natural Language Space"
        ["User Configuration"]
        ["Cloud Data"]
        ["External API"]
    end

    subgraph "Code Entity Space"
        direction TB
        ["EditGoogleSheets.vue"] -- "configures" --> ["handlerGoogleSheets.js"]
        ["EditWebhook.vue"] -- "configures" --> ["handlerWebhook.js"]
        
        ["handlerGoogleSheets.js"] -- "uses" --> ["googleSheetsApi.js"]
        ["googleSheetsApi.js"] -- "calls" --> ["fetchGapi (api.js)"]
        
        ["handlerWebhook.js"] -- "uses" --> ["webhookUtil.js"]
        
        ["api.js"] -- "manages" --> ["OAuth Tokens"]
    end

    ["User Configuration"] -.-> ["EditGoogleSheets.vue"]
    ["User Configuration"] -.-> ["EditWebhook.vue"]
    ["googleSheetsApi.js"] -.-> ["Cloud Data"]
    ["webhookUtil.js"] -.-> ["External API"]
```
Sources: [src/workflowEngine/blocksHandler/handlerGoogleSheets.js:1-7](), [src/utils/googleSheetsApi.js:1-15](), [src/utils/api.js:199-205]()

---

### Google Sheets & Google Drive
Automa allows workflows to read from and write to Google Sheets. This is managed via the `google-sheets` block, which supports two modes of operation: **Native** (direct browser-to-Google API calls using OAuth) and **Proxy** (routing through Automa's service).

*   **UI Configuration:** Managed by `EditGoogleSheets.vue` [src/components/newtab/workflow/edit/EditGoogleSheets.vue:1-17]() and `EditGoogleSheetsDrive.vue` [src/components/newtab/workflow/edit/EditGoogleSheetsDrive.vue:13-19]().
*   **Execution Logic:** Handled by `handlerGoogleSheets.js`, which processes actions like `get`, `update`, `append`, and `clear` [src/workflowEngine/blocksHandler/handlerGoogleSheets.js:143-185]().
*   **File Selection:** Users can select files via the Google Drive picker, implemented in `openGDriveFilePicker.js` [src/utils/openGDriveFilePicker.js:43-64]().

For details, see [Google Sheets & Google Drive](#8.1).

### Webhooks & HTTP Requests
The Webhook integration enables Automa to communicate with any external HTTP endpoint. This is essential for triggering external actions (e.g., sending a Slack notification) or receiving data to be processed within a workflow.

*   **Configuration:** The `EditWebhook.vue` component provides a full interface for setting HTTP methods, headers, and request bodies.
*   **Handling:** `handlerWebhook.js` manages the execution of the request, including variable replacement within the URL and body.
*   **Utility:** `webhookUtil.js` provides shared logic for formatting requests and handling various response types (JSON, Text, etc.).

For details, see [Webhooks & HTTP Requests](#8.2).

### Automa Cloud API & Team Features
Automa's cloud features allow users to sync workflows across devices, share them with the community, or work within a team environment. This is powered by a central API and managed through specialized Pinia stores.

*   **Authentication:** The system manages sessions and OAuth tokens via `api.js`, including automatic token refreshing [src/utils/api.js:20-34]().
*   **Team Workflows:** Managed by `useTeamWorkflowStore`, which handles the local persistence and synchronization of workflows shared within a team [src/stores/teamWorkflow.js:6-13]().
*   **UI Components:** `WorkflowShareTeam.vue` handles the interface for publishing local workflows to a team [src/components/newtab/workflow/WorkflowShareTeam.vue:176-200]().

**Cloud Interaction Architecture**
```mermaid
graph TD
    subgraph "Browser Extension"
        [useUserStore.js]
        [useTeamWorkflowStore.js]
        [fetchApi (api.js)]
        [webService.js]
    end

    subgraph "Automa Cloud API"
        [Auth Service]
        [Workflow Sync]
        [Team Management]
    end

    [useUserStore.js] -- "Auth & Profile" --> [fetchApi (api.js)]
    [useTeamWorkflowStore.js] -- "Sync Workflows" --> [fetchApi (api.js)]
    [fetchApi (api.js)] -- "HTTPS" --> [Automa Cloud API]
    [webService.js] -- "Listen for Web Events" --> [Browser Extension]
```
Sources: [src/utils/api.js:5-42](), [src/stores/user.js:27-45](), [src/content/services/webService.js:33-60]()

For details, see [Automa Cloud API & Team Features](#8.3).

---
**Sources:**
*   [src/components/newtab/workflow/edit/EditGoogleSheets.vue:1-122]()
*   [src/workflowEngine/blocksHandler/handlerGoogleSheets.js:1-192]()
*   [src/utils/api.js:1-197]()
*   [src/utils/googleSheetsApi.js:1-131]()
*   [src/stores/teamWorkflow.js:1-75]()
*   [src/content/services/webService.js:1-213]()

---

