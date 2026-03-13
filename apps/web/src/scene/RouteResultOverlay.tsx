import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { projectEquirectangularMeters, type RouteResult, type StopRecord } from '@packages/transit-core';

interface RouteResultOverlayProps {
  routeResult: RouteResult | null;
  stops: StopRecord[];
}

interface PathSegment {
  from: THREE.Vector3;
  length: number;
  to: THREE.Vector3;
}

const PULSE_TRAIL_STEPS = 8;

function buildPathPoints(routeResult: RouteResult | null, stops: StopRecord[]): THREE.Vector3[] | null {
  if (!routeResult || routeResult.meta.stopIds.length < 2) {
    return null;
  }

  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const points = routeResult.meta.stopIds
    .map((stopId) => {
      const stop = stopById.get(stopId);
      if (!stop) {
        return null;
      }
      const projected = projectEquirectangularMeters(stop.lat, stop.lon);
      return new THREE.Vector3(projected.x, 30, -projected.y);
    })
    .filter((point): point is THREE.Vector3 => point !== null);

  if (points.length < 2) {
    return null;
  }

  const deduped: THREE.Vector3[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].distanceTo(points[i - 1]) > 1) {
      deduped.push(points[i]);
    }
  }

  return deduped.length >= 2 ? deduped : null;
}

function createPathCurve(points: THREE.Vector3[]): THREE.CurvePath<THREE.Vector3> {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i += 1) {
    curve.add(new THREE.LineCurve3(points[i], points[i + 1]));
  }
  return curve;
}

export function RouteResultOverlay({ routeResult, stops }: RouteResultOverlayProps): JSX.Element | null {
  const pulseRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>(null);
  const trailRefs = useRef<Array<THREE.Mesh | null>>([]);

  const pathPoints = useMemo(() => buildPathPoints(routeResult, stops), [routeResult, stops]);

  const pathSegments = useMemo<PathSegment[] | null>(() => {
    if (!pathPoints) {
      return null;
    }

    const segments: PathSegment[] = [];
    for (let i = 0; i < pathPoints.length - 1; i += 1) {
      const from = pathPoints[i];
      const to = pathPoints[i + 1];
      segments.push({
        from,
        length: from.distanceTo(to),
        to,
      });
    }
    return segments.length > 0 ? segments : null;
  }, [pathPoints]);

  const distances = useMemo(() => {
    if (!pathSegments) {
      return null;
    }

    const cumulative = [0];
    for (const segment of pathSegments) {
      cumulative.push(cumulative[cumulative.length - 1] + segment.length);
    }

    return { cumulative, total: cumulative[cumulative.length - 1] };
  }, [pathSegments]);

  const outerGeometry = useMemo(() => {
    if (!pathPoints) {
      return null;
    }
    const curve = createPathCurve(pathPoints);
    return new THREE.TubeGeometry(curve, Math.max(pathPoints.length * 14, 128), 18, 12, false);
  }, [pathPoints]);

  const innerGeometry = useMemo(() => {
    if (!pathPoints) {
      return null;
    }
    const curve = createPathCurve(pathPoints);
    return new THREE.TubeGeometry(curve, Math.max(pathPoints.length * 14, 128), 9, 12, false);
  }, [pathPoints]);

  useEffect(() => {
    return () => {
      outerGeometry?.dispose();
      innerGeometry?.dispose();
    };
  }, [innerGeometry, outerGeometry]);

  useFrame(({ clock }) => {
    if (!pulseRef.current || !pathSegments || !distances || distances.total <= 0) {
      return;
    }

    const travelDistance = (clock.elapsedTime * 280) % distances.total;
    let segmentIndex = distances.cumulative.findIndex((value) => value > travelDistance) - 1;
    if (segmentIndex < 0) {
      segmentIndex = 0;
    }
    if (segmentIndex >= pathSegments.length) {
      segmentIndex = pathSegments.length - 1;
    }

    const activeSegment = pathSegments[segmentIndex];
    const startDistance = distances.cumulative[segmentIndex];
    const endDistance = distances.cumulative[segmentIndex + 1];
    const t = endDistance > startDistance ? (travelDistance - startDistance) / (endDistance - startDistance) : 0;

    pulseRef.current.position.lerpVectors(activeSegment.from, activeSegment.to, THREE.MathUtils.clamp(t, 0, 1));
    pulseRef.current.scale.setScalar(0.9 + Math.sin(clock.elapsedTime * 6) * 0.1);

    trailRefs.current.forEach((mesh, index) => {
      if (!mesh) {
        return;
      }

      const laggedDistance = (travelDistance - index * 42 + distances.total) % distances.total;
      let laggedSegmentIndex = distances.cumulative.findIndex((value) => value > laggedDistance) - 1;
      if (laggedSegmentIndex < 0) {
        laggedSegmentIndex = 0;
      }
      if (laggedSegmentIndex >= pathSegments.length) {
        laggedSegmentIndex = pathSegments.length - 1;
      }

      const laggedSegment = pathSegments[laggedSegmentIndex];
      const laggedStart = distances.cumulative[laggedSegmentIndex];
      const laggedEnd = distances.cumulative[laggedSegmentIndex + 1];
      const laggedT = laggedEnd > laggedStart ? (laggedDistance - laggedStart) / (laggedEnd - laggedStart) : 0;

      mesh.position.lerpVectors(laggedSegment.from, laggedSegment.to, THREE.MathUtils.clamp(laggedT, 0, 1));
      mesh.scale.setScalar(Math.max(0.18, 0.8 - index * 0.08));
      (mesh.material as THREE.Material & { opacity: number }).opacity = Math.max(0.03, 0.18 - index * 0.018);
    });
  });

  if (!pathSegments || !outerGeometry || !innerGeometry) {
    return null;
  }

  return (
    <group>
      <mesh geometry={outerGeometry}>
        <meshBasicMaterial
          color="#f97316"
          transparent
          opacity={0.42}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={innerGeometry}>
        <meshBasicMaterial
          color="#ffb224"
          transparent
          opacity={1}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={pulseRef} position={pathSegments[0].from}>
        <sphereGeometry args={[28, 14, 14]} />
        <meshBasicMaterial
          color="#fde68a"
          transparent
          opacity={0.94}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {Array.from({ length: PULSE_TRAIL_STEPS }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            trailRefs.current[index] = node;
          }}
          position={pathSegments[0].from}
        >
          <sphereGeometry args={[16, 10, 10]} />
          <meshBasicMaterial
            color="#fb923c"
            transparent
            opacity={0.14}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
