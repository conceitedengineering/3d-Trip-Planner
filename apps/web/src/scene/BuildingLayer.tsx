import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { BuildingsData, RenderProfile } from '@packages/transit-core';

interface BuildingLayerProps {
  buildings: BuildingsData | null;
  dimmed: boolean;
  profile: RenderProfile;
}

interface Placement {
  depth: number;
  height: number;
  id: string;
  isLandmark: boolean;
  width: number;
  x: number;
  z: number;
}

const tempObject = new THREE.Object3D();
const BUILDING_HEIGHT_EXAGGERATION = 2.75;
const LANDMARK_HEIGHT_EXAGGERATION = 3.2;

function polygonArea(coords: number[]): number {
  const count = coords.length / 2;
  if (count < 3) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const j = (i + 1) % count;
    const xi = coords[i * 2];
    const yi = coords[i * 2 + 1];
    const xj = coords[j * 2];
    const yj = coords[j * 2 + 1];
    sum += xi * yj - xj * yi;
  }
  return Math.abs(sum) / 2;
}

function polygonCentroid(coords: number[]): { x: number; z: number } {
  let x = 0;
  let z = 0;
  const count = coords.length / 2;
  for (let i = 0; i < count; i += 1) {
    x += coords[i * 2];
    z += -coords[i * 2 + 1];
  }
  return { x: x / count, z: z / count };
}

export function BuildingLayer({ buildings, dimmed, profile }: BuildingLayerProps): JSX.Element | null {
  const regularRef = useRef<
    THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null
  >(null);
  const landmarkRef = useRef<
    THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null
  >(null);

  const regular = useMemo<Placement[]>(() => {
    if (profile !== 'QUALITY' || !buildings) {
      return [];
    }

    return buildings.buildings
      .filter((b) => !b.isLandmark)
      .map((b) => {
        const area = Math.max(9, polygonArea(b.coords));
        const centroid = polygonCentroid(b.coords);
        const size = Math.sqrt(area);
        return {
          depth: THREE.MathUtils.clamp(size * 0.85, 3, 40),
          height: THREE.MathUtils.clamp(b.height * BUILDING_HEIGHT_EXAGGERATION, 6, 720),
          id: b.id,
          isLandmark: false,
          width: THREE.MathUtils.clamp(size * 0.85, 3, 40),
          x: centroid.x,
          z: centroid.z,
        };
      });
  }, [buildings, profile]);

  const landmarks = useMemo<Placement[]>(() => {
    if (profile !== 'QUALITY' || !buildings) {
      return [];
    }

    return buildings.buildings
      .filter((b) => b.isLandmark)
      .map((b) => {
        const area = Math.max(16, polygonArea(b.coords));
        const centroid = polygonCentroid(b.coords);
        const size = Math.sqrt(area);
        return {
          depth: THREE.MathUtils.clamp(size, 5, 70),
          height: THREE.MathUtils.clamp(b.height * LANDMARK_HEIGHT_EXAGGERATION, 14, 980),
          id: b.id,
          isLandmark: true,
          width: THREE.MathUtils.clamp(size, 5, 70),
          x: centroid.x,
          z: centroid.z,
        };
      });
  }, [buildings, profile]);

  useLayoutEffect(() => {
    const mesh = regularRef.current;
    if (!mesh) {
      return;
    }

    regular.forEach((placement, index) => {
      tempObject.position.set(placement.x, placement.height * 0.5, placement.z);
      tempObject.scale.set(placement.width, placement.height, placement.depth);
      tempObject.updateMatrix();
      mesh.setMatrixAt(index, tempObject.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [regular]);

  useLayoutEffect(() => {
    const mesh = landmarkRef.current;
    if (!mesh) {
      return;
    }

    landmarks.forEach((placement, index) => {
      tempObject.position.set(placement.x, placement.height * 0.5, placement.z);
      tempObject.scale.set(placement.width, placement.height, placement.depth);
      tempObject.updateMatrix();
      mesh.setMatrixAt(index, tempObject.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [landmarks]);

  if (profile !== 'QUALITY') {
    return null;
  }

  return (
    <group position={[0, 0, 0]}>
      {regular.length > 0 ? (
        <instancedMesh ref={regularRef} args={[undefined, undefined, regular.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={dimmed ? 0.1 : 0.4}
            transparent
            opacity={dimmed ? 0.18 : 0.7}
            depthWrite={false}
          />
        </instancedMesh>
      ) : null}
      {landmarks.length > 0 ? (
        <instancedMesh ref={landmarkRef} args={[undefined, undefined, landmarks.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ff6600"
            emissive="#ff6600"
            emissiveIntensity={dimmed ? 0.18 : 0.8}
            transparent
            opacity={dimmed ? 0.26 : 0.9}
            depthWrite={false}
          />
        </instancedMesh>
      ) : null}
    </group>
  );
}
