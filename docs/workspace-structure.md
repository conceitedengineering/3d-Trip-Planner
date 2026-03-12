# Workspace Structure

## Workspace manager

- `pnpm-workspace.yaml` workspaces:
  - `apps/*`
  - `packages/*`
  - `tools/*`

## Workspaces and dependencies

- `apps/web`
  - depends on `@packages/transit-core`
- `tools/gtfs-pipeline`
  - depends on `@packages/transit-core`
- `apps/worker`
  - no internal workspace dependencies
- `packages/eslint-config`
  - shared lint config package

## TypeScript inheritance chain

- `tsconfig.base.json` (root shared compiler options)
- `tsconfig.json` (root project references)
- each workspace `tsconfig.json` extends root base
- workspace build configs (`tsconfig.build.json`) extend workspace `tsconfig.json`
