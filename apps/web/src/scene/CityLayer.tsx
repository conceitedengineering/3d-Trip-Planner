import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { projectEquirectangularMeters } from '@packages/transit-core';

const SF_BOUNDARY_LAT_LON: Array<[number, number]> = [
  [37.8068, -122.5154],
  [37.8249, -122.5072],
  [37.8328, -122.4823],
  [37.8299, -122.4578],
  [37.8198, -122.4314],
  [37.8086, -122.4014],
  [37.8054, -122.3794],
  [37.793, -122.3676],
  [37.7747, -122.3628],
  [37.752, -122.3658],
  [37.7257, -122.3706],
  [37.7081, -122.3746],
  [37.7061, -122.3918],
  [37.7059, -122.4236],
  [37.7082, -122.4568],
  [37.7096, -122.4838],
  [37.7208, -122.5079],
  [37.7415, -122.5174],
  [37.7651, -122.5208],
  [37.7889, -122.5192],
];

interface BuildingPlacement {
  depth: number;
  height: number;
  width: number;
  x: number;
  z: number;
}

const tempObject = new THREE.Object3D();

function hash2(x: number, z: number): number {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function pointInPolygon(x: number, z: number, polygon: Array<[number, number]>): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const intersects = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function CityLayer(): JSX.Element | null {
  const meshRef = useRef<THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>(null);

  const placements = useMemo<BuildingPlacement[]>(() => {
    const polygon = SF_BOUNDARY_LAT_LON.map(([lat, lon]) => {
      const projected = projectEquirectangularMeters(lat, lon);
      return [projected.x, projected.y] as [number, number];
    });

    const bounds = polygon.reduce(
      (acc, [x, z]) => ({
        maxX: Math.max(acc.maxX, x),
        maxZ: Math.max(acc.maxZ, z),
        minX: Math.min(acc.minX, x),
        minZ: Math.min(acc.minZ, z),
      }),
      { maxX: -Infinity, maxZ: -Infinity, minX: Infinity, minZ: Infinity },
    );

    const results: BuildingPlacement[] = [];
    const spacing = 260;

    for (let x = bounds.minX + spacing * 0.5; x <= bounds.maxX; x += spacing) {
      for (let z = bounds.minZ + spacing * 0.5; z <= bounds.maxZ; z += spacing) {
        const seed = hash2(x * 0.001, z * 0.001);
        if (seed < 0.34) {
          continue;
        }

        const jx = (hash2(x * 0.0031, z * 0.0023) - 0.5) * 80;
        const jz = (hash2(x * 0.0023, z * 0.0037) - 0.5) * 80;
        const cx = x + jx;
        const cz = z + jz;

        if (!pointInPolygon(cx, cz, polygon)) {
          continue;
        }

        const height = 36 + hash2(cx * 0.004, cz * 0.004) * 220;
        const width = 72 + hash2(cx * 0.0017, cz * 0.0011) * 130;
        const depth = 72 + hash2(cx * 0.0013, cz * 0.0019) * 130;

        results.push({ depth, height, width, x: cx, z: cz });
      }
    }

    return results;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    placements.forEach((placement, index) => {
      tempObject.position.set(placement.x, placement.height * 0.5, placement.z);
      tempObject.scale.set(placement.width, placement.height, placement.depth);
      tempObject.updateMatrix();
      mesh.setMatrixAt(index, tempObject.matrix);

      const luminance = 0.2 + (placement.height / 260) * 0.35;
      mesh.setColorAt(index, new THREE.Color(luminance * 0.35, luminance * 0.45, luminance * 0.55));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [placements]);

  if (placements.length === 0) {
    return null;
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, placements.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#1b2f44"
        emissive="#0a1827"
        emissiveIntensity={0.55}
        roughness={0.86}
        metalness={0.06}
        transparent
        opacity={0.46}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

