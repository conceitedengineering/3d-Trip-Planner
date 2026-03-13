import React, { useMemo } from 'react';
import * as THREE from 'three';

import type { GraphData, RouteRecord, RouteResult, ShapesMap } from '@packages/transit-core';

interface RouteLayerProps {
  graph: GraphData;
  routes: RouteRecord[];
  shapes: ShapesMap;
  selectedRouteId: string | null;
  routeResult: RouteResult | null;
  visible: boolean;
  onRouteHover?: (routeId: string | null) => void;
}

interface RouteGeometry {
  id: string;
  color: string;
  geometry: THREE.BufferGeometry;
}

function normalizeRouteColor(raw: string | undefined): string {
  if (!raw) {
    return '#22d3ee';
  }

  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized : '#22d3ee';
}

function toSegmentKey(x1: number, y1: number, x2: number, y2: number): string {
  const a = `${x1.toFixed(2)},${y1.toFixed(2)}`;
  const b = `${x2.toFixed(2)},${y2.toFixed(2)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function RouteLayer({
  graph,
  routes,
  shapes,
  selectedRouteId,
  routeResult,
  visible,
  onRouteHover,
}: RouteLayerProps): JSX.Element | null {
  const hasRouteResult = routeResult !== null;

  const activeRouteSegmentKeys = useMemo(() => {
    if (!routeResult || routeResult.geometry.length < 4) {
      return null;
    }

    const keys = new Set<string>();
    for (let i = 0; i < routeResult.geometry.length - 2; i += 2) {
      const x1 = routeResult.geometry[i];
      const y1 = routeResult.geometry[i + 1];
      const x2 = routeResult.geometry[i + 2];
      const y2 = routeResult.geometry[i + 3];
      keys.add(toSegmentKey(x1, y1, x2, y2));
    }
    return keys;
  }, [routeResult]);

  const routeGeometries = useMemo<RouteGeometry[]>(() => {
    const pointsByRoute = new Map<string, number[]>();

    for (const edge of graph.edges) {
      if (!edge.routeId || !edge.shapeId || edge.isTransfer) {
        continue;
      }

      const shape = shapes[edge.shapeId];
      if (!shape || shape.length < 4) {
        continue;
      }

      const points = pointsByRoute.get(edge.routeId) ?? [];
      for (let i = 0; i < shape.length - 2; i += 2) {
        const x1 = shape[i];
        const y1 = shape[i + 1];
        const x2 = shape[i + 2];
        const y2 = shape[i + 3];

        const shouldLimitToComputedPath =
          Boolean(selectedRouteId) &&
          Boolean(activeRouteSegmentKeys) &&
          edge.routeId === selectedRouteId &&
          routeResult !== null;

        if (shouldLimitToComputedPath && !activeRouteSegmentKeys?.has(toSegmentKey(x1, y1, x2, y2))) {
          continue;
        }

        points.push(x1, 12, -y1);
        points.push(x2, 12, -y2);
      }

      pointsByRoute.set(edge.routeId, points);
    }

    return routes
      .map((route) => {
        const routePoints = pointsByRoute.get(route.id);
        if (!routePoints || routePoints.length === 0) {
          return null;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(routePoints), 3));
        return {
          id: route.id,
          color: normalizeRouteColor(route.color),
          geometry,
        };
      })
      .filter((route): route is RouteGeometry => route !== null);
  }, [activeRouteSegmentKeys, graph.edges, routeResult, routes, selectedRouteId, shapes]);

  const selectedRouteGeometry = useMemo(
    () => routeGeometries.find((routeGeometry) => routeGeometry.id === selectedRouteId) ?? null,
    [routeGeometries, selectedRouteId],
  );

  if (!visible) {
    return null;
  }

  return (
    <group>
      {routeGeometries.map((routeGeometry) => (
        <lineSegments
          key={routeGeometry.id}
          geometry={routeGeometry.geometry}
          onPointerOver={(event) => {
            event.stopPropagation();
            onRouteHover?.(routeGeometry.id);
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            onRouteHover?.(null);
          }}
        >
          <lineBasicMaterial
            color={routeGeometry.color}
            transparent
            opacity={
              hasRouteResult
                ? selectedRouteId === routeGeometry.id
                  ? 0.12
                  : 0.025
                : selectedRouteId === routeGeometry.id
                  ? 0.35
                  : 0.2
            }
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      ))}

      {selectedRouteGeometry && !hasRouteResult ? (
        <>
          <lineSegments geometry={selectedRouteGeometry.geometry}>
            <lineBasicMaterial
              color={selectedRouteGeometry.color}
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </lineSegments>
          <points geometry={selectedRouteGeometry.geometry}>
            <pointsMaterial
              color={selectedRouteGeometry.color}
              size={20}
              sizeAttenuation
              transparent
              opacity={0.38}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </points>
        </>
      ) : null}
    </group>
  );
}
