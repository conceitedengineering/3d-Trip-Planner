export function computeFrequencyNorm(tripsPerDay: number, maxTripsPerDay: number): number {
  if (maxTripsPerDay <= 0) {
    return 0;
  }
  return Math.log1p(Math.max(0, tripsPerDay)) / Math.log1p(maxTripsPerDay);
}

export function computeFrequencyMultiplier(freqNorm: number): number {
  const raw = 1 - 0.35 * freqNorm;
  return clamp(raw, 0.65, 1);
}

export function applyFrequencyWeight(baseWeight: number, freqMultiplier: number): number {
  return baseWeight * freqMultiplier;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
