import { describe, expect, it } from 'vitest';

import { useAppStore } from '../../src/store/appStore';

describe('app store interactions', () => {
  it('updates selected stop', () => {
    useAppStore.getState().setSelectedStopId('S1');
    expect(useAppStore.getState().selectedStopId).toBe('S1');
  });

  it('toggles layers', () => {
    const hasStopsBefore = useAppStore.getState().activeLayers.has('stops');
    useAppStore.getState().toggleLayer('stops');
    expect(useAppStore.getState().activeLayers.has('stops')).toBe(!hasStopsBefore);
  });

  it('updates route highlight state on route result', () => {
    useAppStore.getState().setRouteResult({
      meta: {
        stopIds: ['S1', 'S2'],
        transferPoints: [],
        totalCost: 10,
        transferCount: 0,
      },
      geometry: new Float32Array([0, 0, 10, 10]),
    });

    expect(useAppStore.getState().routeResult?.meta.stopIds).toEqual(['S1', 'S2']);
  });
});
