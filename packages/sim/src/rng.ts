/** Unsigned 32-bit state, kept as a number so it serializes with the rest of a game's State. */
export type RngState = number;

const UINT32_RANGE = 2 ** 32;

export function seedRng(seed: number): RngState {
  return seed >>> 0;
}

/** Returns a float in [0, 1) and the state to use next (mulberry32). */
export function nextFloat(rng: RngState): readonly [number, RngState] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(next ^ (next >>> 15), next | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return [((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE, next];
}

/** Returns an integer in [min, max], both ends included, and the state to use next. */
export function nextInt(rng: RngState, min: number, max: number): readonly [number, RngState] {
  const [value, next] = nextFloat(rng);
  return [min + Math.floor(value * (max - min + 1)), next];
}
