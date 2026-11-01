import { useEffect, useRef } from 'preact/hooks';

/** The room still works without the scene, so a machine with no WebGL just sees the background. */
export function SceneCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isUnmounted = false;
    let unmountScene: (() => void) | undefined;

    async function mount(): Promise<void> {
      const { mountPlaceholderScene } = await import('../scene/placeholderScene');
      if (isUnmounted || !canvas.current) return;
      unmountScene = mountPlaceholderScene(canvas.current);
    }

    mount().catch((error: unknown) => console.warn('Scene unavailable', error));
    return () => {
      isUnmounted = true;
      unmountScene?.();
    };
  }, []);

  return <canvas ref={canvas} class="scene-canvas" aria-hidden="true" />;
}
