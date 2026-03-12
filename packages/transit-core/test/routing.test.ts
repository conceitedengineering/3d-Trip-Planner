import { describe, expect, it } from 'vitest';
import type { GraphData, ShapesMap } from '../src/types';
import { computeRoute } from '../src/routing';

const shapes: ShapesMap = {
  s1: [0, 0, 10, 0, 20, 0],
  s2: [20, 0, 30, 10, 40, 20],
  s3: [20, 0, 20, 10, 20, 20],
};

const graph: GraphData = {
  stopIndex: {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
  },
  edges: [
    {
      from: 0,
      to: 1,
      routeId: 'R1',
      shapeId: 's1',
      shapeStart: 0,
      shapeEnd: 2,
      baseWeight: 10,
      effectiveWeight: 10,
      isTransfer: false,
    },
    {
      from: 1,
      to: 2,
      routeId: 'R1',
      shapeId: 's2',
      shapeStart: 0,
      shapeEnd: 2,
      baseWeight: 10,
      effectiveWeight: 10,
      isTransfer: false,
    },
    {
      from: 1,
      to: 3,
      routeId: null,
      shapeId: 's3',
      shapeStart: 2,
      shapeEnd: 0,
      baseWeight: 4,
      effectiveWeight: 4,
      isTransfer: true,
    },
    {
      from: 3,
      to: 2,
      routeId: 'R2',
      shapeId: 's3',
      shapeStart: 0,
      shapeEnd: 2,
      baseWeight: 4,
      effectiveWeight: 4,
      isTransfer: false,
    },
  ],
};

describe('computeRoute', () => {
  it('builds route metadata and geometry', () => {
    const result = computeRoute({
      graph,
      shapes,
      originStopId: 'A',
      destinationStopId: 'C',
    });

    expect(result.meta.stopIds).toEqual(['A', 'B', 'D', 'C']);
    expect(result.meta.transferCount).toBe(1);
    expect(result.meta.transferPoints).toEqual(['B']);
    expect(result.geometry).toBeInstanceOf(Float32Array);
    expect(Array.from(result.geometry).length).toBeGreaterThan(0);
  });

  it('throws invalid input for unknown stop ids', () => {
    expect(() =>
      computeRoute({
        graph,
        shapes,
        originStopId: 'A',
        destinationStopId: 'Z',
      }),
    ).toThrow('INVALID_INPUT');
  });

  it('throws no path when stops are disconnected', () => {
    const disconnected: GraphData = {
      stopIndex: { A: 0, B: 1 },
      edges: [],
    };

    expect(() =>
      computeRoute({
        graph: disconnected,
        shapes,
        originStopId: 'A',
        destinationStopId: 'B',
      }),
    ).toThrow('NO_PATH');
  });
});
