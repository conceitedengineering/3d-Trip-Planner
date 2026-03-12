import { describe, expect, it } from 'vitest';
import {
  applyFrequencyWeight,
  computeFrequencyMultiplier,
  computeFrequencyNorm,
} from '../src/frequency';

describe('frequency weighting', () => {
  it('normalizes trips using log scale', () => {
    expect(computeFrequencyNorm(0, 100)).toBeCloseTo(0);
    expect(computeFrequencyNorm(100, 100)).toBeCloseTo(1);
  });

  it('handles invalid max trip counts', () => {
    expect(computeFrequencyNorm(15, 0)).toBe(0);
  });

  it('clamps multiplier to bounds', () => {
    expect(computeFrequencyMultiplier(0)).toBeCloseTo(1);
    expect(computeFrequencyMultiplier(1)).toBeCloseTo(0.65);
    expect(computeFrequencyMultiplier(100)).toBeCloseTo(0.65);
  });

  it('applies multiplier to weight', () => {
    expect(applyFrequencyWeight(100, 0.75)).toBe(75);
  });
});
