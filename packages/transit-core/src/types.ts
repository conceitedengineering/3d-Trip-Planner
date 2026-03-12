export type AssetName = 'manifest' | 'stops' | 'routes' | 'graph' | 'shapes';

export type RenderProfile = 'QUALITY' | 'PERFORMANCE';

export interface StopRecord {
  id: string;
  name: string;
  lat: number;
  lon: number;
  routeIds: string[];
  accessible: boolean;
}

export interface RouteRecord {
  id: string;
  shortName: string;
  longName: string;
  color: string;
  textColor: string;
  tripsPerDay: number;
  freqNorm: number;
  freqMultiplier: number;
}

export interface GraphEdge {
  from: number;
  to: number;
  routeId: string | null;
  shapeId: string | null;
  shapeStart: number | null;
  shapeEnd: number | null;
  baseWeight: number;
  effectiveWeight: number;
  isTransfer: boolean;
}

export interface GraphData {
  edges: GraphEdge[];
  stopIndex: Record<string, number>;
}

export type ShapesMap = Record<string, number[]>;

export interface ManifestFileMap {
  stops: string;
  routes: string;
  graph: string;
  shapes: string;
  [key: string]: string;
}

export interface Manifest {
  version: string;
  generatedAt: string;
  files: ManifestFileMap;
  bbox: [number, number, number, number];
  stopCount: number;
  routeCount: number;
}

export interface RouteResultMeta {
  stopIds: string[];
  transferPoints: string[];
  totalCost: number;
  transferCount: number;
}

export interface RouteResult {
  meta: RouteResultMeta;
  geometry: Float32Array;
}

export interface RouteComputeRequest {
  originStopId: string;
  destinationStopId: string;
  graph: GraphData;
  shapes: ShapesMap;
}

export interface RouteError {
  code: 'INVALID_INPUT' | 'NO_PATH' | 'INTERNAL_ERROR' | 'TIMEOUT';
  message: string;
}
