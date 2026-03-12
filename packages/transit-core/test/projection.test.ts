import { describe, expect, it } from 'vitest';
import { SF_ORIGIN, projectEquirectangularMeters } from '../src/projection';

describe('projectEquirectangularMeters', () => {
  it('returns origin as zero vector', () => {
    const p = projectEquirectangularMeters(SF_ORIGIN[0], SF_ORIGIN[1]);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });

  it('projects points in meters', () => {
    const p = projectEquirectangularMeters(37.7849, -122.4094);
    expect(p.x).toBeGreaterThan(800);
    expect(p.y).toBeGreaterThan(1000);
  });
});
