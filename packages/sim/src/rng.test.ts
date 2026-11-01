import { describe, expect, it } from 'vitest';
import { nextFloat, nextInt, seedRng, type RngState } from './rng';

function drawFloats(seed: number, count: number): number[] {
  const values: number[] = [];
  let rng: RngState = seedRng(seed);
  for (let i = 0; i < count; i++) {
    const [value, next] = nextFloat(rng);
    values.push(value);
    rng = next;
  }
  return values;
}

describe('seeded RNG', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(drawFloats(42, 100)).toEqual(drawFloats(42, 100));
  });

  it('gives a different sequence for a different seed', () => {
    expect(drawFloats(42, 100)).not.toEqual(drawFloats(43, 100));
  });

  it('keeps a known sequence, so a changed algorithm cannot slip through', () => {
    expect(drawFloats(1, 3)).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });

  it('stays in [0, 1)', () => {
    for (const value of drawFloats(7, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('reaches both ends of an integer range and nothing outside it', () => {
    const seen = new Set<number>();
    let rng: RngState = seedRng(7);
    for (let i = 0; i < 1_000; i++) {
      const [value, next] = nextInt(rng, 2, 6);
      seen.add(value);
      rng = next;
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5, 6]);
  });
});
