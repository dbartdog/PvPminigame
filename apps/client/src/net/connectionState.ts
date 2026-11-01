import { ErrorCode, MessageType, type Message, type RoomPlayer } from '@pvp/protocol';

export type ConnectionStatus = 'connecting' | 'joining' | 'joined' | 'failed';

export interface ConnectionState {
  readonly status: ConnectionStatus;
  readonly playerId: string | null;
  readonly players: readonly RoomPlayer[];
  readonly tick: number | null;
  readonly lastSnapshotAtMs: number | null;
  readonly errorText: string | null;
}

export const initialConnectionState: ConnectionState = {
  status: 'connecting',
  playerId: null,
  players: [],
  tick: null,
  lastSnapshotAtMs: null,
  errorText: null,
};

const CONNECTION_LOST = 'Connection lost. Try again.';

const ERROR_TEXT: Record<ErrorCode, string> = {
  [ErrorCode.VersionMismatch]: 'A new version is out. Refresh the page to update.',
  [ErrorCode.MalformedMessage]: 'Something went wrong. Try again.',
  [ErrorCode.RoomNotFound]: "That room doesn't exist or has expired.",
  [ErrorCode.RoomFull]: 'This room is full.',
};

export function applyMessage(
  state: ConnectionState,
  message: Message,
  nowMs: number,
): ConnectionState {
  if (state.status === 'failed') return state;
  switch (message.type) {
    case MessageType.Welcome:
      return { ...state, status: 'joining', playerId: message.playerId };
    case MessageType.RoomState:
      return { ...state, status: 'joined', players: message.players };
    case MessageType.Snapshot:
      return { ...state, tick: message.tick, lastSnapshotAtMs: nowMs };
    case MessageType.Error:
      return { ...state, status: 'failed', errorText: ERROR_TEXT[message.code] };
    default:
      return state;
  }
}

/** Keeps the first failure, because a server rejection is followed by the socket closing. */
export function applyClose(state: ConnectionState): ConnectionState {
  if (state.status === 'failed') return state;
  return { ...state, status: 'failed', errorText: CONNECTION_LOST };
}

export function ownPlayer(state: ConnectionState): RoomPlayer | null {
  return state.players.find((player) => player.playerId === state.playerId) ?? null;
}

export function opponent(state: ConnectionState): RoomPlayer | null {
  return state.players.find((player) => player.playerId !== state.playerId) ?? null;
}

export function snapshotAgeMs(state: ConnectionState, nowMs: number): number | null {
  return state.lastSnapshotAtMs === null ? null : Math.max(0, nowMs - state.lastSnapshotAtMs);
}
