# AAS–AIM | Engineering Workspaces (Frontend)

This repository contains the development baseline of the future AAS–AIM frontend: a TypeScript/React application with engineering workspaces, navigation, source-bound investigation screens and temporary review preparation.

**Status:** Phase 46.46 frontend **runtime-verified in a local environment** on 30 October 2026; this is **not** a production approval, authenticated-backend validation, or engineering approval. The successful release verification covered 62 gates, including 2,729 React tests, 78 canonical routes across four viewports and four mounted-React screenshots. These are the results reported by a local run; the `qa/runtime/` evidence ZIP is excluded from the source repository. See `RELEASE_STATUS.md` for limitations.

## Requirements

- Node.js >=24 and <27
- pnpm 12.14.0
- Python 3.13+ and Playwright 1.57.0 + Chromium for the full release-browser audit

## Local development

```bash
pnpm install --frozen-lockfile
pnpm --dir apps/aim-next dev --host 127.0.0.1
```

Open the URL shown by Vite (normally `http://127.0.0.1:5173/`).

## Local production preview

```bash
pnpm --dir apps/aim-next run build
pnpm --dir apps/aim-next exec vite preview --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/`. Vite preview is intended for local testing, not hardened public hosting.

## Verification

```bash
# activate your Python virtual environment outside the repository first
bash scripts/phase46-39-run-consolidated.sh
```

The release runner uses `scripts/release-validation.sh` and writes local trace evidence under ignored `qa/runtime/`.

## Publication notes

- `PHASE45_*` / `PHASE46_*` root-level incremental reports and manifests have been removed from this clean release snapshot. The source contracts, functional tests, and historical technical notes under `docs/` and `qa/` remain.
- Never commit local `.env` secrets, `node_modules`, `.venv`, `dist`, or `qa/runtime` evidence. The `.gitignore` excludes these.
- Public visibility makes the entire existing GitHub repository history and Actions logs accessible. Audit them before changing repository visibility.
- No open-source license has been added by this cleanup. Visibility alone is not a license grant.
