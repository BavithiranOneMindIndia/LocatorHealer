# Locator Healer (Playwright + Express + React + TypeScript)

A full-stack self-healing automation starter implementing **Record → Store → Heal → Approve → Update Locator** with JSON persistence.

## Features

- Project setup with `baseUrl`, auth mode, credentials, `storageStatePath`, and `mode` (`dev` / `ci`).
- Recording module using `playwright codegen`, parser, and locator registry generation.
- Smart runner API: use `await smart.click('element_key')`.
- Healing engine with similarity scoring (tag/role/text/attributes/proximity), threshold, risk scoring, and validation.
- Manual approval flow in UI to accept/reject proposals.
- URL navigation healing proposal when base URL fails.
- JSON storage only:
  - `config/project.json`
  - `locators/registry.json`
  - `locators/proposed_changes.json`
  - `scripts/workflow.spec.ts`
  - `auth/storage.json`

## Structure

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

## Workflow

1. **Save Config**.
2. **Start Recording** (opens Playwright codegen against `baseUrl`).
3. Interact manually, then **Stop Recording**.
4. Run **Run Workflow**.
5. If locator breaks, click **Heal** and inspect proposal diff.
6. **Approve/Reject** each proposal.
7. Approved entries update `registry.json` and push old value into `history[]`.

## Dev vs CI mode

- `dev`: auto-approve only `LOW` risk + validated heal proposals.
- `ci`: always requires manual approval.

## Notes

- This project is intentionally extensible for future AI-based healing.
- Credentials are plain JSON for now (as requested); replace with secret manager for production.
