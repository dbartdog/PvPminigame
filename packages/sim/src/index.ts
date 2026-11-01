export const TICK_RATE_HZ = 60;
export const SNAPSHOT_RATE_HZ = 30;

export { hashState } from './hash';
export { nextFloat, nextInt, seedRng, type RngState } from './rng';
export type { PlayerIndex, PlayerInputs, Sim, Winner } from './sim';
export { advanceTimestep, createTimestep, type FixedTimestep } from './timestep';
export {
  TOY_ARENA_SIZE,
  TOY_WIN_SCORE,
  toySim,
  type Axis,
  type Dot,
  type ToyInput,
  type ToyState,
} from './toy';
