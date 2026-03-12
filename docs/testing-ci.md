# Testing and CI

## Test framework

- Vitest is used for unit/integration tests across:
  - `packages/transit-core`
  - `tools/gtfs-pipeline`
  - `apps/web` Worker and store tests
- Coverage provider: `@vitest/coverage-v8`

## Coverage policy

- Enforced in V1:
  - `packages/transit-core` line coverage must be >= 90%
- All other workspaces:
  - coverage collected, no enforced threshold

## Linting and formatting

- ESLint + `typescript-eslint` with shared config from `packages/eslint-config`
- Prettier with root `.prettierrc`
- `lint-staged` pre-commit hook runs ESLint + Prettier on staged files
- Lint and formatting violations are CI-blocking

## CI ordered steps

1. Install dependencies
2. Typecheck all workspaces (`tsc --noEmit`)
3. Lint all workspaces
4. Unit tests with coverage (`vitest run --coverage`)
5. Coverage gate (`transit-core` lines >= 90%)
6. Web build
7. Worker build
8. Playwright e2e against local preview server
9. `wrangler deploy` on `main` only

## Playwright specifics

- Chromium-only in V1
- Launch flag: `--use-gl=egl`
- Uses Playwright `webServer` to run local preview server
- E2E scenarios:
  - app loads + scene initializes with no console errors
  - origin/destination selection and route compute
  - offline shell fallback with network blocked
  - critical transit asset load failure degraded mode
- Tests wait for `window` `scene:ready` event instead of fixed timeout waits
