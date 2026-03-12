import type { RenderProfile } from '@packages/transit-core';

export interface RenderProfileConfig {
  bloom: boolean;
  ssao: boolean;
  antialias: boolean;
  fxaa: boolean;
  stopMarkerCap: number;
  resolutionScale: number;
}

export const RENDER_PROFILE_CONFIG: Record<RenderProfile, RenderProfileConfig> = {
  QUALITY: {
    bloom: true,
    ssao: true,
    antialias: true,
    fxaa: true,
    stopMarkerCap: 1000,
    resolutionScale: 1,
  },
  PERFORMANCE: {
    bloom: false,
    ssao: false,
    antialias: false,
    fxaa: true,
    stopMarkerCap: 300,
    resolutionScale: 0.75,
  },
};
