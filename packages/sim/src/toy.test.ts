import { describe, expect, it } from 'vitest';
import { nextInt, seedRng, type RngState } from './rng';
import { hashState } from './hash';
import type { PlayerInputs } from './sim';
import {
  TOY_ARENA_SIZE,
  TOY_WIN_SCORE,
  toySim,
  type Axis,
  type ToyInput,
  type ToyState,
} from './toy';

const TICKS = 10_000;
const SEED = 12345;
const STILL: ToyInput = { x: 0, y: 0 };

function randomInput(rng: RngState): readonly [ToyInput, RngState] {
  const [x, afterX] = nextInt(rng, -1, 1);
  const [y, afterY] = nextInt(afterX, -1, 1);
  return [{ x: x as Axis, y: y as Axis }, afterY];
}

/** Inputs come from their own seed so they can vary independently of the sim's seed. */
function recordInputs(inputSeed: number, ticks: number): PlayerInputs<ToyInput>[] {
  const inputs: PlayerInputs<ToyInput>[] = [];
  let rng = seedRng(inputSeed);
  for (let i = 0; i < ticks; i++) {
    const [first, afterFirst] = randomInput(rng);
    const [second, afterSecond] = randomInput(afterFirst);
    inputs.push([first, second]);
    rng = afterSecond;
  }
  return inputs;
}

function replay(
  start: ToyState,
  inputs: readonly PlayerInputs<ToyInput>[],
  firstTick = 0,
): ToyState {
  return inputs.reduce(
    (state, tickInputs, i) => toySim.step(state, tickInputs, firstTick + i),
    start,
  );
}

function sign(value: number): Axis {
  return Math.sign(value) as Axis;
}

/** Steers player 0 at the pickup while player 1 stays put. */
function chaseInputs(state: ToyState): PlayerInputs<ToyInput> {
  const { pickup, dots } = state;
  if (!pickup) return [STILL, STILL];
  return [{ x: sign(pickup.x - dots[0].x), y: sign(pickup.y - dots[0].y) }, STILL];
}

describe('determinism', () => {
  const inputs = recordInputs(777, TICKS);

  it('gives identical hashes for two 10,000 tick runs with the same seed and inputs', () => {
    const first = replay(toySim.init(SEED), inputs);
    const second = replay(toySim.init(SEED), inputs);
    expect(hashState(first)).toBe(hashState(second));
  });

  it('matches on every tick, not only at the end', () => {
    let first = toySim.init(SEED);
    let second = toySim.init(SEED);
    inputs.forEach((tickInputs, tick) => {
      first = toySim.step(first, tickInputs, tick);
      second = toySim.step(second, tickInputs, tick);
      if (hashState(first) !== hashState(second)) {
        expect.fail(`Runs diverged at tick ${tick}`);
      }
    });
  });

  it('actually plays a game, so matching hashes mean something', () => {
    const [first, second] = replay(toySim.init(SEED), inputs).dots;
    expect(first.score + second.score).toBeGreaterThan(0);
  });

  it('gives a different result for a different seed', () => {
    expect(hashState(replay(toySim.init(SEED), inputs))).not.toBe(
      hashState(replay(toySim.init(SEED + 1), inputs)),
    );
  });

  it('gives a different result for different inputs', () => {
    const otherInputs = recordInputs(778, TICKS);
    expect(hashState(replay(toySim.init(SEED), inputs))).not.toBe(
      hashState(replay(toySim.init(SEED), otherInputs)),
    );
  });

  it('resumes from a serialized state, as reconciliation will', () => {
    const midpoint = TICKS / 2;
    const saved = replay(toySim.init(SEED), inputs.slice(0, midpoint));
    const restored = JSON.parse(JSON.stringify(saved)) as ToyState;
    const resumed = replay(restored, inputs.slice(midpoint), midpoint);
    expect(hashState(resumed)).toBe(hashState(replay(toySim.init(SEED), inputs)));
  });

  it('never changes the state it was given', () => {
    const state = toySim.init(SEED);
    const before = JSON.stringify(state);
    toySim.step(state, [{ x: 1, y: 1 }, STILL], 0);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('toy sim rules', () => {
  it('keeps dots inside the arena', () => {
    const pushOut: PlayerInputs<ToyInput> = [
      { x: -1, y: -1 },
      { x: 1, y: 1 },
    ];
    const state = replay(toySim.init(SEED), Array<PlayerInputs<ToyInput>>(500).fill(pushOut));
    expect(state.dots[0]).toMatchObject({ x: 0, y: 0 });
    expect(state.dots[1]).toMatchObject({ x: TOY_ARENA_SIZE, y: TOY_ARENA_SIZE });
  });

  it('declares a winner at the winning score, then stops changing', () => {
    let state = toySim.init(SEED);
    let tick = 0;
    while (toySim.isOver(state) === null && tick < TICKS * 2) {
      state = toySim.step(state, chaseInputs(state), tick);
      tick++;
    }
    expect(toySim.isOver(state)).toBe(0);
    expect(state.dots[0].score).toBe(TOY_WIN_SCORE);
    expect(toySim.step(state, [{ x: 1, y: 1 }, STILL], tick)).toBe(state);
  });

  it('calls a draw when both reach the winning score together', () => {
    const state = toySim.init(SEED);
    const scored = { ...state.dots[0], score: TOY_WIN_SCORE };
    expect(toySim.isOver({ ...state, dots: [scored, scored] })).toBe('draw');
  });

  it('has no winner at the start', () => {
    expect(toySim.isOver(toySim.init(SEED))).toBeNull();
  });
});
