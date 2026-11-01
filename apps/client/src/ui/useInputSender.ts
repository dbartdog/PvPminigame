import { encodeToyInput } from '@pvp/protocol';
import { TICK_RATE_HZ, advanceTimestep, createTimestep } from '@pvp/sim';
import { useEffect, useRef } from 'preact/hooks';
import { toyInputFromKeys } from '../input/toyInput';
import type { Connection } from '../net/connection';
import { useFrameLoop } from './useFrameLoop';

function useHeldKeys(): ReadonlySet<string> {
  const held = useRef(new Set<string>());

  useEffect(() => {
    const keys = held.current;
    const press = (event: KeyboardEvent): void => void keys.add(event.code);
    const release = (event: KeyboardEvent): void => void keys.delete(event.code);
    const releaseAll = (): void => keys.clear();
    window.addEventListener('keydown', press);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', press);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', releaseAll);
    };
  }, []);

  return held.current;
}

/** One input per frame at most, so a stalled tab doesn't send a burst of repeats when it wakes. */
export function useInputSender(connection: Connection): void {
  const held = useHeldKeys();
  const timestep = useRef(createTimestep(TICK_RATE_HZ));

  useFrameLoop((elapsedMs) => {
    const advance = advanceTimestep(timestep.current, elapsedMs);
    timestep.current = advance.timestep;
    if (advance.steps === 0) return;
    const payload = encodeToyInput(toyInputFromKeys(held));
    connection.sendInput(connection.getState().tick ?? 0, payload);
  });
}
