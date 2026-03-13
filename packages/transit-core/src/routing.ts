import type { GraphData, GraphEdge, RouteResult, RouteResultMeta, ShapesMap } from './types.js';

interface ComputeRouteInput {
  graph: GraphData;
  shapes: ShapesMap;
  originStopId: string;
  destinationStopId: string;
}

interface PathSearchResult {
  edgeIndices: number[];
  totalCost: number;
}

export function computeRoute(input: ComputeRouteInput): RouteResult {
  const { graph, shapes, originStopId, destinationStopId } = input;

  const originIdx = graph.stopIndex[originStopId];
  const destinationIdx = graph.stopIndex[destinationStopId];

  if (originIdx === undefined || destinationIdx === undefined) {
    throw new Error('INVALID_INPUT');
  }

  const search = dijkstra(graph, originIdx, destinationIdx);
  if (!search) {
    throw new Error('NO_PATH');
  }

  const stopIdsByIndex = invertStopIndex(graph.stopIndex);
  const traversedEdges = search.edgeIndices.map((edgeIndex) => graph.edges[edgeIndex]);

  const stopIds = buildStopIds(traversedEdges, stopIdsByIndex, originIdx);
  const transferPoints = buildTransferPoints(traversedEdges, stopIdsByIndex);
  const geometry = buildGeometry(traversedEdges, shapes);

  const meta: RouteResultMeta = {
    stopIds,
    transferPoints,
    totalCost: search.totalCost,
    transferCount: traversedEdges.filter((edge) => edge.isTransfer).length,
  };

  return { meta, geometry };
}

function dijkstra(graph: GraphData, source: number, target: number): PathSearchResult | null {
  const adjacency = buildAdjacency(graph.edges);
  const distances = new Map<number, number>([[source, 0]]);
  const previousEdge = new Map<number, number>();
  const visited = new Set<number>();
  const frontier = new MinQueue();

  frontier.push({ node: source, priority: 0 });

  while (!frontier.isEmpty()) {
    const current = frontier.pop();
    if (!current || visited.has(current.node)) {
      continue;
    }

    visited.add(current.node);

    if (current.node === target) {
      return {
        edgeIndices: reconstructEdges(previousEdge, source, target, graph.edges),
        totalCost: distances.get(target) ?? 0,
      };
    }

    const outgoing = adjacency.get(current.node) ?? [];
    for (const edgeIndex of outgoing) {
      const edge = graph.edges[edgeIndex];
      const next = edge.to;
      const nextCost = (distances.get(current.node) ?? Number.POSITIVE_INFINITY) + edge.effectiveWeight;
      if (nextCost < (distances.get(next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next, nextCost);
        previousEdge.set(next, edgeIndex);
        frontier.push({ node: next, priority: nextCost });
      }
    }
  }

  return null;
}

function buildAdjacency(edges: GraphEdge[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  edges.forEach((edge, index) => {
    const current = map.get(edge.from) ?? [];
    current.push(index);
    map.set(edge.from, current);
  });
  return map;
}

function reconstructEdges(
  previousEdge: Map<number, number>,
  source: number,
  target: number,
  edges: GraphEdge[],
): number[] {
  const result: number[] = [];
  let current = target;

  while (current !== source) {
    const edgeIndex = previousEdge.get(current);
    if (edgeIndex === undefined) {
      return [];
    }

    result.push(edgeIndex);
    current = edges[edgeIndex].from;
  }

  return result.reverse();
}

function invertStopIndex(index: Record<string, number>): Record<number, string> {
  return Object.entries(index).reduce<Record<number, string>>((acc, [stopId, stopIdx]) => {
    acc[stopIdx] = stopId;
    return acc;
  }, {});
}

function buildStopIds(
  edges: GraphEdge[],
  stopIdsByIndex: Record<number, string>,
  originIdx: number,
): string[] {
  const stopIds = [stopIdsByIndex[originIdx] ?? String(originIdx)];
  for (const edge of edges) {
    stopIds.push(stopIdsByIndex[edge.to] ?? String(edge.to));
  }
  return stopIds;
}

function buildTransferPoints(edges: GraphEdge[], stopIdsByIndex: Record<number, string>): string[] {
  return edges
    .filter((edge) => edge.isTransfer)
    .map((edge) => stopIdsByIndex[edge.from])
    .filter((stopId): stopId is string => Boolean(stopId));
}

function buildGeometry(edges: GraphEdge[], shapes: ShapesMap): Float32Array {
  const points: number[] = [];

  for (const edge of edges) {
    if (!edge.shapeId) {
      continue;
    }

    const shape = shapes[edge.shapeId];
    if (!shape || edge.shapeStart === null || edge.shapeEnd === null) {
      continue;
    }

    const start = edge.shapeStart * 2;
    const end = edge.shapeEnd * 2;

    if (start <= end) {
      for (let i = start; i <= end + 1 && i < shape.length; i += 2) {
        points.push(shape[i], shape[i + 1]);
      }
      continue;
    }

    for (let i = start; i >= end && i >= 0; i -= 2) {
      points.push(shape[i], shape[i + 1]);
    }
  }

  return new Float32Array(points);
}

interface QueueItem {
  node: number;
  priority: number;
}

class MinQueue {
  private readonly items: QueueItem[] = [];

  push(item: QueueItem): void {
    this.items.push(item);
    this.items.sort((a, b) => a.priority - b.priority);
  }

  pop(): QueueItem | undefined {
    return this.items.shift();
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
