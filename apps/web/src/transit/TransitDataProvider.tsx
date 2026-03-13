import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type {
  BuildingsData,
  GraphData,
  Manifest,
  RouteRecord,
  ShapesMap,
  StopRecord,
} from '@packages/transit-core';
import { useAppStore } from '../store/appStore';
import { loadCriticalTransitAssets } from './loadTransitAssets';

interface TransitContextValue {
  manifest: Manifest | null;
  stops: StopRecord[];
  routes: RouteRecord[];
  graph: GraphData | null;
  shapes: ShapesMap;
  buildings: BuildingsData | null;
  isCriticalReady: boolean;
  loadError: string | null;
}

const TransitDataContext = createContext<TransitContextValue | null>(null);

export function TransitDataProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const setAssetStatus = useAppStore((state) => state.setAssetStatus);

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [stops, setStops] = useState<StopRecord[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [shapes, setShapes] = useState<ShapesMap>({});
  const [buildings, setBuildings] = useState<BuildingsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      try {
        const critical = await loadCriticalTransitAssets({
          onAssetStatus: (asset, status) => setAssetStatus(asset, status),
        });

        if (cancelled) {
          return;
        }

        setManifest(critical.manifest);
        setStops(critical.stops);
        setRoutes(critical.routes);
        setGraph(critical.graph);

        requestAnimationFrame(async () => {
          try {
            const loadedShapes = await critical.loadShapes();
            if (!cancelled) {
              setShapes(loadedShapes);
            }
          } catch (error) {
            if (!cancelled) {
              setLoadError(error instanceof Error ? error.message : 'Failed to load shapes');
            }
          }
        });

        requestAnimationFrame(async () => {
          try {
            const loadedBuildings = await critical.loadBuildings();
            if (!cancelled) {
              setBuildings(loadedBuildings);
            }
          } catch (error) {
            if (!cancelled) {
              setLoadError(error instanceof Error ? error.message : 'Failed to load buildings');
            }
          }
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load transit assets');
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [setAssetStatus]);

  const value = useMemo<TransitContextValue>(
    () => ({
      manifest,
      stops,
      routes,
      graph,
      shapes,
      buildings,
      isCriticalReady: manifest !== null && graph !== null && stops.length > 0 && routes.length > 0,
      loadError,
    }),
    [manifest, stops, routes, graph, shapes, buildings, loadError],
  );

  return <TransitDataContext.Provider value={value}>{children}</TransitDataContext.Provider>;
}

export function useTransitData(): TransitContextValue {
  const context = useContext(TransitDataContext);
  if (!context) {
    throw new Error('useTransitData must be used inside TransitDataProvider');
  }
  return context;
}
