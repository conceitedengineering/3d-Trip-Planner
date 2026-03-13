import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  applyFrequencyWeight,
  type BuildingsData,
  type BuildingRecord,
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

interface GeoJsonFeatureCollection {
  features: GeoJsonFeature[];
  type: 'FeatureCollection';
}

interface GeoJsonFeature {
  geometry: {
    coordinates: unknown;
    type: 'Polygon' | 'MultiPolygon';
  } | null;
  properties: Record<string, unknown> | null;
  type: 'Feature';
}

interface BuildingCandidate {
  centroidX: number;
  centroidY: number;
  coords: number[];
  height: number;
  id: string;
  isLandmark: boolean;
  name: string | null;
}

interface BuildOptions {
  representativeServiceId?: string;
  transferPenaltyMinutes?: number;
}

const SIMPLIFY_VERTEX_EPSILON_METERS = 0.5;
const MIN_BUILDING_AREA_M2 = 10;

const LANDMARK_TARGETS: Array<{ count?: number; lat: number; lon: number; name: string }> = [
  { lat: 37.7952, lon: -122.4028, name: 'Transamerica Pyramid' },
  { lat: 37.7895, lon: -122.3973, name: 'Salesforce Tower' },
  { lat: 37.7793, lon: -122.4193, name: 'City Hall' },
  { lat: 37.7955, lon: -122.3937, name: 'Ferry Building' },
  { lat: 37.7679, lon: -122.3876, name: 'Chase Center' },
  { lat: 37.7786, lon: -122.3893, name: 'Oracle Park' },
  { lat: 37.7837, lon: -122.416, name: "St. Mary's Cathedral" },
  { lat: 37.7921, lon: -122.4163, name: 'Grace Cathedral' },
  { lat: 37.8024, lon: -122.4058, name: 'Coit Tower' },
  { count: 6, lat: 37.7762, lon: -122.4328, name: 'Painted Ladies' },
];

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

export async function loadBuildingsGeoJson(filePath: string): Promise<GeoJsonFeatureCollection> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as GeoJsonFeatureCollection;
}

export function buildBuildingsData(collection: GeoJsonFeatureCollection): BuildingsData {
  const candidates: BuildingCandidate[] = [];

  collection.features.forEach((feature, featureIndex) => {
    if (!feature.geometry) {
      return;
    }

    const polygons = extractOuterRings(feature.geometry);
    if (polygons.length === 0) {
      return;
    }

    const props = feature.properties ?? {};
    const baseId = resolveBuildingId(props, featureIndex);
    const resolvedName = resolveFeatureName(props);

    polygons.forEach((ring, ringIndex) => {
      const projected = simplifyFlatCoords(projectRingToMeters(ring), SIMPLIFY_VERTEX_EPSILON_METERS);
      if (projected.length < 6) {
        return;
      }

      const area = polygonArea(projected);
      if (area < MIN_BUILDING_AREA_M2) {
        return;
      }

      const centroid = polygonCentroid(projected);
      const height = resolveHeightMeters(props, area);
      const id = polygons.length > 1 ? `${baseId}_p${ringIndex}` : baseId;

      candidates.push({
        centroidX: centroid.x,
        centroidY: centroid.y,
        coords: projected,
        height,
        id,
        isLandmark: false,
        name: resolvedName,
      });
    });
  });

  applyLandmarkClassification(candidates);

  const buildings: BuildingRecord[] = candidates.map((candidate) => ({
    id: candidate.id,
    coords: candidate.coords,
    height: candidate.height,
    isLandmark: candidate.isLandmark,
  }));

  const landmarkIds = buildings.filter((building) => building.isLandmark).map((building) => building.id);

  return {
    buildings,
    landmarkIds,
    totalCount: buildings.length,
    landmarkCount: landmarkIds.length,
  };
}

export async function writeProcessedArtifacts(
  outputDir: string,
  output: BuildOutput,
  options: { buildings?: BuildingsData } = {},
  version = Date.now().toString(),
): Promise<Manifest> {
  await mkdir(outputDir, { recursive: true });

  const stopsName = writeHashed(outputDir, 'stops', output.stops);
  const routesName = writeHashed(outputDir, 'routes', output.routes);
  const shapesName = writeHashed(outputDir, 'shapes', output.shapes);
  const graphName = writeHashed(outputDir, 'graph', output.graph);

  const [stopsFile, routesFile, shapesFile, graphFile, buildingsFile] = await Promise.all([
    stopsName,
    routesName,
    shapesName,
    graphName,
    options.buildings ? writeHashed(outputDir, 'buildings', options.buildings) : Promise.resolve(null),
  ]);

  const manifest: Manifest = {
    version,
    generatedAt: new Date().toISOString(),
    files: {
      stops: `/transit/${stopsFile}`,
      routes: `/transit/${routesFile}`,
      shapes: `/transit/${shapesFile}`,
      graph: `/transit/${graphFile}`,
      ...(buildingsFile ? { buildings: `/transit/${buildingsFile}` } : {}),
    },
    bbox: output.bbox,
    stopCount: output.stops.length,
    routeCount: output.routes.length,
  };

  await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest));
  if (options.buildings) {
    await writeFile(path.join(outputDir, 'buildings.min.json'), JSON.stringify(options.buildings));
  }

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

function extractOuterRings(
  geometry: GeoJsonFeature['geometry'],
): number[][][] {
  if (!geometry) {
    return [];
  }

  if (geometry.type === 'Polygon') {
    const coordinates = geometry.coordinates as number[][][];
    return coordinates.length > 0 ? [coordinates[0]] : [];
  }

  if (geometry.type === 'MultiPolygon') {
    const coordinates = geometry.coordinates as number[][][][];
    return coordinates
      .map((polygon) => polygon[0])
      .filter((ring): ring is number[][] => Array.isArray(ring) && ring.length > 0);
  }

  return [];
}

function projectRingToMeters(ring: number[][]): number[] {
  const result: number[] = [];

  ring.forEach((point) => {
    if (!Array.isArray(point) || point.length < 2) {
      return;
    }

    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    const projected = projectEquirectangularMeters(lat, lon);
    result.push(projected.x, projected.y);
  });

  return result;
}

function simplifyFlatCoords(flat: number[], minDistance: number): number[] {
  if (flat.length < 6) {
    return flat;
  }

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }

  if (points.length >= 2 && distance(points[0], points[points.length - 1]) < minDistance) {
    points.pop();
  }

  const simplified: Array<{ x: number; y: number }> = [];
  points.forEach((point) => {
    const prev = simplified[simplified.length - 1];
    if (!prev || distance(prev, point) >= minDistance) {
      simplified.push(point);
    }
  });

  if (simplified.length >= 2 && distance(simplified[0], simplified[simplified.length - 1]) < minDistance) {
    simplified.pop();
  }

  if (simplified.length < 3) {
    return [];
  }

  return simplified.flatMap((point) => [point.x, point.y]);
}

function polygonArea(coords: number[]): number {
  const pointCount = coords.length / 2;
  if (pointCount < 3) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < pointCount; i += 1) {
    const j = (i + 1) % pointCount;
    const xi = coords[i * 2];
    const yi = coords[i * 2 + 1];
    const xj = coords[j * 2];
    const yj = coords[j * 2 + 1];
    sum += xi * yj - xj * yi;
  }

  return Math.abs(sum) / 2;
}

function polygonCentroid(coords: number[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  const pointCount = coords.length / 2;

  for (let i = 0; i < pointCount; i += 1) {
    x += coords[i * 2];
    y += coords[i * 2 + 1];
  }

  return {
    x: x / pointCount,
    y: y / pointCount,
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function resolveHeightMeters(props: Record<string, unknown>, area: number): number {
  const medianMeters = toPositiveNumber(props.hgt_median_m);
  if (medianMeters) {
    return medianMeters;
  }

  const meanCm = toPositiveNumber(props.hgt_meancm);
  if (meanCm) {
    return meanCm / 100;
  }

  if (area < 100) {
    return 4;
  }
  if (area <= 500) {
    return 7;
  }
  return 10.5;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function resolveBuildingId(props: Record<string, unknown>, fallbackIndex: number): string {
  const direct = [props.globalid, props.sf16_bldgid, props.area_id]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0);

  return direct ?? `building_${fallbackIndex}`;
}

function resolveFeatureName(props: Record<string, unknown>): string | null {
  const preferred = ['name', 'building_name', 'p2010_name'];

  for (const key of preferred) {
    const matchedKey = Object.keys(props).find((candidate) => candidate.toLowerCase() === key);
    if (!matchedKey) {
      continue;
    }

    const value = props[matchedKey];
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0 && normalized.toLowerCase() !== 'null') {
        return normalized;
      }
    }
  }

  const genericNameKey = Object.keys(props).find((candidate) => candidate.toLowerCase().includes('name'));
  if (genericNameKey) {
    const value = props[genericNameKey];
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0 && normalized.toLowerCase() !== 'null') {
        return normalized;
      }
    }
  }

  return null;
}

function applyLandmarkClassification(candidates: BuildingCandidate[]): void {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const used = new Set<string>();

  LANDMARK_TARGETS.forEach((target) => {
    const targetPoint = projectEquirectangularMeters(target.lat, target.lon);

    if (target.name === 'Painted Ladies') {
      const nearest = [...candidates]
        .sort((a, b) => {
          const da = squaredDistance(a.centroidX, a.centroidY, targetPoint.x, targetPoint.y);
          const db = squaredDistance(b.centroidX, b.centroidY, targetPoint.x, targetPoint.y);
          return da - db;
        })
        .slice(0, target.count ?? 1);

      nearest.forEach((candidate) => {
        candidate.isLandmark = true;
        used.add(candidate.id);
      });
      return;
    }

    const matchedByName = candidates.find((candidate) =>
      candidate.name?.toLowerCase().includes(target.name.toLowerCase()),
    );

    if (matchedByName) {
      matchedByName.isLandmark = true;
      used.add(matchedByName.id);
      return;
    }

    let nearest: BuildingCandidate | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (used.has(candidate.id)) {
        continue;
      }
      const d2 = squaredDistance(candidate.centroidX, candidate.centroidY, targetPoint.x, targetPoint.y);
      if (d2 < nearestDist) {
        nearest = candidate;
        nearestDist = d2;
      }
    }

    if (nearest) {
      const mutable = byId.get(nearest.id);
      if (mutable) {
        mutable.isLandmark = true;
      }
      used.add(nearest.id);
    }
  });
}

function squaredDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
