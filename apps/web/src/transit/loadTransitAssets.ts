import type {
  AssetName,
  BuildingsData,
  GraphData,
  Manifest,
  RouteRecord,
  ShapesMap,
  StopRecord,
} from '@packages/transit-core';

interface LoadOptions {
  onAssetStatus: (asset: AssetName, status: 'loading' | 'loaded' | 'failed') => void;
}

export interface CriticalTransitAssets {
  manifest: Manifest;
  stops: StopRecord[];
  routes: RouteRecord[];
  graph: GraphData;
  loadShapes: () => Promise<ShapesMap>;
  loadBuildings: () => Promise<BuildingsData | null>;
}

export async function loadCriticalTransitAssets(options: LoadOptions): Promise<CriticalTransitAssets> {
  options.onAssetStatus('manifest', 'loading');
  const manifest = await loadJson<Manifest>('/transit/manifest.json', 'manifest', options.onAssetStatus, {
    cache: 'no-store',
  });

  const stopsUrl = manifest.files.stops;
  const routesUrl = manifest.files.routes;
  const graphUrl = manifest.files.graph;

  const [stops, routes, graph] = await Promise.all([
    loadJson<StopRecord[]>(stopsUrl, 'stops', options.onAssetStatus),
    loadJson<RouteRecord[]>(routesUrl, 'routes', options.onAssetStatus),
    loadJson<GraphData>(graphUrl, 'graph', options.onAssetStatus),
  ]);

  return {
    manifest,
    stops,
    routes,
    graph,
    loadShapes: () => loadJson<ShapesMap>(manifest.files.shapes, 'shapes', options.onAssetStatus),
    loadBuildings: () => {
      if (!manifest.files.buildings) {
        options.onAssetStatus('buildings', 'failed');
        return Promise.resolve(null);
      }
      return loadJson<BuildingsData>(manifest.files.buildings, 'buildings', options.onAssetStatus);
    },
  };
}

async function loadJson<T>(
  url: string,
  asset: AssetName,
  onAssetStatus: LoadOptions['onAssetStatus'],
  init?: RequestInit,
): Promise<T> {
  onAssetStatus(asset, 'loading');
  const response = await fetch(url, init);
  if (!response.ok) {
    onAssetStatus(asset, 'failed');
    throw new Error(`Failed to load ${asset}: ${response.status}`);
  }

  const json = (await response.json()) as T;
  onAssetStatus(asset, 'loaded');
  return json;
}
