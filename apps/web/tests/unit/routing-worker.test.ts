import { describe, expect, it } from 'vitest';

import { handleComputeRoute } from '../../src/workers/routing.worker';

describe('routing worker protocol', () => {
  it('returns transferable geometry payload on success', () => {
    const response = handleComputeRoute({
      type: 'computeRoute',
      payload: {
        originStopId: 'A',
        destinationStopId: 'B',
        graph: {
          stopIndex: { A: 0, B: 1 },
          edges: [
            {
              from: 0,
              to: 1,
              routeId: 'R1',
              shapeId: 'S1',
              shapeStart: 0,
              shapeEnd: 1,
              baseWeight: 5,
              effectiveWeight: 5,
              isTransfer: false,
            },
          ],
        },
        shapes: {
          S1: [0, 0, 10, 10],
        },
      },
    });

    expect(response.type).toBe('routeSuccess');
    if (response.type === 'routeSuccess') {
      expect(response.payload.geometry).toBeInstanceOf(Float32Array);
      expect(response.payload.geometry.buffer.byteLength).toBeGreaterThan(0);
    }
  });

  it('returns routeError for no path', () => {
    const response = handleComputeRoute({
      type: 'computeRoute',
      payload: {
        originStopId: 'A',
        destinationStopId: 'B',
        graph: {
          stopIndex: { A: 0, B: 1 },
          edges: [],
        },
        shapes: {},
      },
    });

    expect(response.type).toBe('routeError');
  });
});
