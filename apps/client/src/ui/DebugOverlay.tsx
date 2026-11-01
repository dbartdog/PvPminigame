import { useRef, useState } from 'preact/hooks';
import type { Connection } from '../net/connection';
import { ownPlayer, snapshotAgeMs } from '../net/connectionState';
import { formatMs, summarizeFrames, type FrameStats } from './frameStats';
import { useFrameLoop } from './useFrameLoop';

const REFRESH_MS = 250;

interface OverlayValues extends FrameStats {
  readonly rttMs: number | null;
  readonly tick: number | null;
  readonly snapshotAgeMs: number | null;
}

function readValues(connection: Connection, durationsMs: readonly number[]): OverlayValues {
  const state = connection.getState();
  return {
    ...summarizeFrames(durationsMs),
    rttMs: ownPlayer(state)?.rttMs ?? null,
    tick: state.tick,
    snapshotAgeMs: snapshotAgeMs(state, performance.now()),
  };
}

export function DebugOverlay({ connection }: { connection: Connection }) {
  const [values, setValues] = useState<OverlayValues | null>(null);
  const durationsMs = useRef<number[]>([]);
  const sinceRefreshMs = useRef(0);

  useFrameLoop((elapsedMs) => {
    durationsMs.current.push(elapsedMs);
    sinceRefreshMs.current += elapsedMs;
    if (sinceRefreshMs.current < REFRESH_MS) return;
    setValues(readValues(connection, durationsMs.current));
    durationsMs.current = [];
    sinceRefreshMs.current = 0;
  });

  return (
    <dl class="debug-overlay" aria-label="Debug stats">
      <dt>FPS</dt>
      <dd data-stat="fps">{values ? Math.round(values.fps) : '–'}</dd>
      <dt>Frame</dt>
      <dd data-stat="frame">{values ? `${values.frameMs.toFixed(1)} ms` : '–'}</dd>
      <dt>RTT</dt>
      <dd data-stat="rtt">{formatMs(values?.rttMs ?? null)}</dd>
      <dt>Tick</dt>
      <dd data-stat="tick">{values?.tick ?? '–'}</dd>
      <dt>Snapshot</dt>
      <dd data-stat="snapshot">{formatMs(values?.snapshotAgeMs ?? null)}</dd>
    </dl>
  );
}
