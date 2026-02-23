# Locator Healer (Playwright + Express + React + TypeScript)

A full-stack self-healing automation project implementing **Record → Store → Heal → Approve → Update Locator** with JSON persistence.

## What was improved

- Fixed recording startup so it does **not rely on `npx` executable** (avoids `spawn npx ENOENT`).
- Added robust **Auth Capture flow** for username/password, OTP, and QR-based auth (e.g., WhatsApp Web).
- Added dedicated auth APIs to start auth browser, check status, save storage state, and cancel.
- Improved UI with a clearer product-style layout and auth status/toast messages.

## Features

- Project setup with `baseUrl`, auth mode, `storageStatePath`, and run `mode` (`dev` / `ci`).
- Extended auth config supports:
  - username/password
  - OTP
  - QR flow
  - success URL/selector detection
- Recording module using Playwright codegen and automatic locator metadata extraction.
- Smart runner API: `await smart.click('element_key')`.
- Healing engine with similarity scoring and risk classification.
- Manual approval flow for locator updates.
- URL navigation healing proposal when base URL fails.

## Folder Structure

```text
backend/
  server.ts
  smartRunner.ts
  healingEngine.ts
  locatorParser.ts
  logger.ts
  storage.ts
  types.ts
frontend/
  App.tsx
  main.tsx
config/project.json
locators/registry.json
locators/proposed_changes.json
scripts/workflow.spec.ts
auth/storage.json
```

## Auth Capture Workflow (for QR login products like WhatsApp)

1. Set `authMode=auth` and configure auth fields in UI.
2. Click **Save Config**.
3. Click **Start Auth Capture** (headed browser opens).
4. Complete login manually (username/password/OTP/QR scan).
5. Click **Check Auth Status** until authenticated is detected.
6. Click **Save Auth State**.
7. UI shows success popup: auth saved; proceed to recording.

## Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start backend:
   ```bash
   npm run dev:backend
   ```
3. Start frontend:
   ```bash
   npm run dev:frontend
   ```
4. Open frontend: `http://localhost:5173`

## Dev vs CI mode

- `dev`: auto-approve only `LOW` risk + validated heal proposals.
- `ci`: always requires manual approval.
