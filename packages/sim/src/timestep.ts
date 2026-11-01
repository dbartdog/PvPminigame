export interface FixedTimestep {
  readonly stepMs: number;
  readonly maxSteps: number;
  readonly carryMs: number;
}

export interface TimestepAdvance {
  readonly timestep: FixedTimestep;
  readonly steps: number;
}

const DEFAULT_MAX_STEPS = 12;

export function createTimestep(hz: number, maxSteps = DEFAULT_MAX_STEPS): FixedTimestep {
  return { stepMs: 1000 / hz, maxSteps, carryMs: 0 };
}

/**
 * Turns elapsed time into a whole number of ticks to run. The caller measures elapsedMs, which
 * keeps the wall clock out of this package. After a long stall the backlog is dropped rather than
 * replayed, because catching up would make the next advance slower still.
 */
export function advanceTimestep(timestep: FixedTimestep, elapsedMs: number): TimestepAdvance {
  const availableMs = timestep.carryMs + Math.max(0, elapsedMs);
  const steps = Math.floor(availableMs / timestep.stepMs);
  if (steps > timestep.maxSteps) {
    return { timestep: { ...timestep, carryMs: 0 }, steps: timestep.maxSteps };
  }
  return { timestep: { ...timestep, carryMs: availableMs - steps * timestep.stepMs }, steps };
}
