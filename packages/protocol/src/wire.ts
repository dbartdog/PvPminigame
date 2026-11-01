const INITIAL_CAPACITY = 64;
const MAX_U16 = 0xffff;
const LITTLE_ENDIAN = true;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export interface Writer {
  u8(value: number): void;
  u16(value: number): void;
  u32(value: number): void;
  f64(value: number): void;
  string(value: string): void;
  bytes(value: Uint8Array): void;
  finish(): Uint8Array;
}

export interface Reader {
  u8(): number;
  u16(): number;
  u32(): number;
  f64(): number;
  string(): string;
  rest(): Uint8Array;
  isDone(): boolean;
}

export function createWriter(): Writer {
  let bytes = new Uint8Array(INITIAL_CAPACITY);
  let view = new DataView(bytes.buffer);
  let offset = 0;

  /** Call this before touching bytes or view: growing replaces both. */
  function reserve(size: number): number {
    const start = offset;
    offset += size;
    if (offset > bytes.length) {
      const grown = new Uint8Array(Math.max(offset, bytes.length * 2));
      grown.set(bytes);
      bytes = grown;
      view = new DataView(bytes.buffer);
    }
    return start;
  }

  function writeBytes(value: Uint8Array): void {
    const start = reserve(value.length);
    bytes.set(value, start);
  }

  function writeU16(value: number): void {
    const start = reserve(2);
    view.setUint16(start, value, LITTLE_ENDIAN);
  }

  return {
    u8(value) {
      const start = reserve(1);
      view.setUint8(start, value);
    },
    u16: writeU16,
    u32(value) {
      const start = reserve(4);
      view.setUint32(start, value, LITTLE_ENDIAN);
    },
    f64(value) {
      const start = reserve(8);
      view.setFloat64(start, value, LITTLE_ENDIAN);
    },
    string(value) {
      const encoded = textEncoder.encode(value);
      if (encoded.length > MAX_U16) throw new RangeError('String is too long to encode');
      writeU16(encoded.length);
      writeBytes(encoded);
    },
    bytes: writeBytes,
    finish: () => bytes.slice(0, offset),
  };
}

/** Every read throws on truncated or invalid data; decodeMessage turns that into an Error. */
export function createReader(bytes: Uint8Array): Reader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  function advance(size: number): number {
    const start = offset;
    if (start + size > bytes.length) throw new RangeError('Message ended early');
    offset += size;
    return start;
  }

  function readU16(): number {
    return view.getUint16(advance(2), LITTLE_ENDIAN);
  }

  return {
    u8: () => view.getUint8(advance(1)),
    u16: readU16,
    u32: () => view.getUint32(advance(4), LITTLE_ENDIAN),
    f64: () => view.getFloat64(advance(8), LITTLE_ENDIAN),
    string() {
      const length = readU16();
      const start = advance(length);
      return textDecoder.decode(bytes.subarray(start, start + length));
    },
    // A copy, because uWebSockets.js reuses its buffer once the message callback returns.
    rest() {
      const start = advance(bytes.length - offset);
      return bytes.slice(start);
    },
    isDone: () => offset === bytes.length,
  };
}
