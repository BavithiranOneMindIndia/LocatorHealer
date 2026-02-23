# WhatsApp Self-Healing Playwright Framework

A modular TypeScript framework for WhatsApp Web automation with:

- QR/OTP/manual authentication capture and reuse (`storageState`)
- Playwright workflow recording
- Locator registry + metadata persistence
- Smart runner with self-heal engine
- Manual approval before registry update

## Architecture

```text
Frontend UI
  ↓
Backend API (Express)
  ↓
Smart Runner (Playwright wrapper)
  ↓
Healing Engine (metadata similarity)
  ↓
Locator Registry / Proposed changes
  ↓
Auth Storage State
```

## Folder Structure

```text
backend/
  server.ts
  routes/
    configRoutes.ts
    recordRoutes.ts
    runRoutes.ts
    healRoutes.ts
    approvalRoutes.ts
    authRoutes.ts
  core/
    smartRunner.ts
    healingEngine.ts
    locatorRegistry.ts
    domAnalyzer.ts
    similarityEngine.ts
    riskClassifier.ts
    locatorParser.ts
  auth/
    authManager.ts
    storageState.json
  utils/
    logger.ts
    fileManager.ts
frontend/
  App.tsx
  components/
    ConfigPage.tsx
    Recorder.tsx
    HealDashboard.tsx
    LocatorViewer.tsx
locators/
  registry.json
  proposed_changes.json
scripts/
  workflow.spec.ts
config/
  project.json
```


## Software-style Project Workflow

- Create project from **Project Creation** page.
- Select/open project to enter workflow page.
- Create multiple workflows per project (named `*.spec.ts`).
- Record/run/heal are scoped to selected project and workflow.
- Heal details section shows per-step status (`healthy`, `broken`, `proposed`).

## WhatsApp QR Auth Flow

1. Open UI and configure `https://web.whatsapp.com/`.
2. Click **Scan QR / Start Auth**.
3. In opened browser, complete QR scan/login/OTP.
4. Click **Check Auth Status**.
5. Once authenticated, click **Save Auth**.
6. Storage state is saved to `backend/auth/storageState.json`.

## Healing Strategy (WhatsApp-friendly)

The engine avoids dynamic classes/XPath-first strategy and weights stable metadata:

- Role match: `0.25`
- Aria-label similarity: `0.30`
- Inner text similarity: `0.20`
- Tag match: `0.15`
- DOM depth proximity: `0.10`

Threshold: `0.75`


## Product UX Improvements

- Added **Workflow Center** with workflow list, run/record/heal action cluster.
- Added **completion popups** for config save, auth start/success, recording finish, workflow run status, heal scan, and approvals.
- Added dedicated backend workflow listing endpoint: `GET /api/run/workflows`.
- Fixed heal action to actively validate registry locators against live page and generate proposals when broken.


## Debug Visibility + Multi-workflow

- `POST /api/run` now returns backend action trace in response.
- `POST /api/heal/scan` now returns detailed checks per locator (`healthy`, `broken`, `proposed`) and backend action trace.
- Added `GET /api/activity` to inspect backend run/heal/record events in UI.
- Recording supports target workflow name; multiple `*.spec.ts` files can be managed and selected from Workflow Center.
- Recorded scripts are normalized into pure `SmartRunner` workflow files (no `@playwright/test` import), fixing runtime import errors.

## Runtime Flow

1. Record workflow (`/api/record/start`, `/api/record/stop`).
2. Store parsed locators in `locators/registry.json`.
3. Run workflow (`/api/run`).
4. On failure, heal proposal generated in `locators/proposed_changes.json`.
5. Approve/reject in UI (`/api/approve`).
6. Approved locator updates registry and old locator moves to `history[]`.

## Scripts

```bash
npm install
npm run dev:backend
npm run dev:frontend
```
