import React, { useEffect, useMemo, useState } from 'react';

import type { StopRecord } from '@packages/transit-core';

import { RENDER_PROFILE_CONFIG } from './scene/profile/constants';
import { TransitScene } from './scene/TransitScene';
import { useAppStore } from './store/appStore';
import { TransitDataProvider, useTransitData } from './transit/TransitDataProvider';
import { useRoutingWorker } from './transit/useRoutingWorker';
import './styles.css';

interface StopSearchFieldProps {
  disabled?: boolean;
  id: string;
  label: string;
  onSelect: (stopId: string | null) => void;
  selectedStop: StopRecord | null;
  stops: StopRecord[];
}

function StopSearchField({ disabled, id, label, onSelect, selectedStop, stops }: StopSearchFieldProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedStop?.name ?? '');
  }, [selectedStop]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return stops.slice(0, 8);
    }

    return stops
      .filter((stop) => {
        const name = stop.name.toLowerCase();
        return name.includes(normalized) || stop.id.includes(normalized);
      })
      .slice(0, 8);
  }, [query, stops]);

  return (
    <label className={`planner-field ${isOpen ? 'is-open' : ''}`} htmlFor={id}>
      <span>{label}</span>
      <div className="search-field">
        <input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder="Search stop name"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            if (event.target.value.trim() === '') {
              onSelect(null);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              setQuery(selectedStop?.name ?? '');
            }, 120);
          }}
        />
        {isOpen && results.length > 0 ? (
          <div className="search-results" role="listbox">
            {results.map((stop) => (
              <button
                key={stop.id}
                type="button"
                className={`search-result ${selectedStop?.id === stop.id ? 'is-active' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(stop.id);
                  setQuery(stop.name);
                  setIsOpen(false);
                }}
              >
                <span>{stop.name}</span>
                <small>{stop.id}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}

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
    setRenderProfile,
    setSelectedStopId,
    setOriginStopId,
    setDestinationStopId,
    setSelectedRouteId,
    setRouteResult,
    setRouteStatus,
    toggleLayer,
  } = useAppStore();

  const { manifest, stops, routes, graph, shapes, buildings, isCriticalReady, loadError } = useTransitData();
  const { computeRoute } = useRoutingWorker();
  const profileConfig = RENDER_PROFILE_CONFIG[renderProfile];

  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);
  const [drawCalls, setDrawCalls] = useState<number>(0);
  const [showDebug, setShowDebug] = useState(false);

  const hasCriticalFailure =
    assetStatus.manifest === 'failed' ||
    assetStatus.stops === 'failed' ||
    assetStatus.routes === 'failed' ||
    assetStatus.graph === 'failed';

  useEffect(() => {
    const interval = window.setInterval(() => {
      const calls = (window as Window & { __TRANSIT_DRAW_CALLS__?: number }).__TRANSIT_DRAW_CALLS__;
      if (typeof calls === 'number') {
        setDrawCalls(calls);
      }
    }, 400);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const plannerStops = useMemo(
    () => [...stops].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [stops],
  );

  const plannerStopIds = useMemo(() => new Set(plannerStops.map((stop) => stop.id)), [plannerStops]);

  const canCompute = Boolean(
    originStopId &&
      destinationStopId &&
      graph &&
      plannerStopIds.has(originStopId) &&
      plannerStopIds.has(destinationStopId),
  );

  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === selectedStopId) ?? null,
    [selectedStopId, stops],
  );
  const originStop = useMemo(() => stops.find((stop) => stop.id === originStopId) ?? null, [originStopId, stops]);
  const destinationStop = useMemo(
    () => stops.find((stop) => stop.id === destinationStopId) ?? null,
    [destinationStopId, stops],
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

  return (
    <div className="app-shell">
      <section className="scene-panel">
        {isCriticalReady && graph ? (
          <TransitScene
            stops={stops}
            routes={routes}
            graph={graph}
            shapes={shapes}
            buildings={buildings}
            profile={renderProfile}
            selectedRouteId={selectedRouteId}
            selectedStopId={selectedStopId}
            originStopId={originStopId}
            destinationStopId={destinationStopId}
            activeLayers={activeLayers}
            routeResult={routeResult}
            onStopClick={onStopClicked}
            onRouteHover={setSelectedRouteId}
            onCanvasMiss={() => setSelectedStopId(null)}
          />
        ) : (
          <div className="loading-state">Loading transit assets...</div>
        )}

        <div className="planner-overlay">
          <div className="planner-card">
            <div className="planner-header">
              <div>
                <h1>3D San Francisco Transit Explorer</h1>
                <p>Frequency-approximated routing. Not schedule-exact.</p>
              </div>
              <button
                type="button"
                className="debug-toggle"
                onClick={() => setShowDebug((value) => !value)}
              >
                {showDebug ? 'Hide Debug' : 'Debug'}
              </button>
            </div>

            <StopSearchField
              id="origin-stop"
              label="Origin"
              disabled={hasCriticalFailure || !isCriticalReady}
              selectedStop={originStop}
              stops={plannerStops}
              onSelect={(stopId) => setOriginStopId(stopId)}
            />

            <StopSearchField
              id="destination-stop"
              label="Destination"
              disabled={hasCriticalFailure || !isCriticalReady}
              selectedStop={destinationStop}
              stops={plannerStops}
              onSelect={(stopId) => setDestinationStopId(stopId)}
            />

            <button
              type="button"
              className="compute-button"
              onClick={onComputeRoute}
              disabled={!canCompute || hasCriticalFailure || routeStatus === 'computing'}
            >
              {routeStatus === 'computing' ? 'Computing…' : 'Compute Route'}
            </button>

            {routeErrorMessage ? <p className="error-text">{routeErrorMessage}</p> : null}

            {routeResult ? (
              <div className="route-summary compact">
                <span>{routeResult.meta.stopIds.length} stops</span>
                <span>{routeResult.meta.transferCount} transfers</span>
                <span>Cost {routeResult.meta.totalCost.toFixed(2)}</span>
              </div>
            ) : null}

            {selectedStop ? (
              <div className="selection-chip">
                <strong>{selectedStop.name}</strong>
                <span>{selectedStop.id}</span>
              </div>
            ) : null}

            {showDebug ? (
              <div className="debug-panel">
                {hasCriticalFailure ? (
                  <div className="banner error">
                    Critical transit assets failed to load. Base scene remains available; route planner is disabled.
                  </div>
                ) : null}

                {loadError ? <div className="banner warn">{loadError}</div> : null}

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
                  <h2>Status</h2>
                  <p>Profile: {renderProfile}</p>
                  <p>
                    PostFX: bloom {profileConfig.bloom ? 'on' : 'off'}, ssao{' '}
                    {profileConfig.ssao ? 'on' : 'off'}
                  </p>
                  <p>AA: {profileConfig.antialias ? 'MSAA' : profileConfig.fxaa ? 'FXAA' : 'off'}</p>
                  <p>
                    Stop cap:{' '}
                    {Number.isFinite(profileConfig.stopMarkerCap) ? profileConfig.stopMarkerCap : 'all'}
                  </p>
                  <p>Route highlight: {selectedRouteId ?? 'none'}</p>
                  <p>
                    Loaded: {stops.length} stops, {routes.length} routes
                  </p>
                  <p>Draw calls: {drawCalls}</p>
                  <p>Manifest: {manifest?.version ?? 'loading'}</p>
                  <p>Shapes: {assetStatus.shapes}</p>
                  <p>Buildings: {assetStatus.buildings}</p>
                  <div className="debug-actions">
                    <button type="button" onClick={() => setRenderProfile('QUALITY')}>
                      Quality
                    </button>
                    <button type="button" onClick={() => setRenderProfile('PERFORMANCE')}>
                      Performance
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </section>
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
