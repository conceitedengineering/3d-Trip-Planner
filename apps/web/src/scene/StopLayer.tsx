import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type ThreeEvent } from '@react-three/fiber';

import { projectEquirectangularMeters, type StopRecord } from '@packages/transit-core';

interface StopLayerProps {
  stops: StopRecord[];
  visible: boolean;
  selectedStopId: string | null;
  originStopId: string | null;
  destinationStopId: string | null;
  cap: number;
  onStopClick: (stopId: string) => void;
}

const tempObject = new THREE.Object3D();

export function StopLayer({
  stops,
  visible,
  selectedStopId,
  originStopId,
  destinationStopId,
  cap,
  onStopClick,
}: StopLayerProps): JSX.Element | null {
  const ref = useRef<THREE.InstancedMesh>(null);
  const clampedStops = useMemo(() => stops.slice(0, cap), [cap, stops]);

  const points = useMemo(
    () =>
      clampedStops.map((stop) => {
        const projected = projectEquirectangularMeters(stop.lat, stop.lon);
        return { id: stop.id, x: projected.x, z: projected.y };
      }),
    [clampedStops],
  );

  useMemo(() => {
    if (!ref.current) {
      return;
    }

    points.forEach((point, index) => {
      tempObject.position.set(point.x, 8, point.z);
      tempObject.updateMatrix();
      ref.current?.setMatrixAt(index, tempObject.matrix);

      const color =
        point.id === originStopId
          ? '#22c55e'
          : point.id === destinationStopId
            ? '#fb7185'
            : point.id === selectedStopId
              ? '#facc15'
              : '#7dd3fc';

      ref.current?.setColorAt(index, new THREE.Color(color));
    });

    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) {
      ref.current.instanceColor.needsUpdate = true;
    }
  }, [points, selectedStopId, originStopId, destinationStopId]);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const instanceId = event.instanceId;
    if (instanceId === undefined) {
      return;
    }

    const stop = points[instanceId];
    if (stop) {
      onStopClick(stop.id);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} onClick={onClick}>
      <sphereGeometry args={[18, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}
