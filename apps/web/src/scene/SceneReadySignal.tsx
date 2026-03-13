import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function SceneReadySignal(): null {
  const firedRef = useRef(false);

  useFrame(() => {
    if (firedRef.current) {
      return;
    }

    firedRef.current = true;
    window.dispatchEvent(new CustomEvent('scene:ready'));
  });

  return null;
}
