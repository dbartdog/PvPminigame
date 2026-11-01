import {
  ErrorCode,
  MessageType,
  decodeMessage,
  decodeToyInput,
  encodeMessage,
  encodeToySnapshot,
  type InputMessage,
  type JoinRoomMessage,
  type Message,
  type HelloMessage,
  type RoomPlayer,
} from '@pvp/protocol';
import {
  SNAPSHOT_RATE_HZ,
  TICK_RATE_HZ,
  advanceTimestep,
  createTimestep,
  toySim,
  type FixedTimestep,
  type ToyInput,
  type ToyState,
} from '@pvp/sim';
import { issueGuestIdentity, verifyDeviceToken } from './guest-token';

export const ROOM_IDLE_LIMIT_MS = 30 * 60 * 1000;
export const PULSE_INTERVAL_MS = 1000;
export const MAX_ROOMS = 10_000;
export const MAX_NAME_LENGTH = 20;

const SEATS = 2;
const TICKS_PER_SNAPSHOT = TICK_RATE_HZ / SNAPSHOT_RATE_HZ;
const MAX_PENDING_PINGS = 8;
const DEFAULT_NAME = 'Guest';
const STILL: ToyInput = { x: 0, y: 0 };

/** A connection as this module sees it, so rooms can be tested without sockets. */
export interface Peer {
  send(bytes: Uint8Array): void;
  close(): void;
}

export interface Session {
  readonly peer: Peer;
  playerId: string | null;
  name: string;
  room: Room | null;
  rttMs: number | null;
  pendingPings: number[];
  input: ToyInput;
}

interface Room {
  readonly code: string;
  readonly seats: (Session | null)[];
  state: ToyState;
  tick: number;
  timestep: FixedTimestep;
  lastActiveMs: number;
}

export interface GameServerOptions {
  readonly guestTokenSecret: string;
  /** Monotonic milliseconds. */
  readonly now: () => number;
  readonly generateCode: () => string;
  readonly generateSeed: () => number;
}

export interface GameServer {
  connect(peer: Peer): Session;
  receive(session: Session, data: ArrayBuffer | Uint8Array): void;
  disconnect(session: Session): void;
  /** Returns the new room's code, or null when the server is at capacity. */
  createRoom(): string | null;
  /** Runs everything that is due. Call often; timing comes from the injected clock. */
  advance(): void;
  roomCount(): number;
}

function cleanName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const printable = name.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const limited = [...printable].slice(0, MAX_NAME_LENGTH).join('').trim();
  return limited || DEFAULT_NAME;
}

function send(session: Session, message: Message): void {
  session.peer.send(encodeMessage(message));
}

function sendError(session: Session, code: ErrorCode, message: string): void {
  send(session, { type: MessageType.Error, code, message });
}

function occupants(room: Room): Session[] {
  return room.seats.filter((seat) => seat !== null);
}

function broadcast(room: Room, message: Message): void {
  const bytes = encodeMessage(message);
  for (const member of occupants(room)) member.peer.send(bytes);
}

function toRoomPlayer(session: Session): RoomPlayer {
  return { playerId: session.playerId ?? '', name: session.name, rttMs: session.rttMs };
}

function broadcastRoomState(room: Room): void {
  broadcast(room, {
    type: MessageType.RoomState,
    code: room.code,
    players: occupants(room).map(toRoomPlayer),
  });
}

function stepRoom(room: Room): void {
  const [first, second] = room.seats;
  room.state = toySim.step(room.state, [first?.input ?? STILL, second?.input ?? STILL], room.tick);
  room.tick++;
  if (room.tick % TICKS_PER_SNAPSHOT === 0) {
    broadcast(room, {
      type: MessageType.Snapshot,
      tick: room.tick,
      payload: encodeToySnapshot(room.state),
    });
  }
}

/** Empty rooms stay paused, so a link nobody has opened costs nothing. */
function advanceRoom(room: Room, elapsedMs: number): void {
  if (occupants(room).length === 0) return;
  const { timestep, steps } = advanceTimestep(room.timestep, elapsedMs);
  room.timestep = timestep;
  for (let i = 0; i < steps; i++) stepRoom(room);
}

function recordPong(session: Session, timestampMs: number, nowMs: number): void {
  // Only a timestamp this server sent counts. Later rules trust RTT, so a client can't invent it.
  const index = session.pendingPings.indexOf(timestampMs);
  if (index === -1) return;
  session.pendingPings.splice(0, index + 1);
  session.rttMs = Math.max(0, nowMs - timestampMs);
}

export function createGameServer(options: GameServerOptions): GameServer {
  const { guestTokenSecret, now, generateCode, generateSeed } = options;
  const rooms = new Map<string, Room>();
  const sessions = new Set<Session>();
  let lastAdvanceMs = now();
  let nextPulseMs = lastAdvanceMs + PULSE_INTERVAL_MS;

  function sendPing(session: Session): void {
    const timestampMs = now();
    session.pendingPings.push(timestampMs);
    if (session.pendingPings.length > MAX_PENDING_PINGS) session.pendingPings.shift();
    send(session, { type: MessageType.Ping, timestampMs });
  }

  function leaveRoom(session: Session): void {
    const { room } = session;
    if (!room) return;
    const seat = room.seats.indexOf(session);
    if (seat !== -1) room.seats[seat] = null;
    session.room = null;
    session.input = STILL;
    room.lastActiveMs = now();
    broadcastRoomState(room);
  }

  function seatPlayer(session: Session, room: Room, seat: number): void {
    room.seats[seat] = session;
    session.room = room;
    session.input = STILL;
    room.lastActiveMs = now();
    broadcastRoomState(room);
  }

  /** A refresh can arrive before the old socket closes, so the newest connection keeps the seat. */
  function replaceSeat(session: Session, room: Room, seat: number, previous: Session): void {
    previous.room = null;
    sendError(
      previous,
      ErrorCode.SessionReplaced,
      'You joined this room somewhere else, so this tab was disconnected.',
    );
    previous.peer.close();
    seatPlayer(session, room, seat);
  }

  function handleHello(session: Session, message: HelloMessage): void {
    if (session.playerId !== null) {
      sendError(session, ErrorCode.MalformedMessage, 'You already said hello.');
      return;
    }
    const verifiedId = verifyDeviceToken(message.deviceToken, guestTokenSecret);
    const identity =
      verifiedId === null
        ? issueGuestIdentity(guestTokenSecret)
        : { playerId: verifiedId, deviceToken: message.deviceToken };
    session.playerId = identity.playerId;
    session.name = cleanName(message.name);
    send(session, { type: MessageType.Welcome, ...identity });
    sendPing(session);
  }

  function handleJoinRoom(session: Session, message: JoinRoomMessage): void {
    if (session.playerId === null) {
      sendError(session, ErrorCode.MalformedMessage, 'Say hello before joining a room.');
      return;
    }
    const room = rooms.get(message.code.toUpperCase());
    if (!room) {
      sendError(
        session,
        ErrorCode.RoomNotFound,
        "We couldn't find that room. It may have expired.",
      );
      return;
    }
    if (session.room === room) {
      broadcastRoomState(room);
      return;
    }
    if (session.room) {
      sendError(session, ErrorCode.MalformedMessage, "You're already in another room.");
      return;
    }
    const existingSeat = room.seats.findIndex((seat) => seat?.playerId === session.playerId);
    const previous = room.seats[existingSeat];
    if (previous) {
      replaceSeat(session, room, existingSeat, previous);
      return;
    }
    const freeSeat = room.seats.indexOf(null);
    if (freeSeat === -1) {
      sendError(session, ErrorCode.RoomFull, 'This room is full. Ask your friend for a new link.');
      return;
    }
    seatPlayer(session, room, freeSeat);
  }

  function handleInput(session: Session, message: InputMessage): void {
    if (!session.room) return;
    const input = decodeToyInput(message.payload);
    if (!input) {
      sendError(session, ErrorCode.MalformedMessage, "That input couldn't be read.");
      return;
    }
    session.input = input;
    session.room.lastActiveMs = now();
  }

  function dispatch(session: Session, message: Message): void {
    switch (message.type) {
      case MessageType.Hello:
        handleHello(session, message);
        return;
      case MessageType.JoinRoom:
        handleJoinRoom(session, message);
        return;
      case MessageType.Input:
        handleInput(session, message);
        return;
      case MessageType.Ping:
        send(session, { type: MessageType.Pong, timestampMs: message.timestampMs });
        return;
      case MessageType.Pong:
        recordPong(session, message.timestampMs, now());
        return;
      default:
        sendError(session, ErrorCode.MalformedMessage, "The server doesn't accept that message.");
    }
  }

  function expireRoom(room: Room): void {
    rooms.delete(room.code);
    for (const member of occupants(room)) {
      member.room = null;
      sendError(member, ErrorCode.RoomNotFound, 'This room expired. Start a new challenge.');
      member.peer.close();
    }
  }

  function pulse(): void {
    for (const session of sessions) {
      if (session.playerId !== null) sendPing(session);
    }
    for (const room of rooms.values()) {
      if (occupants(room).length > 0) broadcastRoomState(room);
    }
  }

  return {
    connect(peer) {
      const session: Session = {
        peer,
        playerId: null,
        name: DEFAULT_NAME,
        room: null,
        rttMs: null,
        pendingPings: [],
        input: STILL,
      };
      sessions.add(session);
      return session;
    },

    receive(session, data) {
      const result = decodeMessage(data);
      if (result.ok) {
        dispatch(session, result.message);
        return;
      }
      send(session, result.error);
      if (result.error.code === ErrorCode.VersionMismatch) session.peer.close();
    },

    disconnect(session) {
      sessions.delete(session);
      leaveRoom(session);
    },

    createRoom() {
      if (rooms.size >= MAX_ROOMS) return null;
      let code = generateCode();
      while (rooms.has(code)) code = generateCode();
      rooms.set(code, {
        code,
        seats: Array<Session | null>(SEATS).fill(null),
        state: toySim.init(generateSeed()),
        tick: 0,
        timestep: createTimestep(TICK_RATE_HZ),
        lastActiveMs: now(),
      });
      return code;
    },

    advance() {
      const nowMs = now();
      const elapsedMs = nowMs - lastAdvanceMs;
      lastAdvanceMs = nowMs;
      for (const room of rooms.values()) {
        if (nowMs - room.lastActiveMs >= ROOM_IDLE_LIMIT_MS) expireRoom(room);
        else advanceRoom(room, elapsedMs);
      }
      if (nowMs >= nextPulseMs) {
        // Scheduled from the last target, not from now, so frame timing can't add up to drift.
        nextPulseMs = Math.max(nextPulseMs + PULSE_INTERVAL_MS, nowMs);
        pulse();
      }
    },

    roomCount: () => rooms.size,
  };
}
