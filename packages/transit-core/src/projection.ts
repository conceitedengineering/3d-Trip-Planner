const EARTH_RADIUS_METERS = 6371000;

export const SF_ORIGIN: [number, number] = [37.7749, -122.4194];

export interface ProjectedPoint {
  x: number;
  y: number;
}

export function projectEquirectangularMeters(
  lat: number,
  lon: number,
  origin: [number, number] = SF_ORIGIN,
): ProjectedPoint {
  const latRad = toRad(lat);
  const lonRad = toRad(lon);
  const lat0Rad = toRad(origin[0]);
  const lon0Rad = toRad(origin[1]);

  const x = (lonRad - lon0Rad) * Math.cos((latRad + lat0Rad) / 2) * EARTH_RADIUS_METERS;
  const y = (latRad - lat0Rad) * EARTH_RADIUS_METERS;

  return { x, y };
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}
