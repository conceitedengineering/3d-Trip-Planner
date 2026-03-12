import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  applyFrequencyWeight,
  computeFrequencyMultiplier,
  computeFrequencyNorm,
  projectEquirectangularMeters,
  type GraphData,
  type GraphEdge,
  type Manifest,
  type RouteRecord,
  type ShapesMap,
  type StopRecord,
} from '@packages/transit-core';

interface CsvRow {
  [key: string]: string;
}

interface GtfsData {
  stops: CsvRow[];
  routes: CsvRow[];
  trips: CsvRow[];
  stopTimes: CsvRow[];
  shapes: CsvRow[];
  transfers: CsvRow[];
}

interface BuildOutput {
  stops: StopRecord[];
  routes: RouteRecord[];
  shapes: ShapesMap;
  graph: GraphData;
  bbox: [number, number, number, number];
}

interface BuildOptions {
  representativeServiceId?: string;
  transferPenaltyMinutes?: number;
}

export async function loadGtfsDirectory(rawDir: string): Promise<GtfsData> {
  return {
    stops: await readCsv(path.join(rawDir, 'stops.txt')),
    routes: await readCsv(path.join(rawDir, 'routes.txt')),
    trips: await readCsv(path.join(rawDir, 'trips.txt')),
    stopTimes: await readCsv(path.join(rawDir, 'stop_times.txt')),
    shapes: await readCsv(path.join(rawDir, 'shapes.txt')),
    transfers: await readCsvIfExists(path.join(rawDir, 'transfers.txt')),
  };
}

export function buildProcessedData(data: GtfsData, options: BuildOptions = {}): BuildOutput {
  const transferPenalty = options.transferPenaltyMinutes ?? 6;

  const routeTripCounts = buildRouteTripCounts(data.trips, options.representativeServiceId);
  const maxTripsPerDay = Math.max(1, ...Object.values(routeTripCounts));

  const routes: RouteRecord[] = data.routes.map((route) => {
    const tripsPerDay = routeTripCounts[route.route_id] ?? 0;
    const freqNorm = computeFrequencyNorm(tripsPerDay, maxTripsPerDay);
    const freqMultiplier = computeFrequencyMultiplier(freqNorm);

    return {
      id: route.route_id,
      shortName: route.route_short_name ?? '',
      longName: route.route_long_name ?? '',
      color: normalizeColor(route.route_color, '38BDF8'),
      textColor: normalizeColor(route.route_text_color, 'FFFFFF'),
      tripsPerDay,
      freqNorm,
      freqMultiplier,
    };
  });

  const routeById = new Map(routes.map((route) => [route.id, route]));

  const routeIdsByStop = new Map<string, Set<string>>();
  for (const stopTime of data.stopTimes) {
    const trip = data.trips.find((candidate) => candidate.trip_id === stopTime.trip_id);
    if (!trip) {
      continue;
    }

    const current = routeIdsByStop.get(stopTime.stop_id) ?? new Set<string>();
    current.add(trip.route_id);
    routeIdsByStop.set(stopTime.stop_id, current);
  }

  const stops: StopRecord[] = data.stops.map((stop) => ({
    id: stop.stop_id,
    name: stop.stop_name,
    lat: Number(stop.stop_lat),
    lon: Number(stop.stop_lon),
    routeIds: Array.from(routeIdsByStop.get(stop.stop_id) ?? []).sort(),
    accessible: stop.wheelchair_boarding === '1',
  }));

  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const projectedStops = new Map(
    stops.map((stop) => [stop.id, projectEquirectangularMeters(stop.lat, stop.lon)]),
  );

  const shapes = buildShapesMap(data.shapes);

  const stopIndex = Object.fromEntries(stops.map((stop, index) => [stop.id, index]));

  const tripById = new Map(data.trips.map((trip) => [trip.trip_id, trip]));
  const stopTimesByTrip = groupBy(data.stopTimes, 'trip_id');

  const edgeMap = new Map<string, GraphEdge>();

  for (const [tripId, stopTimes] of stopTimesByTrip.entries()) {
    const trip = tripById.get(tripId);
    if (!trip) {
      continue;
    }

    const route = routeById.get(trip.route_id);
    const multiplier = route?.freqMultiplier ?? 1;

    const ordered = [...stopTimes].sort(
      (a, b) => Number(a.stop_sequence) - Number(b.stop_sequence),
    );

    for (let i = 0; i < ordered.length - 1; i += 1) {
      const from = ordered[i];
      const to = ordered[i + 1];

      const fromIdx = stopIndex[from.stop_id];
      const toIdx = stopIndex[to.stop_id];
      if (fromIdx === undefined || toIdx === undefined) {
        continue;
      }

      const distanceMeters = distanceBetween(projectedStops.get(from.stop_id), projectedStops.get(to.stop_id));
      const baseWeight = Math.max(1, distanceMeters / 100);
      const effectiveWeight = applyFrequencyWeight(baseWeight, multiplier);

      const shape = trip.shape_id ? shapes[trip.shape_id] : undefined;
      const edge: GraphEdge = {
        from: fromIdx,
        to: toIdx,
        routeId: trip.route_id,
        shapeId: trip.shape_id ?? null,
        shapeStart: shape ? 0 : null,
        shapeEnd: shape ? Math.max(0, shape.length / 2 - 1) : null,
        baseWeight,
        effectiveWeight,
        isTransfer: false,
      };

      const key = `${edge.from}:${edge.to}:${edge.routeId}`;
      const existing = edgeMap.get(key);
      if (!existing || edge.effectiveWeight < existing.effectiveWeight) {
        edgeMap.set(key, edge);
      }
    }
  }

  for (const transfer of data.transfers) {
    const fromIdx = stopIndex[transfer.from_stop_id];
    const toIdx = stopIndex[transfer.to_stop_id];
    if (fromIdx === undefined || toIdx === undefined) {
      continue;
    }

    const weight = Number(transfer.min_transfer_time || transferPenalty * 60) / 60;
    const edge: GraphEdge = {
      from: fromIdx,
      to: toIdx,
      routeId: null,
      shapeId: null,
      shapeStart: null,
      shapeEnd: null,
      baseWeight: weight,
      effectiveWeight: weight,
      isTransfer: true,
    };

    edgeMap.set(`${edge.from}:${edge.to}:transfer`, edge);
  }

  const graph: GraphData = {
    edges: Array.from(edgeMap.values()),
    stopIndex,
  };

  const bbox = computeBbox(stops);

  return { stops, routes, shapes, graph, bbox };
}

export async function writeProcessedArtifacts(
  outputDir: string,
  output: BuildOutput,
  version = Date.now().toString(),
): Promise<Manifest> {
  await mkdir(outputDir, { recursive: true });

  const stopsName = writeHashed(outputDir, 'stops', output.stops);
  const routesName = writeHashed(outputDir, 'routes', output.routes);
  const shapesName = writeHashed(outputDir, 'shapes', output.shapes);
  const graphName = writeHashed(outputDir, 'graph', output.graph);

  const [stopsFile, routesFile, shapesFile, graphFile] = await Promise.all([
    stopsName,
    routesName,
    shapesName,
    graphName,
  ]);

  const manifest: Manifest = {
    version,
    generatedAt: new Date().toISOString(),
    files: {
      stops: `/transit/${stopsFile}`,
      routes: `/transit/${routesFile}`,
      shapes: `/transit/${shapesFile}`,
      graph: `/transit/${graphFile}`,
    },
    bbox: output.bbox,
    stopCount: output.stops.length,
    routeCount: output.routes.length,
  };

  await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest));

  return manifest;
}

async function writeHashed(outputDir: string, logicalName: string, payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 10);
  const filename = `${logicalName}.${hash}.min.json`;
  await writeFile(path.join(outputDir, filename), json);
  return filename;
}

function buildShapesMap(shapeRows: CsvRow[]): ShapesMap {
  const grouped = groupBy(shapeRows, 'shape_id');
  const result: ShapesMap = {};

  for (const [shapeId, rows] of grouped.entries()) {
    const ordered = [...rows].sort(
      (a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence),
    );

    const flat: number[] = [];
    for (const row of ordered) {
      const lat = Number(row.shape_pt_lat);
      const lon = Number(row.shape_pt_lon);
      const projected = projectEquirectangularMeters(lat, lon);
      flat.push(projected.x, projected.y);
    }
    result[shapeId] = flat;
  }

  return result;
}

function buildRouteTripCounts(trips: CsvRow[], serviceId?: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const trip of trips) {
    if (serviceId && trip.service_id !== serviceId) {
      continue;
    }
    counts[trip.route_id] = (counts[trip.route_id] ?? 0) + 1;
  }
  return counts;
}

async function readCsv(filePath: string): Promise<CsvRow[]> {
  const raw = await readFile(filePath, 'utf8');
  return parseCsv(raw);
}

async function readCsvIfExists(filePath: string): Promise<CsvRow[]> {
  try {
    return await readCsv(filePath);
  } catch {
    return [];
  }
}

export function parseCsv(raw: string): CsvRow[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function groupBy(rows: CsvRow[], key: string): Map<string, CsvRow[]> {
  const map = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const groupKey = row[key];
    if (!groupKey) {
      continue;
    }
    const items = map.get(groupKey) ?? [];
    items.push(row);
    map.set(groupKey, items);
  }
  return map;
}

function distanceBetween(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
): number {
  if (!a || !b) {
    return 100;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function computeBbox(stops: StopRecord[]): [number, number, number, number] {
  const lats = stops.map((stop) => stop.lat);
  const lons = stops.map((stop) => stop.lon);

  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ];
}

function normalizeColor(input: string | undefined, fallback: string): string {
  const value = (input ?? '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(value)) {
    return fallback;
  }
  return value.toUpperCase();
}
