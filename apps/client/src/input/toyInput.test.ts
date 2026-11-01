import { describe, expect, it } from 'vitest';
import { encodeToyInput, toyInputFromKeys } from './toyInput';

describe('toyInputFromKeys', () => {
  it('stands still with nothing pressed', () => {
    expect(toyInputFromKeys(new Set())).toEqual({ x: 0, y: 0 });
  });

  it('reads arrow keys and WASD', () => {
    expect(toyInputFromKeys(new Set(['ArrowRight', 'ArrowUp']))).toEqual({ x: 1, y: -1 });
    expect(toyInputFromKeys(new Set(['KeyA', 'KeyS']))).toEqual({ x: -1, y: 1 });
  });

  it('cancels out opposite keys', () => {
    expect(toyInputFromKeys(new Set(['ArrowLeft', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });
});

describe('encodeToyInput', () => {
  it('writes x then y as signed bytes', () => {
    expect([...encodeToyInput({ x: -1, y: 1 })]).toEqual([0xff, 1]);
  });
});
