import React, { useMemo } from 'react';
import * as THREE from 'three';

import type { GraphData, RouteRecord, ShapesMap } from '@packages/transit-core';

interface RouteLayerProps {
  graph: GraphData;
  routes: RouteRecord[];
  shapes: ShapesMap;
  selectedRouteId: string | null;
  visible: boolean;
}

function buildRouteVertices(
  edges: GraphData['edges'],
  shapes: ShapesMap,
  routeId?: string,
): Float32Array {
  const points: number[] = [];

  for (const edge of edges) {
    if (!edge.shapeId || edge.isTransfer) {
      continue;
    }

    if (routeId && edge.routeId !== routeId) {
      continue;
    }

    const shape = shapes[edge.shapeId];
    if (!shape || shape.length < 4) {
      continue;
    }

    for (let i = 0; i < shape.length - 2; i += 2) {
      points.push(shape[i], 0, shape[i + 1]);
      points.push(shape[i + 2], 0, shape[i + 3]);
    }
  }

  return new Float32Array(points);
}

export function RouteLayer({ graph, routes, shapes, selectedRouteId, visible }: RouteLayerProps): JSX.Element | null {
  const routeColorMap = useMemo(
    () =>
      routes.reduce<Record<string, string>>((acc, route) => {
        acc[route.id] = `#${route.color}`;
        return acc;
      }, {}),
    [routes],
  );

  const baseGeometry = useMemo(() => {
    const vertices = buildRouteVertices(graph.edges, shapes);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return geometry;
  }, [graph.edges, shapes]);

  const selectedGeometry = useMemo(() => {
    if (!selectedRouteId) {
      return null;
    }

    const vertices = buildRouteVertices(graph.edges, shapes, selectedRouteId);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return geometry;
  }, [graph.edges, selectedRouteId, shapes]);

  if (!visible) {
    return null;
  }

  return (
    <group>
      <lineSegments geometry={baseGeometry}>
        <lineBasicMaterial color="#22d3ee" transparent opacity={0.38} />
      </lineSegments>

      {selectedRouteId && selectedGeometry ? (
        <lineSegments geometry={selectedGeometry}>
          <lineBasicMaterial color={routeColorMap[selectedRouteId] ?? '#fb7185'} transparent opacity={0.95} />
        </lineSegments>
      ) : null}
    </group>
  );
}
