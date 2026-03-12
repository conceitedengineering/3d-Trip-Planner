import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

interface InteractionHandlerProps {
  onCanvasMiss: () => void;
}

export function InteractionHandler({ onCanvasMiss }: InteractionHandlerProps): null {
  const { gl } = useThree();

  useEffect(() => {
    const handler = () => onCanvasMiss();
    gl.domElement.addEventListener('pointermissed', handler as EventListener);

    return () => {
      gl.domElement.removeEventListener('pointermissed', handler as EventListener);
    };
  }, [gl.domElement, onCanvasMiss]);

  return null;
}
