import { useEffect, useRef } from 'preact/hooks';

/** Runs the callback every animation frame with the time since the previous frame. */
export function useFrameLoop(onFrame: (elapsedMs: number) => void): void {
  const latest = useRef(onFrame);
  latest.current = onFrame;

  useEffect(() => {
    let frameId = 0;
    let previousMs = performance.now();
    const tick = (nowMs: number): void => {
      latest.current(nowMs - previousMs);
      previousMs = nowMs;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);
}
