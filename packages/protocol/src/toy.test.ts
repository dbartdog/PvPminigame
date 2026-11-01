import { describe, expect, it } from 'vitest';
import {
  decodeToyInput,
  decodeToySnapshot,
  encodeToyInput,
  encodeToySnapshot,
  type ToySnapshot,
} from './toy';

const dots: ToySnapshot['dots'] = [
  { x: 0, y: 128, score: 3 },
  { x: 256, y: 12, score: 100 },
];

describe('toy input', () => {
  it('round trips every valid axis pair', () => {
    for (const x of [-1, 0, 1] as const) {
      for (const y of [-1, 0, 1] as const) {
        expect(decodeToyInput(encodeToyInput({ x, y }))).toEqual({ x, y });
      }
    }
  });

  it('is 2 bytes of int8', () => {
    expect([...encodeToyInput({ x: -1, y: 1 })]).toEqual([0xff, 1]);
  });

  it.each([
    ['a value above 1', [2, 0]],
    ['a value below -1', [0, 0xfe]],
    ['a huge value', [127, 127]],
    ['too few bytes', [1]],
    ['no bytes', []],
    ['too many bytes', [1, 1, 1]],
  ])('rejects %s', (_name, bytes) => {
    expect(decodeToyInput(Uint8Array.from(bytes))).toBeNull();
  });
});

describe('toy snapshot', () => {
  it('round trips with a pickup', () => {
    const snapshot: ToySnapshot = { dots, pickup: { x: 200, y: 9 } };
    expect(decodeToySnapshot(encodeToySnapshot(snapshot))).toEqual(snapshot);
  });

  it('round trips without a pickup', () => {
    const snapshot: ToySnapshot = { dots, pickup: null };
    expect(decodeToySnapshot(encodeToySnapshot(snapshot))).toEqual(snapshot);
  });

  it('leaves out server-only state', () => {
    const state = { dots, pickup: null, pickupRespawnTick: 5, rng: 99 };
    expect(decodeToySnapshot(encodeToySnapshot(state))).toEqual({ dots, pickup: null });
  });

  it('rejects truncated and extended payloads', () => {
    const bytes = encodeToySnapshot({ dots, pickup: { x: 1, y: 2 } });
    for (let length = 0; length < bytes.length; length++) {
      expect(decodeToySnapshot(bytes.subarray(0, length))).toBeNull();
    }
    expect(decodeToySnapshot(Uint8Array.from([...bytes, 0]))).toBeNull();
  });
});
