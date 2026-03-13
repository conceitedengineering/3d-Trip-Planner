import React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

import type {
  BuildingsData,
  GraphData,
  RenderProfile,
  RouteRecord,
  RouteResult,
  ShapesMap,
  StopRecord,
} from '@packages/transit-core';
import { RENDER_PROFILE_CONFIG } from './profile/constants';
import { BuildingLayer } from './BuildingLayer';
import { RouteLayer } from './RouteLayer';
import { StopLayer } from './StopLayer';
import { RouteResultOverlay } from './RouteResultOverlay';
import { SceneReadySignal } from './SceneReadySignal';
import { InteractionHandler } from './InteractionHandler';
import { OrbitCameraControls } from './OrbitCameraControls';

interface TransitSceneProps {
  stops: StopRecord[];
  routes: RouteRecord[];
  graph: GraphData;
  shapes: ShapesMap;
  buildings: BuildingsData | null;
  profile: RenderProfile;
  selectedRouteId: string | null;
  selectedStopId: string | null;
  originStopId: string | null;
  destinationStopId: string | null;
  activeLayers: Set<'routes' | 'stops' | 'shapes'>;
  routeResult: RouteResult | null;
  onStopClick: (stopId: string) => void;
  onRouteHover: (routeId: string | null) => void;
  onCanvasMiss: () => void;
}

function SceneLighting({ dimmed }: { dimmed: boolean }): JSX.Element {
  return (
    <>
      <ambientLight intensity={dimmed ? 0.22 : 0.46} />
      <hemisphereLight intensity={dimmed ? 0.16 : 0.32} groundColor="#020617" color="#6ee7ff" />
      <directionalLight
        position={[1800, 7600, 4200]}
        intensity={dimmed ? 0.52 : 1.08}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
    </>
  );
}

function DrawCallProbe(): null {
  useFrame(({ gl }) => {
    (window as Window & { __TRANSIT_DRAW_CALLS__?: number }).__TRANSIT_DRAW_CALLS__ = gl.info.render.calls;
  });
  return null;
}

export function TransitScene({
  stops,
  routes,
  graph,
  shapes,
  buildings,
  profile,
  selectedRouteId,
  selectedStopId,
  originStopId,
  destinationStopId,
  activeLayers,
  routeResult,
  onStopClick,
  onRouteHover,
  onCanvasMiss,
}: TransitSceneProps): JSX.Element {
  const config = RENDER_PROFILE_CONFIG[profile];
  const hasRouteResult = routeResult !== null;

  return (
    <Canvas
      shadows
      dpr={config.resolutionScale}
      onCreated={({ gl }) => {
        (window as Window & { __TRANSIT_GL__?: THREE.WebGLRenderer }).__TRANSIT_GL__ = gl;
      }}
      camera={{
        position: [-1700, 11800, 11200],
        fov: 36,
        near: 1,
        far: 40000,
      }}
      gl={{ antialias: config.antialias }}
      style={{ background: 'radial-gradient(circle at 15% 15%, #11243c 0%, #050b14 55%, #02040a 100%)' }}
    >
      <SceneLighting dimmed={hasRouteResult} />
      <BuildingLayer buildings={buildings} profile={profile} dimmed={hasRouteResult} />
      <RouteLayer
        graph={graph}
        routes={routes}
        shapes={shapes}
        selectedRouteId={selectedRouteId}
        routeResult={routeResult}
        visible={activeLayers.has('routes') || activeLayers.has('shapes')}
        onRouteHover={onRouteHover}
      />

      <StopLayer
        stops={stops}
        visible={activeLayers.has('stops')}
        selectedStopId={selectedStopId}
        originStopId={originStopId}
        destinationStopId={destinationStopId}
        routeResult={routeResult}
        cap={config.stopMarkerCap}
        onStopClick={onStopClick}
      />

      <RouteResultOverlay routeResult={routeResult} stops={stops} />
      <InteractionHandler onCanvasMiss={onCanvasMiss} />
      <OrbitCameraControls />
      <DrawCallProbe />
      <SceneReadySignal />
    </Canvas>
  );
}
