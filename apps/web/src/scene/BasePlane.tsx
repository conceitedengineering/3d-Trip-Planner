import React, { useMemo } from 'react';
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

function terrainHeight(x: number, y: number): number {
  const broad = Math.sin(x * 0.00058) * Math.cos(y * 0.00052) * 1.2;
  const detail = Math.sin((x + y) * 0.0011) * 0.45;
  const ridge = Math.cos((x - y) * 0.00084) * 0.35;
  return broad + detail + ridge;
}

export function BasePlane(): JSX.Element {
  const boundaryProjectedForShape = useMemo(
    () =>
      SF_BOUNDARY_LAT_LON.map(([lat, lon]) => {
        const projected = projectEquirectangularMeters(lat, lon);
        return new THREE.Vector2(projected.x, -projected.y);
      }),
    [],
  );

  const landGeometry = useMemo(() => {
    const shape = new THREE.Shape(boundaryProjectedForShape);
    const geometry = new THREE.ShapeGeometry(shape, 240);
    const positions = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      positions[i + 2] = terrainHeight(x, y);
    }

    geometry.computeVertexNormals();
    return geometry;
  }, [boundaryProjectedForShape]);

  return (
    <group>
      <mesh
        geometry={landGeometry}
        rotation-x={-Math.PI / 2}
        position={[0, -8, 0]}
        castShadow={false}
        receiveShadow={false}
        renderOrder={-10}
      >
        <meshStandardMaterial
          color="#172231"
          roughness={0.97}
          metalness={0.04}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
    </group>
  );
}
