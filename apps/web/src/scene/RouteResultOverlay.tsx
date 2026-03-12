import React, { useMemo } from 'react';
import * as THREE from 'three';

import type { RouteResult } from '@packages/transit-core';

interface RouteResultOverlayProps {
  routeResult: RouteResult | null;
}

export function RouteResultOverlay({ routeResult }: RouteResultOverlayProps): JSX.Element | null {
  const geometry = useMemo(() => {
    if (!routeResult || routeResult.geometry.length < 4) {
      return null;
    }

    const points: number[] = [];
    for (let i = 0; i < routeResult.geometry.length - 2; i += 2) {
      points.push(routeResult.geometry[i], 15, routeResult.geometry[i + 1]);
      points.push(routeResult.geometry[i + 2], 15, routeResult.geometry[i + 3]);
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return buffer;
  }, [routeResult]);

  if (!geometry) {
    return null;
  }

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#f97316" transparent opacity={1} linewidth={2} />
    </lineSegments>
  );
}
