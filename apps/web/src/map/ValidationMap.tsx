import React, { useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';

import type { RouteResult, StopRecord } from '@packages/transit-core';

interface ValidationMapProps {
  stops: StopRecord[];
  routeResult: RouteResult | null;
}

function toLatLngFromGeometry(geometry: Float32Array): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < geometry.length; i += 2) {
    const x = geometry[i];
    const y = geometry[i + 1];
    const lat = 37.7749 + y / 6371000 / (Math.PI / 180);
    const lon = -122.4194 + x / (6371000 * Math.cos((37.7749 * Math.PI) / 180)) / (Math.PI / 180);
    points.push([lat, lon]);
  }
  return points;
}

export function ValidationMap({ stops, routeResult }: ValidationMapProps): JSX.Element {
  const routePoints = useMemo(
    () => (routeResult ? toLatLngFromGeometry(routeResult.geometry) : []),
    [routeResult],
  );

  return (
    <MapContainer center={[37.7749, -122.4194]} zoom={12} style={{ height: 340, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {stops.slice(0, 600).map((stop) => (
        <CircleMarker
          key={stop.id}
          center={[stop.lat, stop.lon]}
          radius={2}
          pathOptions={{ color: '#38bdf8', fillOpacity: 0.8 }}
        />
      ))}

      {routePoints.length > 1 ? (
        <Polyline positions={routePoints} pathOptions={{ color: '#f97316', weight: 4 }} />
      ) : null}
    </MapContainer>
  );
}
