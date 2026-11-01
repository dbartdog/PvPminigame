export interface FrameStats {
  readonly fps: number;
  readonly frameMs: number;
}

export function summarizeFrames(durationsMs: readonly number[]): FrameStats {
  const totalMs = durationsMs.reduce((total, duration) => total + duration, 0);
  if (totalMs <= 0) return { fps: 0, frameMs: 0 };
  return { fps: (durationsMs.length * 1000) / totalMs, frameMs: totalMs / durationsMs.length };
}

export function formatMs(value: number | null): string {
  return value === null ? '–' : `${Math.round(value)} ms`;
}
