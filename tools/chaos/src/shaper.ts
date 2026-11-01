import { MessageType } from '@pvp/protocol';
import { nextFloat, seedRng } from '@pvp/sim';
import type { ChaosProfile } from './profile';

/** Returns a float in [0, 1). */
export type RandomSource = () => number;

export interface ShapedFrame {
  /** When to deliver the frame, or null if it was lost. */
  readonly releaseAtMs: number | null;
  /** Pass this back in for the next frame in the same direction. */
  readonly lastReleaseAtMs: number;
}

const DROPPABLE_TYPES: ReadonlySet<number> = new Set([
  MessageType.Input,
  MessageType.Snapshot,
  MessageType.Ping,
  MessageType.Pong,
]);

export function createSeededRandom(seed: number): RandomSource {
  let rng = seedRng(seed);
  return () => {
    const [value, next] = nextFloat(rng);
    rng = next;
    return value;
  };
}

/** Returns null for a frame that isn't a protocol message, which must never be dropped. */
export function messageTypeOf(data: Uint8Array, isBinary: boolean): number | null {
  return isBinary ? (data[0] ?? null) : null;
}

export function isDroppable(messageType: number | null): boolean {
  return messageType !== null && DROPPABLE_TYPES.has(messageType);
}

export function sampleDelayMs(profile: ChaosProfile, random: RandomSource): number {
  const offset = (random() * 2 - 1) * profile.jitterMs;
  return Math.max(0, profile.latencyMs + offset);
}

/**
 * Decides one frame's fate. A frame is never released before the one sent ahead of it, because
 * WebSocket runs on TCP and netcode built against reordered frames would be testing the wrong thing.
 */
export function shapeFrame(
  messageType: number | null,
  nowMs: number,
  lastReleaseAtMs: number,
  profile: ChaosProfile,
  random: RandomSource,
): ShapedFrame {
  if (isDroppable(messageType) && random() < profile.lossRate) {
    return { releaseAtMs: null, lastReleaseAtMs };
  }
  const releaseAtMs = Math.max(nowMs + sampleDelayMs(profile, random), lastReleaseAtMs);
  return { releaseAtMs, lastReleaseAtMs: releaseAtMs };
}
