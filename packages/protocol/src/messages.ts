export const PROTOCOL_VERSION = 1;

export const MessageType = {
  Hello: 1,
  Welcome: 2,
  JoinRoom: 3,
  RoomState: 4,
  Input: 5,
  Snapshot: 6,
  Ping: 7,
  Pong: 8,
  Error: 9,
} as const;

export const ErrorCode = {
  VersionMismatch: 1,
  MalformedMessage: 2,
  RoomNotFound: 3,
  RoomFull: 4,
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Keep the start of this layout (type byte, then version) and all of ErrorMessage the same in
 * every version. A peer on another version has to be able to read both to be told it's out of date.
 */
export interface HelloMessage {
  readonly type: typeof MessageType.Hello;
  readonly protocolVersion: number;
  /** Empty on a player's first Hello; the server issues one in Welcome. */
  readonly deviceToken: string;
  readonly name: string;
}

export interface WelcomeMessage {
  readonly type: typeof MessageType.Welcome;
  readonly playerId: string;
  readonly deviceToken: string;
}

export interface JoinRoomMessage {
  readonly type: typeof MessageType.JoinRoom;
  readonly code: string;
}

export interface RoomPlayer {
  readonly playerId: string;
  readonly name: string;
  /** Null until the first Pong arrives. */
  readonly rttMs: number | null;
}

export interface RoomStateMessage {
  readonly type: typeof MessageType.RoomState;
  readonly code: string;
  readonly players: readonly RoomPlayer[];
}

/** The payload format belongs to the game, so the protocol treats it as opaque bytes. */
export interface InputMessage {
  readonly type: typeof MessageType.Input;
  readonly tick: number;
  readonly payload: Uint8Array;
}

export interface SnapshotMessage {
  readonly type: typeof MessageType.Snapshot;
  readonly tick: number;
  readonly payload: Uint8Array;
}

export interface PingMessage {
  readonly type: typeof MessageType.Ping;
  readonly timestampMs: number;
}

export interface PongMessage {
  readonly type: typeof MessageType.Pong;
  /** Echoes the Ping's timestamp, so the sender needs no record of what it sent. */
  readonly timestampMs: number;
}

export interface ErrorMessage {
  readonly type: typeof MessageType.Error;
  readonly code: ErrorCode;
  readonly message: string;
}

export type Message =
  | HelloMessage
  | WelcomeMessage
  | JoinRoomMessage
  | RoomStateMessage
  | InputMessage
  | SnapshotMessage
  | PingMessage
  | PongMessage
  | ErrorMessage;
