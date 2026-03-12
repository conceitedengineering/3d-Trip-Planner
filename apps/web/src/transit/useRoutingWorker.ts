import { useCallback, useEffect, useRef } from 'react';

import type { GraphData, RouteResult, ShapesMap } from '@packages/transit-core';

import type { ComputeRouteMessage, RoutingWorkerResponse } from '../workers/protocol';
import RoutingWorker from '../workers/routing.worker?worker';

const ROUTING_TIMEOUT_MS = 2500;

interface ComputeRouteParams {
  originStopId: string;
  destinationStopId: string;
  graph: GraphData;
  shapes: ShapesMap;
}

export function useRoutingWorker(): {
  computeRoute: (params: ComputeRouteParams) => Promise<RouteResult>;
} {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new RoutingWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const computeRoute = useCallback(async (params: ComputeRouteParams): Promise<RouteResult> => {
    const firstAttempt = await runWorker(workerRef.current, params);
    if (firstAttempt.ok) {
      return firstAttempt.value;
    }

    if (firstAttempt.error === 'TIMEOUT' || firstAttempt.error === 'INTERNAL_ERROR') {
      workerRef.current?.terminate();
      workerRef.current = new RoutingWorker();
      const secondAttempt = await runWorker(workerRef.current, params);
      if (secondAttempt.ok) {
        return secondAttempt.value;
      }
      throw new Error(secondAttempt.error);
    }

    throw new Error(firstAttempt.error);
  }, []);

  return { computeRoute };
}

async function runWorker(
  worker: Worker | null,
  params: ComputeRouteParams,
): Promise<{ ok: true; value: RouteResult } | { ok: false; error: string }> {
  if (!worker) {
    return { ok: false, error: 'INTERNAL_ERROR' };
  }

  const message: ComputeRouteMessage = {
    type: 'computeRoute',
    payload: {
      originStopId: params.originStopId,
      destinationStopId: params.destinationStopId,
      graph: params.graph,
      shapes: params.shapes,
    },
  };

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve({ ok: false, error: 'TIMEOUT' });
    }, ROUTING_TIMEOUT_MS);

    const onMessage = (event: MessageEvent<RoutingWorkerResponse>) => {
      if (event.data.type === 'routeSuccess') {
        cleanup();
        resolve({
          ok: true,
          value: {
            meta: event.data.payload.meta,
            geometry: event.data.payload.geometry,
          },
        });
        return;
      }

      if (event.data.type === 'routeError') {
        cleanup();
        resolve({ ok: false, error: event.data.payload.code });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener('message', onMessage);
    };

    worker.addEventListener('message', onMessage);
    worker.postMessage(message);
  });
}
