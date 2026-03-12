# 3D San Francisco Transit Explorer (MVP V1)

Client-heavy PWA that renders a stylized 3D San Francisco transit explorer with in-browser stop-to-stop routing.

## Workspace layout

- `apps/web`: React + Vite PWA, R3F scene, routing worker, UI panels
- `apps/worker`: Cloudflare Worker for static hosting + thin API (`/api/health`, `/api/version`)
- `packages/transit-core`: shared contracts, projection, frequency weighting, routing engine
- `packages/eslint-config`: shared ESLint config
- `tools/gtfs-pipeline`: GTFS preprocessing pipeline

## Quick start

```bash
pnpm install
pnpm --filter @tools/gtfs-pipeline build
pnpm --filter @apps/web dev
```

## Build and deploy

```bash
pnpm build:web
pnpm build:worker
pnpm --filter @apps/worker deploy
```

## CI quality gates

1. Install dependencies
2. Typecheck all workspaces
3. Lint all workspaces
4. Unit/integration tests with coverage
5. Coverage gate (`transit-core` lines >= 90%)
6. Web build
7. Worker build
8. Playwright e2e
9. `wrangler deploy` on `main` only
