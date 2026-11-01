import { MessageType } from '@pvp/protocol';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, type ChaosProfile } from './profile';
import {
  createSeededRandom,
  isDroppable,
  messageTypeOf,
  sampleDelayMs,
  shapeFrame,
  type RandomSource,
} from './shaper';

const FRAMES = 100_000;
/** One snapshot at 30 Hz, wider than the default jitter range so frames rarely queue. */
const FRAME_SPACING_MS = 1000 / 30;

function shapeStream(
  messageType: number,
  profile: ChaosProfile,
  random: RandomSource,
  spacingMs = FRAME_SPACING_MS,
): { sentAtMs: number; releaseAtMs: number | null }[] {
  const frames: { sentAtMs: number; releaseAtMs: number | null }[] = [];
  let lastReleaseAtMs = 0;
  for (let i = 0; i < FRAMES; i++) {
    const sentAtMs = i * spacingMs;
    const shaped = shapeFrame(messageType, sentAtMs, lastReleaseAtMs, profile, random);
    lastReleaseAtMs = shaped.lastReleaseAtMs;
    frames.push({ sentAtMs, releaseAtMs: shaped.releaseAtMs });
  }
  return frames;
}

describe('which frames can be dropped', () => {
  it.each([MessageType.Input, MessageType.Snapshot, MessageType.Ping, MessageType.Pong])(
    'allows message type %i',
    (type) => expect(isDroppable(type)).toBe(true),
  );

  it.each([
    MessageType.Hello,
    MessageType.Welcome,
    MessageType.JoinRoom,
    MessageType.RoomState,
    MessageType.Error,
  ])('protects message type %i', (type) => expect(isDroppable(type)).toBe(false));

  it('protects frames that are not protocol messages', () => {
    expect(isDroppable(null)).toBe(false);
    expect(messageTypeOf(new Uint8Array([MessageType.Ping]), false)).toBeNull();
    expect(messageTypeOf(new Uint8Array(), true)).toBeNull();
  });

  it('reads the type from the first byte of a binary frame', () => {
    expect(messageTypeOf(new Uint8Array([MessageType.Snapshot, 9]), true)).toBe(
      MessageType.Snapshot,
    );
  });

  it('never drops a protected frame, even at 100% loss', () => {
    const profile = { ...DEFAULT_PROFILE, lossRate: 1 };
    const frames = shapeStream(MessageType.RoomState, profile, createSeededRandom(1));
    expect(frames.every((frame) => frame.releaseAtMs !== null)).toBe(true);
  });

  it('drops every droppable frame at 100% loss', () => {
    const profile = { ...DEFAULT_PROFILE, lossRate: 1 };
    const frames = shapeStream(MessageType.Snapshot, profile, createSeededRandom(1));
    expect(frames.every((frame) => frame.releaseAtMs === null)).toBe(true);
  });
});

describe('delay', () => {
  it('stays inside the jitter range', () => {
    const random = createSeededRandom(2);
    for (let i = 0; i < FRAMES; i++) {
      const delay = sampleDelayMs(DEFAULT_PROFILE, random);
      expect(delay).toBeGreaterThanOrEqual(40);
      expect(delay).toBeLessThanOrEqual(60);
    }
  });

  it('reaches both ends of the jitter range', () => {
    expect(sampleDelayMs(DEFAULT_PROFILE, () => 0)).toBe(40);
    expect(sampleDelayMs(DEFAULT_PROFILE, () => 0.9999999)).toBeCloseTo(60, 3);
  });

  it('never goes negative when jitter is larger than latency', () => {
    expect(sampleDelayMs({ ...DEFAULT_PROFILE, latencyMs: 5, jitterMs: 20 }, () => 0)).toBe(0);
  });
});

describe('a full stream on the default profile', () => {
  const frames = shapeStream(MessageType.Snapshot, DEFAULT_PROFILE, createSeededRandom(3));
  const delivered = frames.flatMap(({ sentAtMs, releaseAtMs }) =>
    releaseAtMs === null ? [] : [{ sentAtMs, releaseAtMs }],
  );

  it('loses about 2% of frames', () => {
    const lossRate = 1 - delivered.length / frames.length;
    expect(lossRate).toBeGreaterThan(0.018);
    expect(lossRate).toBeLessThan(0.022);
  });

  it('adds about 50 ms each way on average', () => {
    const totalDelay = delivered.reduce(
      (sum, { sentAtMs, releaseAtMs }) => sum + releaseAtMs - sentAtMs,
      0,
    );
    const meanDelay = totalDelay / delivered.length;
    expect(meanDelay).toBeGreaterThan(49);
    expect(meanDelay).toBeLessThan(52);
  });

  it('keeps frames in order, however large the jitter', () => {
    const profile = { latencyMs: 100, jitterMs: 100, lossRate: 0.02 };
    const releases = shapeStream(MessageType.Input, profile, createSeededRandom(4), 2)
      .map((frame) => frame.releaseAtMs)
      .filter((releaseAtMs) => releaseAtMs !== null);
    let inOrder = true;
    releases.reduce((previous, current) => {
      inOrder &&= current >= previous;
      return current;
    }, 0);
    expect(inOrder).toBe(true);
  });

  it('holds a frame back rather than letting it pass the one ahead', () => {
    const slow = shapeFrame(null, 0, 0, { ...DEFAULT_PROFILE, latencyMs: 500 }, () => 0.5);
    const fast = shapeFrame(
      null,
      1,
      slow.lastReleaseAtMs,
      { ...DEFAULT_PROFILE, latencyMs: 10 },
      () => 0.5,
    );
    expect(fast.releaseAtMs).toBe(slow.releaseAtMs);
  });

  it('repeats exactly for the same seed', () => {
    const repeat = shapeStream(MessageType.Snapshot, DEFAULT_PROFILE, createSeededRandom(3));
    expect(repeat).toEqual(frames);
  });
});
