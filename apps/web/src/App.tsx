import React, { useMemo, useState } from 'react';

import 'leaflet/dist/leaflet.css';

import type { StopRecord } from '@packages/transit-core';

import { ValidationMap } from './map/ValidationMap';
import { TransitScene } from './scene/TransitScene';
import { useAppStore } from './store/appStore';
import { TransitDataProvider, useTransitData } from './transit/TransitDataProvider';
import { useRoutingWorker } from './transit/useRoutingWorker';
import './styles.css';

const SHOW_VALIDATION_OVERLAY = import.meta.env.VITE_ROUTING_VALIDATION_OVERLAY === 'true';

function TransitApp(): JSX.Element {
  const {
    selectedStopId,
    originStopId,
    destinationStopId,
    selectedRouteId,
    activeLayers,
    routeResult,
    routeStatus,
    assetStatus,
    renderProfile,
    setSelectedStopId,
    setOriginStopId,
    setDestinationStopId,
    setSelectedRouteId,
    setRouteResult,
    setRouteStatus,
    toggleLayer,
  } = useAppStore();

  const { manifest, stops, routes, graph, shapes, isCriticalReady, loadError } = useTransitData();
  const { computeRoute } = useRoutingWorker();

  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);

  const hasCriticalFailure =
    assetStatus.manifest === 'failed' ||
    assetStatus.stops === 'failed' ||
    assetStatus.routes === 'failed' ||
    assetStatus.graph === 'failed';

  const canCompute = Boolean(originStopId && destinationStopId && graph);

  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === selectedStopId) ?? null,
    [selectedStopId, stops],
  );

  const onStopClicked = (stopId: string) => {
    const clickedStop = stops.find((stop) => stop.id === stopId);
    setSelectedStopId(stopId);
    setSelectedRouteId(clickedStop?.routeIds[0] ?? null);
    if (!originStopId) {
      setOriginStopId(stopId);
      return;
    }

    if (!destinationStopId && stopId !== originStopId) {
      setDestinationStopId(stopId);
    }
  };

  const onComputeRoute = async () => {
    if (!graph || !originStopId || !destinationStopId) {
      return;
    }

    setRouteErrorMessage(null);
    setRouteStatus('computing');
    setRouteResult(null);

    try {
      const result = await computeRoute({
        originStopId,
        destinationStopId,
        graph,
        shapes,
      });
      setRouteResult(result);
      setRouteStatus('success');
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : 'INTERNAL_ERROR';
      if (errorCode === 'TIMEOUT') {
        setRouteStatus('timeout');
        setRouteErrorMessage('Route computation timed out. Please retry or choose nearby stops.');
      } else {
        setRouteStatus('error');
        setRouteErrorMessage('Unable to compute route between selected stops.');
      }
    }
  };

  const stopOptions = useMemo(
    () =>
      stops.slice(0, 2000).map((stop: StopRecord) => (
        <option key={stop.id} value={stop.id}>
          {stop.name}
        </option>
      )),
    [stops],
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>3D San Francisco Transit Explorer</h1>
        <p>Routing is frequency-approximated from GTFS trip counts and is not schedule-exact.</p>
      </header>

      {hasCriticalFailure ? (
        <div className="banner error">
          Critical transit assets failed to load. Base scene remains available; route planner is disabled.
        </div>
      ) : null}

      {loadError ? <div className="banner warn">{loadError}</div> : null}

      <main className="layout">
        <aside className="panel">
          <section>
            <h2>Layers</h2>
            <label>
              <input
                type="checkbox"
                checked={activeLayers.has('routes')}
                onChange={() => toggleLayer('routes')}
              />
              Routes
            </label>
            <label>
              <input
                type="checkbox"
                checked={activeLayers.has('stops')}
                onChange={() => toggleLayer('stops')}
              />
              Stops
            </label>
            <label>
              <input
                type="checkbox"
                checked={activeLayers.has('shapes')}
                onChange={() => toggleLayer('shapes')}
              />
              Shapes
            </label>
          </section>

          <section>
            <h2>Planner</h2>
            <label>
              Origin
              <select
                value={originStopId ?? ''}
                onChange={(event) => setOriginStopId(event.target.value || null)}
                disabled={hasCriticalFailure || !isCriticalReady}
              >
                <option value="">Select origin</option>
                {stopOptions}
              </select>
            </label>
            <label>
              Destination
              <select
                value={destinationStopId ?? ''}
                onChange={(event) => setDestinationStopId(event.target.value || null)}
                disabled={hasCriticalFailure || !isCriticalReady}
              >
                <option value="">Select destination</option>
                {stopOptions}
              </select>
            </label>

            <button
              type="button"
              onClick={onComputeRoute}
              disabled={!canCompute || hasCriticalFailure || routeStatus === 'computing'}
            >
              {routeStatus === 'computing' ? 'Computing...' : 'Compute Route'}
            </button>
            {routeErrorMessage ? <p className="error-text">{routeErrorMessage}</p> : null}

            {routeResult ? (
              <div className="route-summary">
                <p>Stops: {routeResult.meta.stopIds.length}</p>
                <p>Transfers: {routeResult.meta.transferCount}</p>
                <p>Cost: {routeResult.meta.totalCost.toFixed(2)}</p>
              </div>
            ) : null}
          </section>

          <section>
            <h2>Selection</h2>
            {selectedStop ? (
              <div>
                <p>{selectedStop.name}</p>
                <p>{selectedStop.id}</p>
                <button type="button" onClick={() => setOriginStopId(selectedStop.id)}>
                  Set Origin
                </button>
                <button type="button" onClick={() => setDestinationStopId(selectedStop.id)}>
                  Set Destination
                </button>
              </div>
            ) : (
              <p>Click a stop marker to inspect.</p>
            )}
          </section>

          <section>
            <h2>Status</h2>
            <p>Profile: {renderProfile}</p>
            <p>Manifest: {manifest?.version ?? 'loading'}</p>
            <p>Shapes: {assetStatus.shapes}</p>
          </section>
        </aside>

        <section className="scene-panel">
          {isCriticalReady && graph ? (
            <TransitScene
              stops={stops}
              routes={routes}
              graph={graph}
              shapes={shapes}
              profile={renderProfile}
              selectedRouteId={selectedRouteId}
              selectedStopId={selectedStopId}
              originStopId={originStopId}
              destinationStopId={destinationStopId}
              activeLayers={activeLayers}
              routeResult={routeResult}
              onStopClick={onStopClicked}
              onCanvasMiss={() => setSelectedStopId(null)}
            />
          ) : (
            <div className="loading-state">Loading transit assets...</div>
          )}

          {SHOW_VALIDATION_OVERLAY && isCriticalReady ? (
            <div className="validation-overlay">
              <h3>Routing Validation Overlay</h3>
              <ValidationMap stops={stops} routeResult={routeResult} />
            </div>
          ) : null}
        </section>
      </main>

      <footer className="footer-note">
        Transit data source: 511.org GTFS. Attribution and usage terms apply.
      </footer>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <TransitDataProvider>
      <TransitApp />
    </TransitDataProvider>
  );
}
