import { nextInt, seedRng, type RngState } from './rng';
import type { PlayerInputs, Sim, Winner } from './sim';

export type Axis = -1 | 0 | 1;

export interface ToyInput {
  readonly x: Axis;
  readonly y: Axis;
}

export interface Dot {
  readonly x: number;
  readonly y: number;
  readonly score: number;
}

export interface ToyState {
  readonly dots: readonly [Dot, Dot];
  readonly pickup: { readonly x: number; readonly y: number } | null;
  readonly pickupRespawnTick: number;
  readonly rng: RngState;
}

export const TOY_ARENA_SIZE = 256;
export const TOY_WIN_SCORE = 100;
export const TOY_PICKUP_RESPAWN_TICKS = 30;

const DOT_SPEED = 2;
const PICKUP_REACH = 4;

function clampToArena(value: number): number {
  return Math.min(TOY_ARENA_SIZE, Math.max(0, value));
}

function moveDot(dot: Dot, input: ToyInput): Dot {
  return {
    ...dot,
    x: clampToArena(dot.x + input.x * DOT_SPEED),
    y: clampToArena(dot.y + input.y * DOT_SPEED),
  };
}

function reaches(dot: Dot, pickup: NonNullable<ToyState['pickup']>): boolean {
  return Math.abs(dot.x - pickup.x) <= PICKUP_REACH && Math.abs(dot.y - pickup.y) <= PICKUP_REACH;
}

function spawnPickup(state: ToyState): ToyState {
  const [x, afterX] = nextInt(state.rng, 0, TOY_ARENA_SIZE);
  const [y, afterY] = nextInt(afterX, 0, TOY_ARENA_SIZE);
  return { ...state, pickup: { x, y }, rng: afterY };
}

/** Both dots score on a shared touch, so neither player is favoured by array order. */
function collectPickup(state: ToyState, tick: number): ToyState {
  const { pickup, dots } = state;
  if (!pickup) return state;
  const [first, second] = dots;
  const firstReaches = reaches(first, pickup);
  const secondReaches = reaches(second, pickup);
  if (!firstReaches && !secondReaches) return state;
  return {
    ...state,
    dots: [
      firstReaches ? { ...first, score: first.score + 1 } : first,
      secondReaches ? { ...second, score: second.score + 1 } : second,
    ],
    pickup: null,
    pickupRespawnTick: tick + TOY_PICKUP_RESPAWN_TICKS,
  };
}

function init(seed: number): ToyState {
  const dot = { y: TOY_ARENA_SIZE / 2, score: 0 };
  return spawnPickup({
    dots: [
      { ...dot, x: 0 },
      { ...dot, x: TOY_ARENA_SIZE },
    ],
    pickup: null,
    pickupRespawnTick: 0,
    rng: seedRng(seed),
  });
}

function isOver(state: ToyState): Winner | null {
  const [first, second] = state.dots;
  const firstWon = first.score >= TOY_WIN_SCORE;
  const secondWon = second.score >= TOY_WIN_SCORE;
  if (firstWon && secondWon) return 'draw';
  if (firstWon) return 0;
  if (secondWon) return 1;
  return null;
}

function step(state: ToyState, inputs: PlayerInputs<ToyInput>, tick: number): ToyState {
  if (isOver(state) !== null) return state;
  const moved: ToyState = {
    ...state,
    dots: [moveDot(state.dots[0], inputs[0]), moveDot(state.dots[1], inputs[1])],
  };
  const collected = collectPickup(moved, tick);
  const isRespawnDue = collected.pickup === null && tick >= collected.pickupRespawnTick;
  return isRespawnDue ? spawnPickup(collected) : collected;
}

/** Two dots racing for pickups. Exercises the Sim contract until real games exist. */
export const toySim: Sim<ToyState, ToyInput> = { init, step, isOver };
