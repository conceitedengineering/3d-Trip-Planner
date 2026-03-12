# Architecture

## Runtime flow

1. Service worker loads app shell.
2. Web app fetches `/transit/manifest.json` (network-first).
3. `stops/routes/graph` load in parallel.
4. `shapes` loads lazily after first render.
5. Routing requests run in `apps/web/src/workers/routing.worker.ts`.
6. Route geometry is returned as `Float32Array` Transferable.
7. After the first R3F render frame, the app dispatches `CustomEvent('scene:ready')` on `window`.

## Scene system

Component tree:
- `TransitScene`
- `BasePlane`
- `RouteLayer`
- `StopLayer`
- `RouteResultOverlay`
- `InteractionHandler`

All interaction state is read/written through Zustand store.

## Worker registration

`apps/web/src/workers/routing.worker.ts` is registered with Vite `?worker` import syntax as a separate worker entry point.

## Render profiles

Profile selection at startup (`apps/web/src/scene/profile/selectRenderProfile.ts`):
- `PERFORMANCE` for mobile user-agent default
- `QUALITY` for non-mobile (or memory-based fallback)

`PERFORMANCE` constraints:
- bloom disabled
- SSAO disabled
- antialias disabled (FXAA only intent)
- stop markers capped at 300
- dynamic resolution scale = 0.75
