import {
  ErrorCode,
  MessageType,
  PROTOCOL_VERSION,
  type ErrorMessage,
  type Message,
  type RoomPlayer,
} from './messages';
import { createReader, createWriter, type Reader, type Writer } from './wire';

export type DecodeResult =
  | { readonly ok: true; readonly message: Message }
  | { readonly ok: false; readonly error: ErrorMessage };

const MAX_RTT_MS = 0xfffe;
const RTT_UNKNOWN = 0xffff;

function writeRtt(writer: Writer, rttMs: number | null): void {
  writer.u16(rttMs === null ? RTT_UNKNOWN : Math.min(Math.round(rttMs), MAX_RTT_MS));
}

function readRtt(reader: Reader): number | null {
  const value = reader.u16();
  return value === RTT_UNKNOWN ? null : value;
}

function writePlayers(writer: Writer, players: readonly RoomPlayer[]): void {
  writer.u8(players.length);
  for (const player of players) {
    writer.string(player.playerId);
    writer.string(player.name);
    writeRtt(writer, player.rttMs);
  }
}

function readPlayers(reader: Reader): RoomPlayer[] {
  const players: RoomPlayer[] = [];
  const count = reader.u8();
  for (let i = 0; i < count; i++) {
    players.push({ playerId: reader.string(), name: reader.string(), rttMs: readRtt(reader) });
  }
  return players;
}

function writeBody(writer: Writer, message: Message): void {
  switch (message.type) {
    case MessageType.Hello:
      writer.u16(message.protocolVersion);
      writer.string(message.deviceToken);
      writer.string(message.name);
      return;
    case MessageType.Welcome:
      writer.string(message.playerId);
      writer.string(message.deviceToken);
      return;
    case MessageType.JoinRoom:
      writer.string(message.code);
      return;
    case MessageType.RoomState:
      writer.string(message.code);
      writePlayers(writer, message.players);
      return;
    case MessageType.Input:
    case MessageType.Snapshot:
      writer.u32(message.tick);
      writer.bytes(message.payload);
      return;
    case MessageType.Ping:
    case MessageType.Pong:
      writer.f64(message.timestampMs);
      return;
    case MessageType.Error:
      writer.u8(message.code);
      writer.string(message.message);
      return;
  }
}

export function encodeMessage(message: Message): Uint8Array {
  const writer = createWriter();
  writer.u8(message.type);
  writeBody(writer, message);
  return writer.finish();
}

function isErrorCode(value: number): value is ErrorCode {
  return (Object.values(ErrorCode) as number[]).includes(value);
}

function readError(reader: Reader): ErrorMessage | null {
  const code = reader.u8();
  const message = reader.string();
  return isErrorCode(code) ? { type: MessageType.Error, code, message } : null;
}

/** Returns null for an unknown message type or error code. */
function readBody(type: number, reader: Reader): Message | null {
  switch (type) {
    case MessageType.Welcome:
      return { type, playerId: reader.string(), deviceToken: reader.string() };
    case MessageType.JoinRoom:
      return { type, code: reader.string() };
    case MessageType.RoomState:
      return { type, code: reader.string(), players: readPlayers(reader) };
    case MessageType.Input:
    case MessageType.Snapshot:
      return { type, tick: reader.u32(), payload: reader.rest() };
    case MessageType.Ping:
    case MessageType.Pong:
      return { type, timestampMs: reader.f64() };
    case MessageType.Error:
      return readError(reader);
    default:
      return null;
  }
}

function failure(code: ErrorCode, message: string): DecodeResult {
  return { ok: false, error: { type: MessageType.Error, code, message } };
}

function malformed(): DecodeResult {
  return failure(ErrorCode.MalformedMessage, "That message couldn't be read.");
}

function versionMismatch(version: number): DecodeResult {
  return failure(
    ErrorCode.VersionMismatch,
    `Version mismatch: got ${version}, expected ${PROTOCOL_VERSION}. Refresh the page to update.`,
  );
}

function completed(message: Message | null, reader: Reader): DecodeResult {
  return message && reader.isDone() ? { ok: true, message } : malformed();
}

/** The version is checked first: the rest of a Hello from another version may be laid out differently. */
function readHello(reader: Reader): DecodeResult {
  const protocolVersion = reader.u16();
  if (protocolVersion !== PROTOCOL_VERSION) return versionMismatch(protocolVersion);
  const message: Message = {
    type: MessageType.Hello,
    protocolVersion,
    deviceToken: reader.string(),
    name: reader.string(),
  };
  return completed(message, reader);
}

/**
 * Never throws, because these bytes come straight from the network. A failed result carries an
 * Error message that is ready to encode and send back.
 */
export function decodeMessage(data: ArrayBuffer | Uint8Array): DecodeResult {
  const reader = createReader(data instanceof Uint8Array ? data : new Uint8Array(data));
  try {
    const type = reader.u8();
    return type === MessageType.Hello
      ? readHello(reader)
      : completed(readBody(type, reader), reader);
  } catch {
    return malformed();
  }
}
