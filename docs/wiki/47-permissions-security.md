
# Permissions & Security

<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

- [src/components/newtab/shared/SharedWorkflowTriggers.vue](src/components/newtab/shared/SharedWorkflowTriggers.vue)
- [src/components/newtab/workflow/edit/EditCookie.vue](src/components/newtab/workflow/edit/EditCookie.vue)
- [src/components/newtab/workflow/edit/Trigger/TriggerContextMenu.vue](src/components/newtab/workflow/edit/Trigger/TriggerContextMenu.vue)
- [src/components/newtab/workflow/edit/Trigger/TriggerCronJob.vue](src/components/newtab/workflow/edit/Trigger/TriggerCronJob.vue)
- [src/composable/blockValidation.js](src/composable/blockValidation.js)
- [src/composable/hasPermissions.js](src/composable/hasPermissions.js)
- [src/content/showExecutedBlock.js](src/content/showExecutedBlock.js)
- [src/lib/cronstrue.js](src/lib/cronstrue.js)
- [src/manifest.chrome.json](src/manifest.chrome.json)
- [src/manifest.firefox.json](src/manifest.firefox.json)
- [src/newtab/index.js](src/newtab/index.js)
- [src/newtab/pages/ScheduledWorkflow.vue](src/newtab/pages/ScheduledWorkflow.vue)
- [src/newtab/pages/Welcome.vue](src/newtab/pages/Welcome.vue)
- [src/newtab/utils/blocksValidation.js](src/newtab/utils/blocksValidation.js)
- [src/utils/helper.js](src/utils/helper.js)
- [src/utils/workflowTrigger.js](src/utils/workflowTrigger.js)

</details>



Automa operates within a multi-layered security model that balances powerful browser automation capabilities with user privacy and security constraints. As a browser extension, it adheres to the security models of Chrome (Manifest V3) and Firefox (Manifest V2), requiring explicit user consent for sensitive operations.

## Security Architecture Overview

The system manages security through three primary mechanisms: static manifest declarations, dynamic runtime permission requests, and validation routines that prevent execution if requirements are not met.

### Permission Flow
The following diagram illustrates how a user's request to run a workflow or configure a block interacts with the permission system.

**Workflow Permission Verification**
```mermaid
graph TD
    subgraph "Natural Language Space"
        "User adds Cookie Block"
        "User clicks Execute"
    end

    subgraph "Code Entity Space"
        "User adds Cookie Block" --> ["EditCookie.vue"]
        ["EditCookie.vue"] -- "Uses" --> ["useHasPermissions.js"]
        ["useHasPermissions.js"] -- "Checks" --> ["browser.permissions.contains"]
        
        "User clicks Execute" --> ["blocksValidation.js"]
        ["blocksValidation.js"] -- "validateTrigger" --> ["checkPermissions"]
        ["checkPermissions"] -- "Throws Error if missing" --> ["WorkflowEngine"]
    end
```
Sources: [src/composable/hasPermissions.js:6-57](), [src/newtab/utils/blocksValidation.js:3-71](), [src/components/newtab/workflow/edit/EditCookie.vue:166-167]()

---

## Permission Management

Automa uses a mix of required and optional permissions. Required permissions are granted at installation, while optional permissions are requested only when a specific block type (e.g., Cookies, Downloads) is used.

### The `hasPermissions` Composable
The `useHasPermissions` composable is the primary interface for UI components to check and request browser permissions. It uses `shallowReactive` to provide a reactive state of currently granted permissions.

- **Check**: Uses `browser.permissions.contains` to verify if a permission is active [src/composable/hasPermissions.js:45-51]().
- **Request**: Triggers `browser.permissions.request`. In some cases, it forces an extension reload (especially in MV2) to ensure the background script registers the new capability [src/composable/hasPermissions.js:12-41]().

### Blocks Validation
Before a workflow starts or a block is saved, the `blocksValidation.js` utility performs static analysis on the workflow data. It checks for:
1.  **Missing Permissions**: Ensures blocks like `export-data` have the `downloads` permission [src/newtab/utils/blocksValidation.js:133-137]().
2.  **Schema Integrity**: Validates that required fields (URLs, Selectors, Cron expressions) are not empty [src/newtab/utils/blocksValidation.js:11-58]().

| Block/Feature | Required Permission | Source |
| :--- | :--- | :--- |
| **Context Menu Trigger** | `contextMenus` (Chrome) / `menus` (Firefox) | [src/newtab/utils/blocksValidation.js:25-27]() |
| **Cookie Block** | `cookies` | [src/components/newtab/workflow/edit/EditCookie.vue:166]() |
| **Export Data** | `downloads` | [src/newtab/utils/blocksValidation.js:133]() |
| **Clipboard** | `clipboardRead` | [src/newtab/utils/blocksValidation.js:210-212]() |

---

## Extension Manifests

Automa maintains two distinct manifests to support the architectural differences between modern Chromium-based browsers and Firefox.

### Chrome (Manifest V3)
Uses `service_worker` for background logic and strictly defines `host_permissions` for `<all_urls>` to allow automation across different domains.
- **Key Permissions**: `debugger` (for CSP bypass), `scripting`, `offscreen` [src/manifest.chrome.json:59-70]().
- **Optional**: `cookies`, `downloads`, `notifications` [src/manifest.chrome.json:52-58]().

### Firefox (Manifest V2)
Uses a persistent background script and different API namespaces (e.g., `browser.menus` instead of `browser.contextMenus`).
- **Key Permissions**: `menus`, `webNavigation`, `<all_urls>` [src/manifest.firefox.json:51-60]().
- **CSP**: Explicitly defines `content_security_policy` to allow inline scripts within the extension's own pages [src/manifest.firefox.json:68]().

Sources: [src/manifest.chrome.json:1-89](), [src/manifest.firefox.json:1-69]()

---

## Child Pages

For deep dives into specific security implementations, see the following:

### [Extension Permissions Model](#13.1)
Details the granular mapping of workflow blocks to browser permissions. Explains how `getWorkflowPermissions` aggregates all required permissions for a specific `.automa` file before execution and how the `SharedPermissionsModal` guides the user through granting them.

### [CSP Bypass & Debugger API](#13.2)
Explains the technical implementation of the `chrome.debugger` bridge. This system is used to bypass restrictive Content Security Policies (CSP) that would otherwise prevent Automa from injecting scripts into sensitive websites. It also covers the "offscreen document" pattern required for MV3 compatibility.

---

