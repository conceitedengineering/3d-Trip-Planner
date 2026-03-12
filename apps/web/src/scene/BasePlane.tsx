import React from 'react';

export function BasePlane(): JSX.Element {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[24000, 24000]} />
        <meshStandardMaterial color="#08111f" />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, -1.8, 0]}>
        <ringGeometry args={[1000, 9000, 64]} />
        <meshBasicMaterial color="#0c2e4f" transparent opacity={0.4} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, -1.7, 0]}>
        <circleGeometry args={[8500, 8]} />
        <meshStandardMaterial color="#0e1b2b" />
      </mesh>
    </group>
  );
}
