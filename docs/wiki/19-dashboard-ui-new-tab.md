
# Dashboard UI (New Tab)

<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

- [.gitignore](.gitignore)
- [src/components/newtab/app/AppSidebar.vue](src/components/newtab/app/AppSidebar.vue)
- [src/components/newtab/shared/SharedCard.vue](src/components/newtab/shared/SharedCard.vue)
- [src/components/newtab/workflows/WorkflowsHosted.vue](src/components/newtab/workflows/WorkflowsHosted.vue)
- [src/components/newtab/workflows/WorkflowsShared.vue](src/components/newtab/workflows/WorkflowsShared.vue)
- [src/components/popup/home/HomeTeamWorkflows.vue](src/components/popup/home/HomeTeamWorkflows.vue)
- [src/composable/shortcut.js](src/composable/shortcut.js)
- [src/locales/en/common.json](src/locales/en/common.json)
- [src/manifest.chrome.dev.json](src/manifest.chrome.dev.json)
- [src/newtab/pages/Settings.vue](src/newtab/pages/Settings.vue)
- [src/newtab/pages/Workflows.vue](src/newtab/pages/Workflows.vue)
- [src/newtab/pages/settings/SettingsProfile.vue](src/newtab/pages/settings/SettingsProfile.vue)
- [src/newtab/router.js](src/newtab/router.js)

</details>



The Automa Dashboard is a Single Page Application (SPA) that serves as the primary interface for managing and building automations. It is loaded when the user opens the extension's "New Tab" page or via the `open-dashboard` command [src/manifest.chrome.dev.json:17-23](). The UI is built with Vue 3 and utilizes a tab-based navigation system allowing users to keep multiple workflows or settings open simultaneously.

## Navigation & Routing

The dashboard structure is defined by a persistent sidebar and a dynamic main content area. Routing is managed by `vue-router` using hash-based history [src/newtab/router.js:1-118]().

### Sidebar (AppSidebar)
The `AppSidebar.vue` component provides high-level navigation to major functional modules. It also includes an indicator for the number of currently running workflows [src/components/newtab/app/AppSidebar.vue:43-47]().

| Tab ID | Icon | Path | Purpose |
| --- | --- | --- | --- |
| `workflow` | `riFlowChart` | `/workflows` | Main workflow management [src/components/newtab/app/AppSidebar.vue:123-128]() |
| `packages` | `mdiPackageVariantClosed` | `/packages` | Block package management [src/components/newtab/app/AppSidebar.vue:130-134]() |
| `schedule` | `riTimeLine` | `/schedule` | Trigger and execution scheduling [src/components/newtab/app/AppSidebar.vue:136-140]() |
| `storage` | `riHardDrive2Line` | `/storage` | Tables, Variables, and Credentials [src/components/newtab/app/AppSidebar.vue:142-146]() |
| `log` | `riHistoryLine` | `/logs` | Execution history and live logs [src/components/newtab/app/AppSidebar.vue:148-152]() |
| `settings` | `riSettings3Line` | `/settings` | General and profile settings [src/components/newtab/app/AppSidebar.vue:154-158]() |

### Tab Management
The `Workflows.vue` container manages a custom tab system within the dashboard, independent of browser tabs. This allows users to switch between different workflow editors or dashboard views without losing state. Tabs are persisted in `localStorage` [src/newtab/pages/Workflows.vue:155-161]().

**Dashboard Routing Overview**
```mermaid
graph TD
  subgraph "Dashboard Shell (App.vue)"
    Sidebar["AppSidebar.vue"]
    Content["router-view"]
  end

  Sidebar -->|Navigate| Content
  
  subgraph "Major Routes (router.js)"
    Workflows["/workflows (WorkflowContainer)"]
    Storage["/storage (Storage.vue)"]
    Logs["/logs/:id (LogsDetails.vue)"]
    Settings["/settings (Settings.vue)"]
  end

  Workflows --> Editor["/:id (WorkflowDetails.vue)"]
  Workflows --> List["/ (Workflows index)"]
  
  Settings --> Profile["/profile"]
  Settings --> Backup["/backup"]
  
  Sources: ["src/newtab/router.js:22-112", "src/components/newtab/app/AppSidebar.vue:122-159"]
```

## Major Dashboard Sections

### Workflow Management
The primary view for interacting with workflows. It categorizes automations into Local, Hosted (Automa Cloud), and Shared. It uses `SharedCard.vue` to display workflow metadata and provides quick actions like "Execute" or "Delete" [src/components/newtab/shared/SharedCard.vue:1-70]().
*   For details, see [Workflow List & Management](#5.1).

### Workflow Editor
A node-based visual programming environment. When a user clicks a workflow, the dashboard routes to `WorkflowDetails.vue`, which initializes the editor canvas [src/newtab/router.js:59-62]().
*   For details, see [Workflow Editor](#5.2) and [Block Configuration Panels (Edit Components)](#5.3).

### Logs & History
Displays the execution history stored in the `dbLogs` IndexedDB. It includes a `LogsHistory` view for high-level results and a `LogsDataViewer` for inspecting the data produced by specific runs [src/newtab/router.js:96-99]().
*   For details, see [Logs & Execution History](#5.5).

### Storage & Data
Manages persistent data used by workflows. This includes `StorageTables` (internal spreadsheets), `StorageVariables` (global key-value pairs), and `StorageCredentials` (encrypted secrets) [src/newtab/router.js:86-94]().
*   For details, see [Storage, Tables & Credentials](#5.6).

### Settings & Profile
Handles extension-wide configuration. This includes general behavior, backup/restore functionality using AES encryption, and user authentication via `useUserStore` [src/newtab/pages/Settings.vue:50-57]().
*   For details, see [Settings & User Profile](#5.7).

## Keyboard Shortcuts
The dashboard supports global shortcuts via the `useShortcut` composable, mapping keys to specific routes or actions [src/composable/shortcut.js:6-59]().

**Code Entity to Shortcut Mapping**
```mermaid
graph LR
  subgraph "Shortcut Registry (shortcut.js)"
    W["page:workflows (Alt+W)"]
    L["page:logs (Alt+L)"]
    S["page:settings (Alt+S)"]
    A["page:storage (Alt+A)"]
  end

  subgraph "Dashboard Components"
    AppSidebar["AppSidebar.vue"]
    Settings["SettingsShortcuts.vue"]
  end

  W -->|Triggers| AppSidebar
  L -->|Triggers| AppSidebar
  S -->|Triggers| AppSidebar
  
  AppSidebar -->|useShortcut| Mousetrap["Mousetrap.bind()"]
  Settings -->|Edit| CustomShortcuts["localStorage: 'shortcuts'"]

  Sources: ["src/composable/shortcut.js:6-59", "src/components/newtab/app/AppSidebar.vue:164-182"]
```

Sources:
- [src/newtab/pages/Workflows.vue:1-202]()
- [src/components/newtab/app/AppSidebar.vue:1-210]()
- [src/newtab/router.js:1-118]()
- [src/composable/shortcut.js:6-145]()
- [src/newtab/pages/Settings.vue:1-62]()

---

