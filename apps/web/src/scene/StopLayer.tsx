import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { type ThreeEvent, useFrame } from '@react-three/fiber';

import { projectEquirectangularMeters, type RouteResult, type StopRecord } from '@packages/transit-core';

interface StopLayerProps {
  stops: StopRecord[];
  visible: boolean;
  selectedStopId: string | null;
  originStopId: string | null;
  destinationStopId: string | null;
  routeResult: RouteResult | null;
  cap: number;
  onStopClick: (stopId: string) => void;
}

const tempObject = new THREE.Object3D();

function sampleStops(stops: StopRecord[], cap: number): StopRecord[] {
  if (!Number.isFinite(cap) || cap >= stops.length) {
    return stops;
  }

  const sampled: StopRecord[] = [];
  const stride = stops.length / cap;

  for (let i = 0; i < cap; i += 1) {
    const index = Math.floor(i * stride);
    const stop = stops[index];
    if (stop) {
      sampled.push(stop);
    }
  }

  return sampled;
}

export function StopLayer({
  stops,
  visible,
  selectedStopId,
  originStopId,
  destinationStopId,
  routeResult,
  cap,
  onStopClick,
}: StopLayerProps): JSX.Element | null {
  const ref = useRef<THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const clampedStops = useMemo(() => sampleStops(stops, cap), [cap, stops]);
  const hasRouteResult = routeResult !== null;

  const points = useMemo(
    () =>
      clampedStops.map((stop) => {
        const projected = projectEquirectangularMeters(stop.lat, stop.lon);
        return { id: stop.id, x: projected.x, z: -projected.y };
      }),
    [clampedStops],
  );

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    points.forEach((point, index) => {
      tempObject.position.set(point.x, 20, point.z);
      tempObject.updateMatrix();
      ref.current?.setMatrixAt(index, tempObject.matrix);

      const color =
        point.id === originStopId
          ? '#fb923c'
          : point.id === destinationStopId
            ? '#fb923c'
            : point.id === selectedStopId
              ? '#facc15'
              : point.id === hoveredStopId
                ? '#e2f7ff'
                : hasRouteResult
                  ? '#0e2230'
                  : '#38bdf8';

      ref.current?.setColorAt(index, new THREE.Color(color));
    });

    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) {
      ref.current.instanceColor.needsUpdate = true;
    }
  }, [destinationStopId, hasRouteResult, hoveredStopId, originStopId, points, selectedStopId]);

  useFrame((state) => {
    if (!materialRef.current) {
      return;
    }

    const pulse = (hasRouteResult ? 0.1 : 0.62) + Math.sin(state.clock.elapsedTime * 2.3) * (hasRouteResult ? 0.03 : 0.15);
    materialRef.current.opacity = pulse;
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const instanceId = event.instanceId;
    if (instanceId === undefined) {
      return;
    }

    const stop = points[instanceId];
    if (stop) {
      onStopClick(stop.id);
    }
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const instanceId = event.instanceId;
    if (instanceId === undefined) {
      return;
    }

    const stop = points[instanceId];
    if (!stop || stop.id === hoveredStopId) {
      return;
    }

    setHoveredStopId(stop.id);
  };

  if (!visible) {
    return null;
  }

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, points.length]}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerOut={() => setHoveredStopId(null)}
    >
      <sphereGeometry args={[hasRouteResult ? 26 : 36, 10, 10]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#7dd3fc"
        transparent
        opacity={0.72}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
