import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from './codec';
import { ErrorCode, MessageType, PROTOCOL_VERSION, type Message } from './messages';

const payload = new Uint8Array([1, 2, 3, 250]);

const samples: readonly Message[] = [
  {
    type: MessageType.Hello,
    protocolVersion: PROTOCOL_VERSION,
    deviceToken: 'token.abc',
    name: 'Dot Müller 🎯',
  },
  { type: MessageType.Hello, protocolVersion: PROTOCOL_VERSION, deviceToken: '', name: '' },
  { type: MessageType.Welcome, playerId: 'player-1', deviceToken: 'token.abc' },
  { type: MessageType.JoinRoom, code: 'XK7P2M' },
  { type: MessageType.RoomState, code: 'XK7P2M', players: [] },
  {
    type: MessageType.RoomState,
    code: 'XK7P2M',
    players: [
      { playerId: 'player-1', name: 'Ada', rttMs: 42 },
      { playerId: 'player-2', name: 'Grace', rttMs: null },
    ],
  },
  { type: MessageType.Input, tick: 123456, payload },
  { type: MessageType.Input, tick: 0, payload: new Uint8Array() },
  { type: MessageType.Snapshot, tick: 0xffffffff, payload },
  { type: MessageType.Ping, timestampMs: 1793567398329.25 },
  { type: MessageType.Pong, timestampMs: 1793567398329.25 },
  { type: MessageType.Error, code: ErrorCode.RoomFull, message: 'This room is full.' },
];

const hello = samples[0] as Message;

function helloWithVersion(version: number): Uint8Array {
  const bytes = encodeMessage(hello);
  new DataView(bytes.buffer).setUint16(1, version, true);
  return bytes;
}

function hasPayload(message: Message): boolean {
  return message.type === MessageType.Input || message.type === MessageType.Snapshot;
}

function failureCode(data: Uint8Array): ErrorCode | undefined {
  const result = decodeMessage(data);
  return result.ok ? undefined : result.error.code;
}

describe('round trip', () => {
  it('has a sample for every message type', () => {
    const covered = new Set(samples.map((message) => message.type));
    expect([...covered].sort((a, b) => a - b)).toEqual(Object.values(MessageType));
  });

  it.each(samples.map((message) => [message.type, message] as const))(
    'decodes message type %i back to what was encoded',
    (_type, message) => {
      expect(decodeMessage(encodeMessage(message))).toEqual({ ok: true, message });
    },
  );

  it('handles messages larger than the initial write buffer', () => {
    const message: Message = {
      type: MessageType.Snapshot,
      tick: 1,
      payload: new Uint8Array(100_000).fill(7),
    };
    expect(decodeMessage(encodeMessage(message))).toEqual({ ok: true, message });
  });

  it('keeps every field intact wherever the write buffer happens to grow', () => {
    for (let length = 0; length < 300; length++) {
      const message: Message = {
        type: MessageType.RoomState,
        code: 'a'.repeat(length),
        players: [
          { playerId: 'p'.repeat(length), name: 'n', rttMs: 513 },
          { playerId: 'q', name: 'm', rttMs: 1027 },
        ],
      };
      expect(decodeMessage(encodeMessage(message))).toEqual({ ok: true, message });
    }
  });

  it('decodes a plain ArrayBuffer, as uWebSockets.js delivers', () => {
    const encoded = encodeMessage(hello);
    const buffer = encoded.buffer.slice(0, encoded.length) as ArrayBuffer;
    expect(decodeMessage(buffer)).toEqual({ ok: true, message: hello });
  });

  it('decodes a view that starts partway through its buffer', () => {
    const encoded = encodeMessage(hello);
    const padded = new Uint8Array(encoded.length + 8);
    padded.set(encoded, 5);
    const view = padded.subarray(5, 5 + encoded.length);
    expect(decodeMessage(view)).toEqual({ ok: true, message: hello });
  });

  it('copies payloads, so they survive the network buffer being reused', () => {
    const encoded = encodeMessage({ type: MessageType.Input, tick: 1, payload });
    const result = decodeMessage(encoded);
    encoded.fill(0);
    expect(result).toMatchObject({ ok: true, message: { payload } });
  });

  it('clamps an RTT too large for the wire instead of wrapping it', () => {
    const result = decodeMessage(
      encodeMessage({
        type: MessageType.RoomState,
        code: 'A',
        players: [{ playerId: 'p', name: 'n', rttMs: 1_000_000 }],
      }),
    );
    expect(result).toMatchObject({ ok: true, message: { players: [{ rttMs: 0xfffe }] } });
  });

  it('refuses to encode a string too long for its length prefix', () => {
    const message: Message = { type: MessageType.JoinRoom, code: 'a'.repeat(0x10000) };
    expect(() => encodeMessage(message)).toThrow(RangeError);
  });
});

describe('wire layout', () => {
  it('starts every message with its 1-byte type', () => {
    for (const message of samples) {
      expect(encodeMessage(message)[0]).toBe(message.type);
    }
  });

  it('keeps the protocol version right after the type byte in Hello', () => {
    const bytes = encodeMessage({ ...(hello as object), protocolVersion: 0x0102 } as Message);
    expect([...bytes.subarray(0, 3)]).toEqual([MessageType.Hello, 0x02, 0x01]);
  });
});

describe('version mismatch', () => {
  it.each([0, PROTOCOL_VERSION + 1, 0xffff])('returns a clear Error for version %i', (version) => {
    const result = decodeMessage(helloWithVersion(version));
    expect(result).toEqual({
      ok: false,
      error: {
        type: MessageType.Error,
        code: ErrorCode.VersionMismatch,
        message: `Version mismatch: got ${version}, expected ${PROTOCOL_VERSION}. Refresh the page to update.`,
      },
    });
  });

  it('reports the mismatch even when the rest of the Hello is in an unknown layout', () => {
    const bytes = new Uint8Array([MessageType.Hello, 99, 0, 0xff, 0xff, 0xff]);
    expect(failureCode(bytes)).toBe(ErrorCode.VersionMismatch);
  });

  it('produces an Error that can be sent straight back', () => {
    const result = decodeMessage(helloWithVersion(PROTOCOL_VERSION + 1));
    if (result.ok) expect.fail('Expected the decode to fail');
    expect(decodeMessage(encodeMessage(result.error))).toEqual({ ok: true, message: result.error });
  });
});

describe('bad input', () => {
  it('rejects an empty message', () => {
    expect(failureCode(new Uint8Array())).toBe(ErrorCode.MalformedMessage);
  });

  it('rejects an unknown message type', () => {
    expect(failureCode(new Uint8Array([200, 0, 0]))).toBe(ErrorCode.MalformedMessage);
  });

  it('rejects an unknown error code', () => {
    const bytes = encodeMessage({
      type: MessageType.Error,
      code: ErrorCode.RoomFull,
      message: 'x',
    });
    bytes[1] = 200;
    expect(failureCode(bytes)).toBe(ErrorCode.MalformedMessage);
  });

  it('rejects a string that is not valid UTF-8', () => {
    const bytes = encodeMessage({ type: MessageType.JoinRoom, code: 'ab' });
    bytes[3] = 0xff;
    expect(failureCode(bytes)).toBe(ErrorCode.MalformedMessage);
  });

  it('rejects a string length running past the end of the message', () => {
    expect(failureCode(new Uint8Array([MessageType.JoinRoom, 0xff, 0xff, 1]))).toBe(
      ErrorCode.MalformedMessage,
    );
  });

  it('rejects every truncation of a message with a fixed end', () => {
    for (const message of samples.filter((sample) => !hasPayload(sample))) {
      const bytes = encodeMessage(message);
      for (let length = 0; length < bytes.length; length++) {
        expect(failureCode(bytes.subarray(0, length))).toBe(ErrorCode.MalformedMessage);
      }
    }
  });

  it('rejects trailing bytes after a message with a fixed end', () => {
    for (const message of samples.filter((sample) => !hasPayload(sample))) {
      const bytes = encodeMessage(message);
      const extended = new Uint8Array(bytes.length + 1);
      extended.set(bytes);
      expect(failureCode(extended)).toBe(ErrorCode.MalformedMessage);
    }
  });

  it('survives corrupted bytes without throwing', () => {
    // A fixed-seed generator, so a failure here can be reproduced.
    let seed = 1;
    const nextByte = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed >>> 24;
    };
    for (let round = 0; round < 20_000; round++) {
      const bytes = encodeMessage(samples[round % samples.length] as Message).slice();
      bytes[nextByte() % bytes.length] = nextByte();
      bytes[nextByte() % bytes.length] = nextByte();
      expect(() => decodeMessage(bytes)).not.toThrow();
    }
  });
});
