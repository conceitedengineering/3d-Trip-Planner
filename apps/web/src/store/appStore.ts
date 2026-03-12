import { create } from 'zustand';

import type { AssetName, RenderProfile, RouteResult } from '@packages/transit-core';

export type LayerName = 'routes' | 'stops' | 'shapes';

export interface AppState {
  selectedStopId: string | null;
  originStopId: string | null;
  destinationStopId: string | null;
  selectedRouteId: string | null;
  activeLayers: Set<LayerName>;
  routeResult: RouteResult | null;
  routeStatus: 'idle' | 'computing' | 'success' | 'error' | 'timeout';
  assetStatus: Record<AssetName, 'loading' | 'loaded' | 'failed'>;
  renderProfile: RenderProfile;
  setSelectedStopId: (value: string | null) => void;
  setOriginStopId: (value: string | null) => void;
  setDestinationStopId: (value: string | null) => void;
  setSelectedRouteId: (value: string | null) => void;
  toggleLayer: (layer: LayerName) => void;
  setRouteResult: (value: RouteResult | null) => void;
  setRouteStatus: (value: AppState['routeStatus']) => void;
  setAssetStatus: (asset: AssetName, status: AppState['assetStatus'][AssetName]) => void;
  setRenderProfile: (profile: RenderProfile) => void;
}

const initialAssetStatus: Record<AssetName, 'loading' | 'loaded' | 'failed'> = {
  manifest: 'loading',
  stops: 'loading',
  routes: 'loading',
  graph: 'loading',
  shapes: 'loading',
};

export const useAppStore = create<AppState>((set) => ({
  selectedStopId: null,
  originStopId: null,
  destinationStopId: null,
  selectedRouteId: null,
  activeLayers: new Set<LayerName>(['routes', 'stops', 'shapes']),
  routeResult: null,
  routeStatus: 'idle',
  assetStatus: initialAssetStatus,
  renderProfile: 'PERFORMANCE',
  setSelectedStopId: (value) => set({ selectedStopId: value }),
  setOriginStopId: (value) => set({ originStopId: value }),
  setDestinationStopId: (value) => set({ destinationStopId: value }),
  setSelectedRouteId: (value) => set({ selectedRouteId: value }),
  toggleLayer: (layer) =>
    set((state) => {
      const next = new Set(state.activeLayers);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return { activeLayers: next };
    }),
  setRouteResult: (value) => set({ routeResult: value }),
  setRouteStatus: (value) => set({ routeStatus: value }),
  setAssetStatus: (asset, status) =>
    set((state) => ({
      assetStatus: {
        ...state.assetStatus,
        [asset]: status,
      },
    })),
  setRenderProfile: (profile) => set({ renderProfile: profile }),
}));
