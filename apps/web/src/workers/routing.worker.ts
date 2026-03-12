/// <reference lib="webworker" />

import { computeRoute } from '@packages/transit-core';

import type { ComputeRouteMessage, RouteErrorMessage, RouteSuccessMessage } from './protocol';

function toRouteError(error: unknown): RouteErrorMessage {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (message.includes('INVALID_INPUT')) {
    return {
      type: 'routeError',
      payload: { code: 'INVALID_INPUT', message: 'Selected stop IDs are not valid for loaded graph.' },
    };
  }

  if (message.includes('NO_PATH')) {
    return {
      type: 'routeError',
      payload: { code: 'NO_PATH', message: 'No route found between selected stops.' },
    };
  }

  return {
    type: 'routeError',
    payload: { code: 'INTERNAL_ERROR', message },
  };
}

export function handleComputeRoute(message: ComputeRouteMessage): RouteSuccessMessage | RouteErrorMessage {
  try {
    const result = computeRoute({
      originStopId: message.payload.originStopId,
      destinationStopId: message.payload.destinationStopId,
      graph: message.payload.graph,
      shapes: message.payload.shapes,
    });

    return {
      type: 'routeSuccess',
      payload: {
        meta: result.meta,
        geometry: result.geometry,
      },
    };
  } catch (error) {
    return toRouteError(error);
  }
}

if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<ComputeRouteMessage>) => {
    if (event.data?.type !== 'computeRoute') {
      return;
    }

    const response = handleComputeRoute(event.data);

    if (response.type === 'routeSuccess') {
      self.postMessage(response, [response.payload.geometry.buffer]);
      return;
    }

    self.postMessage(response);
  };
}
