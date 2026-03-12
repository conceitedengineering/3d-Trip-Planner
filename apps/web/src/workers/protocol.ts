import type { GraphData, RouteResultMeta, ShapesMap } from '@packages/transit-core';

export interface ComputeRouteMessage {
  type: 'computeRoute';
  payload: {
    originStopId: string;
    destinationStopId: string;
    graph: GraphData;
    shapes: ShapesMap;
  };
}

export interface RouteSuccessMessage {
  type: 'routeSuccess';
  payload: {
    meta: RouteResultMeta;
    geometry: Float32Array;
  };
}

export interface RouteErrorMessage {
  type: 'routeError';
  payload: {
    code: 'INVALID_INPUT' | 'NO_PATH' | 'INTERNAL_ERROR' | 'TIMEOUT';
    message: string;
  };
}

export interface WorkerRestartedMessage {
  type: 'workerRestarted';
}

export type RoutingWorkerRequest = ComputeRouteMessage;
export type RoutingWorkerResponse = RouteSuccessMessage | RouteErrorMessage | WorkerRestartedMessage;
