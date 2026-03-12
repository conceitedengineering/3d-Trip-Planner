import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import type { GraphData, RenderProfile, RouteRecord, RouteResult, ShapesMap, StopRecord } from '@packages/transit-core';
import { RENDER_PROFILE_CONFIG } from './profile/constants';
import { BasePlane } from './BasePlane';
import { RouteLayer } from './RouteLayer';
import { StopLayer } from './StopLayer';
import { RouteResultOverlay } from './RouteResultOverlay';
import { SceneReadySignal } from './SceneReadySignal';
import { InteractionHandler } from './InteractionHandler';

interface TransitSceneProps {
  stops: StopRecord[];
  routes: RouteRecord[];
  graph: GraphData;
  shapes: ShapesMap;
  profile: RenderProfile;
  selectedRouteId: string | null;
  selectedStopId: string | null;
  originStopId: string | null;
  destinationStopId: string | null;
  activeLayers: Set<'routes' | 'stops' | 'shapes'>;
  routeResult: RouteResult | null;
  onStopClick: (stopId: string) => void;
  onCanvasMiss: () => void;
}

export function TransitScene({
  stops,
  routes,
  graph,
  shapes,
  profile,
  selectedRouteId,
  selectedStopId,
  originStopId,
  destinationStopId,
  activeLayers,
  routeResult,
  onStopClick,
  onCanvasMiss,
}: TransitSceneProps): JSX.Element {
  const config = RENDER_PROFILE_CONFIG[profile];

  return (
    <Canvas
      shadows
      dpr={config.resolutionScale}
      camera={{
        position: [0, 3600, 5000],
        fov: 45,
      }}
      gl={{ antialias: config.antialias }}
      style={{ background: '#050b14' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2500, 3500, 1500]} intensity={0.9} />
      <BasePlane />

      <RouteLayer
        graph={graph}
        routes={routes}
        shapes={shapes}
        selectedRouteId={selectedRouteId}
        visible={activeLayers.has('routes') || activeLayers.has('shapes')}
      />

      <StopLayer
        stops={stops}
        visible={activeLayers.has('stops')}
        selectedStopId={selectedStopId}
        originStopId={originStopId}
        destinationStopId={destinationStopId}
        cap={config.stopMarkerCap}
        onStopClick={onStopClick}
      />

      <RouteResultOverlay routeResult={routeResult} />
      <InteractionHandler onCanvasMiss={onCanvasMiss} />
      <OrbitControls makeDefault enablePan enableRotate enableZoom />
      <SceneReadySignal />
    </Canvas>
  );
}
