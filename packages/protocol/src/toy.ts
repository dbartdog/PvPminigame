import type { Axis, ToyInput, ToyState } from '@pvp/sim';
import { createReader, createWriter } from './wire';

/** What clients see of ToyState. The RNG stays on the server, so clients can't foresee pickups. */
export type ToySnapshot = Pick<ToyState, 'dots' | 'pickup'>;

const TOY_INPUT_BYTES = 2;

function axisToByte(axis: Axis): number {
  return axis & 0xff;
}

/** Returns null for anything but int8 -1, 0 or 1, because this byte comes from the client. */
function byteToAxis(byte: number | undefined): Axis | null {
  if (byte === 0xff) return -1;
  if (byte === 0 || byte === 1) return byte;
  return null;
}

export function encodeToyInput(input: ToyInput): Uint8Array {
  return Uint8Array.of(axisToByte(input.x), axisToByte(input.y));
}

/** Returns null unless the payload is exactly one valid input. */
export function decodeToyInput(payload: Uint8Array): ToyInput | null {
  if (payload.length !== TOY_INPUT_BYTES) return null;
  const x = byteToAxis(payload[0]);
  const y = byteToAxis(payload[1]);
  return x === null || y === null ? null : { x, y };
}

export function encodeToySnapshot(snapshot: ToySnapshot): Uint8Array {
  const writer = createWriter();
  for (const dot of snapshot.dots) {
    writer.u16(dot.x);
    writer.u16(dot.y);
    writer.u16(dot.score);
  }
  writer.u8(snapshot.pickup ? 1 : 0);
  if (snapshot.pickup) {
    writer.u16(snapshot.pickup.x);
    writer.u16(snapshot.pickup.y);
  }
  return writer.finish();
}

/** Returns null if the payload is truncated or has trailing bytes. */
export function decodeToySnapshot(payload: Uint8Array): ToySnapshot | null {
  const reader = createReader(payload);
  try {
    const first = { x: reader.u16(), y: reader.u16(), score: reader.u16() };
    const second = { x: reader.u16(), y: reader.u16(), score: reader.u16() };
    const pickup = reader.u8() === 1 ? { x: reader.u16(), y: reader.u16() } : null;
    return reader.isDone() ? { dots: [first, second], pickup } : null;
  } catch {
    return null;
  }
}
