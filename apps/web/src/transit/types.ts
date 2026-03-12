import type {
  GraphData,
  Manifest,
  RouteRecord,
  ShapesMap,
  StopRecord,
} from '@packages/transit-core';

export interface LoadedTransitAssets {
  manifest: Manifest;
  stops: StopRecord[];
  routes: RouteRecord[];
  graph: GraphData;
  shapes: ShapesMap;
}
