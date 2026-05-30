# Hybrid AI + Manual Automation — Work Plan & Roadmap

> Status: living document. Scope: evolving Automa into a **hybrid automation
> platform** where deterministic ("manual") node-based workflows and AI-driven
> ("intelligent") steps compose seamlessly in one graph.
>
> This plan is grounded in the code merged by PR #1 (client-side AI nodes), PR #2
> (server-side AI Power block) and PR #4 (finalization: lint + icon fixes).

---

## 1. Vision

Combine **precision** (deterministic blocks: selectors, conditions, loops,
HTTP, tables) with **intelligence** (LLM generation, page understanding,
bounded autonomous actions) so a single workflow can:

- Use AI to *decide* and *generate*, and manual blocks to *execute* reliably.
- Fall back to deterministic paths when AI is unavailable or low-confidence.
- Keep humans in control via budgets, allowlists and opt-in gating.

## 2. Current state (after PR #1, #2, #4)

There are **two AI subsystems** today:

| Subsystem | Where | Backend | Blocks |
|---|---|---|---|
| **Client-side AI nodes** (PR #1) | `business/dev/blocks/**` | Direct LLM HTTP (OpenRouter / OpenAI / Gemini) | `ai-content-form-generation`, `autonomous-ai` |
| **Server-side AI Power** (PR #2) | `src/.../EditAiWorkflow.vue`, `src/workflowEngine/blocksHandler/handlerAiWorkflow.js`, `src/utils/getAIPoweredInfo.js` | Hosted Automa AI Power API | `ai-workflow` |

What already works:

- Both AI nodes register through `getBlocks()` (`src/utils/getSharedData.js`) and
  appear in the block list under the `general` category.
- They chain with manual blocks via `nextBlockId`, write to **variables**
  (`setVariable`) and **table columns** (`addDataToColumn`), and emit workflow
  logs (`engine.addLogHistory`).
- `autonomous-ai` bridges AI decisions to DOM via content handlers
  (`ai-page-snapshot`, `ai-agent-action`) using a constrained action registry
  (`navigate|click|type|extract|wait|finish`) with step/failure budgets.
- Provider abstraction with timeout, retry/backoff and categorized errors lives
  in `business/dev/blocks/backgroundHandler/ai/providerClient.js`.

Known limitations to address (drive the phases below):

1. **Credentials are stored in plaintext** in `workflow.settings.aiProviderCredentials`
   even though Automa already ships an **encrypted credential vault**
   (`src/utils/credentialUtil.js`, `src/db/storage.js`, `{{secrets.*}}` in
   `src/workflowEngine/templating/mustacheReplacer.js`).
2. **No localization / docs** for the new blocks — names fall back to defaults and
   the in-editor docs link (`docs.extension.automa.site/blocks/<id>.html`) 404s.
3. **No automated tests** for any AI block (provider client, action registry,
   handlers, message-state pruning).
4. **Two parallel UX/credential models** (client providers vs. AI Power) with no
   shared model picker, error surface, or cost/telemetry view.
5. **Client nodes are text-only**; PR #2 added multimodal to AI Power but the
   client provider layer does not yet send image parts.
6. **Autonomous agent guardrails are minimal** (no domain allowlist, no
   destructive-action confirmation, no cost ceiling, no dry-run).
7. **Selector generation in `ai-page-snapshot` is heuristic** and does not reuse
   Automa's existing selector library.

---

## 3. Guiding principles

- **Hybrid-first**: every AI node must be a well-behaved Automa block —
  templating in, `nextBlockId`/variable/table out, logs, `onError`/fallback.
- **Safe by default**: opt-in `experimentalEnabled`, bounded budgets, allowlists.
- **Reuse, don't reinvent**: use the existing credential vault, selector lib,
  templating, logging and storage rather than parallel mechanisms.
- **Observable & costed**: every model call records tokens/cost and is traceable.
- **Test before graduate**: a node leaves "experimental" only with tests + docs.

---

## 4. Phased plan

Each task lists concrete **touchpoints** and **acceptance criteria (AC)**.

### Phase 0 — Hardening & hygiene (done / immediate)

- [x] Lint-clean all AI block files; fix invalid `riRobot2Line` icon → `riRobotLine`
      registered in `src/lib/vRemixicon.js` (PR #4).
- [ ] **Add a CI workflow** (`.github/workflows/ci.yml`) running `pnpm lint` and
      `node utils/build.js` on PRs. *AC:* PRs show lint+build checks; both green
      on `main`. *(Also fixes the pre-existing `src/lib/dayjs.js` lint error.)*
- [ ] **Smoke test the build artifact**: load `build/` as an unpacked extension,
      confirm both AI nodes appear with icons and edit panels open. *AC:* manual
      checklist documented here; later automated (Phase 3).

### Phase 1 — Security & credentials (P0)

- [ ] **Migrate AI provider keys to the encrypted vault.** Replace plaintext
      `settings.aiProviderCredentials` with references to Automa credentials,
      resolved via `{{secrets.<name>}}` / `credentialUtil.decrypt`.
      - Touchpoints: `business/.../ai/providerClient.js` (`getToken`),
        `business/.../editComponents/EditAiContentFormGeneration.vue`,
        `EditAutonomousAi.vue`, credential UI in `src/newtab/pages/Storage.vue`.
      - *AC:* keys never persisted in cleartext; existing workflows migrate with a
        one-time shim; provider call still authenticates.
- [ ] **Redaction audit**: confirm `maskSecrets` covers logs *and* error payloads
      returned to `data.error`. *AC:* no key material in `addLogHistory` output.

### Phase 2 — Unify the hybrid UX (P1)

- [ ] **Shared "AI provider" config component** used by all AI nodes (provider,
      model, credential ref, temperature, timeout, retries). *AC:* one source of
      truth; adding a provider updates all nodes.
- [ ] **Localization + docs**: add locale keys under `src/locales/*/blocks.json`
      for `ai-content-form-generation`, `autonomous-ai`; author docs pages so the
      editor info link resolves. *AC:* names localized; docs link 200s.
- [ ] **Consistent error/log surface** across client nodes and AI Power
      (same categories, same `ctxData` shape). *AC:* logs render uniformly in the
      log viewer.

### Phase 3 — Reliability, tests & observability (P1)

- [ ] **Unit tests** (the repo has no test runner yet — add `vitest`):
      - `providerClient`: request shaping per provider, retry/backoff, error
        categorization, timeout/abort, secret masking (mock `fetch`).
      - `actionRegistry`: validation rules, unsupported actions, `finish`.
      - `messageState`: history pruning keeps system prompt + most recent turns.
      - handlers: feature-flag gate, schema mode + strict-key validation,
        `stopOnError` vs. non-fatal error payloads.
      - *AC:* `pnpm test` runs in CI; >80% coverage on `business/dev/blocks/**`.
- [ ] **Token & cost accounting**: thread `usage` into logs and a per-run summary.
      *AC:* each AI step log shows tokens; run summary shows total.
- [ ] **Extension E2E smoke** via Playwright over CDP (load extension, drop AI
      node, open editor, assert icon + fields). *AC:* runs headless in CI.

### Phase 4 — Capability expansion (P2)

- [ ] **Multimodal for client nodes**: send image parts (OpenAI/OpenRouter
      `image_url`, Gemini `inlineData`) so screenshots / prior-block media feed
      the model. Reuse PR #2's `{url, filename}` URL-mode contract for parity.
      - Touchpoints: `providerClient.js` (content builders),
        `handlerAiContentFormGeneration.js`, edit component inputs.
- [ ] **Autonomous-agent guardrails**: domain allowlist, max-cost ceiling,
      confirmation/dry-run for destructive actions, reuse `@/lib/findSelector`
      for stable selectors in `ai-page-snapshot`.
- [ ] **Provider expansion** behind capability flags: Anthropic direct, Azure
      OpenAI, local (Ollama). *AC:* `PROVIDER_CAPABILITIES` drives UI + payloads.
- [ ] **Optional streaming** for client nodes and richer JSON-schema validation
      (e.g. `ajv`) beyond required-key checks.

---

## 5. Cross-cutting acceptance criteria ("definition of done" for graduation)

A node may drop the `experimentalEnabled` gate only when **all** hold:

1. Credentials resolved from the encrypted vault (no plaintext).
2. Unit tests + one E2E smoke pass in CI.
3. Localized name/description and a published docs page.
4. Errors are categorized, masked, non-fatal by default, and log token/cost.
5. Guardrails documented (budgets, allowlist, fallbacks).

## 6. Risks & mitigations

- **API cost/abuse** → per-run cost ceiling + rate limiting + allowlists.
- **Prompt injection via page content** → constrained action registry (already),
  domain allowlist, never execute model-provided code, confirmation for
  navigation off-allowlist.
- **Secret leakage** → vault storage + `maskSecrets` on every outbound log.
- **Selector brittleness** → reuse `findSelector`/element-selector lib.
- **Two-subsystem drift** → shared provider/UX components (Phase 2).

## 7. Suggested sequencing

```
Phase 0 (CI + smoke)  ──▶ Phase 1 (credentials)  ──▶ Phase 2 (unify UX)
                                   │
                                   └──▶ Phase 3 (tests/observability) ──▶ Phase 4 (capabilities)
```

Phase 0 and Phase 1 are the highest leverage: they make the system safe to enable
and protected from regressions before expanding capability.
