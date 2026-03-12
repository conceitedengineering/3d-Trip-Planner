import type { RenderProfile } from '@packages/transit-core';

const MOBILE_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function selectRenderProfile(): RenderProfile {
  const ua = navigator.userAgent;
  const isMobileUA = MOBILE_PATTERN.test(ua);

  if (isMobileUA) {
    return 'PERFORMANCE';
  }

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === 'number') {
    return memory > 4 ? 'QUALITY' : 'PERFORMANCE';
  }

  return 'QUALITY';
}
