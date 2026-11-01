import { beforeEach, describe, expect, it } from 'vitest';
import {
  ErrorCode,
  MessageType,
  PROTOCOL_VERSION,
  decodeMessage,
  decodeToySnapshot,
  encodeMessage,
  encodeToyInput,
  type Message,
  type RoomStateMessage,
  type SnapshotMessage,
  type WelcomeMessage,
} from '@pvp/protocol';
import { toySim } from '@pvp/sim';
import {
  MAX_NAME_LENGTH,
  MAX_ROOMS,
  PULSE_INTERVAL_MS,
  ROOM_IDLE_LIMIT_MS,
  createGameServer,
  type GameServer,
  type Session,
} from './game-server';

const FRAME_MS = 1000 / 60;

interface Client {
  session: Session;
  received: Message[];
  closed: boolean;
  say(message: Message): void;
}

let nowMs: number;
let server: GameServer;
let nextCode: number;

function connect(): Client {
  const received: Message[] = [];
  const client: Client = {
    received,
    closed: false,
    session: undefined as unknown as Session,
    say: (message) => server.receive(client.session, encodeMessage(message)),
  };
  client.session = server.connect({
    send(bytes) {
      const result = decodeMessage(bytes);
      if (!result.ok) throw new Error('Server sent an unreadable message');
      received.push(result.message);
    },
    close() {
      client.closed = true;
      server.disconnect(client.session);
    },
  });
  return client;
}

function hello(client: Client, name: string, deviceToken = ''): void {
  client.say({
    type: MessageType.Hello,
    protocolVersion: PROTOCOL_VERSION,
    deviceToken,
    name,
  });
}

function join(client: Client, code: string): void {
  client.say({ type: MessageType.JoinRoom, code });
}

function joined(name: string, code: string): Client {
  const client = connect();
  hello(client, name);
  join(client, code);
  return client;
}

function createRoom(): string {
  const code = server.createRoom();
  if (!code) throw new Error('Expected a room');
  return code;
}

function runFor(ms: number): void {
  const end = nowMs + ms;
  while (nowMs < end) {
    nowMs = Math.min(end, nowMs + FRAME_MS);
    server.advance();
  }
}

function ofType<T extends Message['type']>(
  client: Client,
  type: T,
): Extract<Message, { type: T }>[] {
  return client.received.filter((message) => message.type === type) as Extract<
    Message,
    { type: T }
  >[];
}

function lastRoomState(client: Client): RoomStateMessage {
  const state = ofType(client, MessageType.RoomState).at(-1);
  if (!state) throw new Error('Expected a RoomState');
  return state;
}

function lastSnapshot(client: Client): SnapshotMessage {
  const snapshot = ofType(client, MessageType.Snapshot).at(-1);
  if (!snapshot) throw new Error('Expected a Snapshot');
  return snapshot;
}

function welcome(client: Client): WelcomeMessage {
  const message = ofType(client, MessageType.Welcome)[0];
  if (!message) throw new Error('Expected a Welcome');
  return message;
}

function lastErrorCode(client: Client): ErrorCode | undefined {
  return ofType(client, MessageType.Error).at(-1)?.code;
}

function answerPings(client: Client): void {
  for (const ping of ofType(client, MessageType.Ping)) {
    client.say({ type: MessageType.Pong, timestampMs: ping.timestampMs });
  }
  client.received.length = 0;
}

beforeEach(() => {
  nowMs = 1000;
  nextCode = 0;
  server = createGameServer({
    guestTokenSecret: 'test-secret',
    now: () => nowMs,
    generateCode: () => `CODE${nextCode++}`,
    generateSeed: () => 7,
  });
});

describe('handshake', () => {
  it('issues a token on first Hello and keeps the player on the next', () => {
    const first = connect();
    hello(first, 'Ada');
    const { playerId, deviceToken } = welcome(first);
    expect(playerId).not.toBe('');

    const second = connect();
    hello(second, 'Ada', deviceToken);
    expect(welcome(second)).toMatchObject({ playerId, deviceToken });
  });

  it('issues a new identity for a forged token, without disconnecting', () => {
    const client = connect();
    hello(client, 'Mallory', 'victim-id.forged-signature');
    expect(welcome(client).playerId).not.toBe('victim-id');
    expect(client.closed).toBe(false);
  });

  it('rejects another protocol version with a clear Error, then closes', () => {
    const client = connect();
    client.say({
      type: MessageType.Hello,
      protocolVersion: PROTOCOL_VERSION + 1,
      deviceToken: '',
      name: 'Old',
    });
    expect(lastErrorCode(client)).toBe(ErrorCode.VersionMismatch);
    expect(client.closed).toBe(true);
  });

  it('answers garbage with an Error and stays up', () => {
    const client = connect();
    server.receive(client.session, new Uint8Array([200, 1, 2]));
    expect(lastErrorCode(client)).toBe(ErrorCode.MalformedMessage);
    expect(client.closed).toBe(false);
  });

  it('refuses a second Hello, so a connection cannot change identity', () => {
    const client = connect();
    hello(client, 'Ada');
    const { playerId } = welcome(client);
    hello(client, 'Grace');
    expect(lastErrorCode(client)).toBe(ErrorCode.MalformedMessage);
    expect(client.session.playerId).toBe(playerId);
  });

  it('refuses messages only the server may send', () => {
    const client = connect();
    hello(client, 'Ada');
    client.say({
      type: MessageType.Snapshot,
      tick: 1,
      payload: new Uint8Array([1]),
    });
    expect(lastErrorCode(client)).toBe(ErrorCode.MalformedMessage);
  });

  it.each([
    ['  Ada  ', 'Ada'],
    ['', 'Guest'],
    ['   ', 'Guest'],
    ['Ada\u0000\u0007Grace', 'AdaGrace'],
    ['x'.repeat(500), 'x'.repeat(MAX_NAME_LENGTH)],
  ])('cleans the display name %j', (name, expected) => {
    const code = createRoom();
    const client = joined(name, code);
    expect(lastRoomState(client).players[0]?.name).toBe(expected);
  });
});

describe('room lifecycle', () => {
  it('creates distinct rooms', () => {
    expect(createRoom()).not.toBe(createRoom());
    expect(server.roomCount()).toBe(2);
  });

  it('retries when a generated code is already in use', () => {
    const repeating = ['SAME', 'SAME', 'OTHER'];
    server = createGameServer({
      guestTokenSecret: 's',
      now: () => nowMs,
      generateCode: () => repeating.shift() ?? 'END',
      generateSeed: () => 1,
    });
    expect([createRoom(), createRoom()]).toEqual(['SAME', 'OTHER']);
  });

  it('stops creating rooms at capacity', () => {
    for (let i = 0; i < MAX_ROOMS; i++) createRoom();
    expect(server.createRoom()).toBeNull();
  });

  it('tells both players about each other when the second joins', () => {
    const code = createRoom();
    const ada = joined('Ada', code);
    const grace = joined('Grace', code);
    const names = ['Ada', 'Grace'];
    expect(lastRoomState(ada).players.map((player) => player.name)).toEqual(names);
    expect(lastRoomState(grace).players.map((player) => player.name)).toEqual(names);
  });

  it('accepts a code typed in lower case', () => {
    const code = createRoom();
    const client = joined('Ada', code.toLowerCase());
    expect(lastRoomState(client).code).toBe(code);
  });

  it('reports an unknown room', () => {
    const client = joined('Ada', 'NOPE');
    expect(lastErrorCode(client)).toBe(ErrorCode.RoomNotFound);
    expect(client.closed).toBe(false);
  });

  it('turns a third player away politely and leaves the room alone', () => {
    const code = createRoom();
    const ada = joined('Ada', code);
    joined('Grace', code);
    const third = joined('Linus', code);
    expect(lastErrorCode(third)).toBe(ErrorCode.RoomFull);
    expect(ofType(third, MessageType.Error).at(-1)?.message).toContain('This room is full');
    expect(third.session.room).toBeNull();
    expect(lastRoomState(ada).players).toHaveLength(2);
  });

  it('requires a Hello before joining', () => {
    const code = createRoom();
    const client = connect();
    join(client, code);
    expect(lastErrorCode(client)).toBe(ErrorCode.MalformedMessage);
    expect(client.session.room).toBeNull();
  });

  it('refuses joining a second room', () => {
    const client = joined('Ada', createRoom());
    join(client, createRoom());
    expect(lastErrorCode(client)).toBe(ErrorCode.MalformedMessage);
  });

  it('frees the seat when a player leaves, and tells the other player', () => {
    const code = createRoom();
    const ada = joined('Ada', code);
    const grace = joined('Grace', code);
    server.disconnect(grace.session);
    expect(lastRoomState(ada).players.map((player) => player.name)).toEqual(['Ada']);
    const linus = joined('Linus', code);
    expect(lastRoomState(linus).players).toHaveLength(2);
  });

  it('gives the seat to the newest connection of the same player', () => {
    const code = createRoom();
    const oldTab = joined('Ada', code);
    const other = joined('Grace', code);
    const newTab = connect();
    hello(newTab, 'Ada', welcome(oldTab).deviceToken);
    join(newTab, code);

    expect(lastErrorCode(oldTab)).toBe(ErrorCode.SessionReplaced);
    expect(oldTab.closed).toBe(true);
    expect(lastRoomState(other).players).toHaveLength(2);
    expect(newTab.session.room).not.toBeNull();
    expect(oldTab.session.room).toBeNull();
  });
});

describe('idle expiry', () => {
  it('removes an empty room after 30 minutes', () => {
    createRoom();
    runFor(ROOM_IDLE_LIMIT_MS - 1000);
    expect(server.roomCount()).toBe(1);
    runFor(1000);
    expect(server.roomCount()).toBe(0);
  });

  it('expires a room whose players went quiet, and tells them why', () => {
    const client = joined('Ada', createRoom());
    runFor(ROOM_IDLE_LIMIT_MS);
    expect(server.roomCount()).toBe(0);
    expect(ofType(client, MessageType.Error).at(-1)?.message).toContain('expired');
    expect(client.closed).toBe(true);
  });

  it('keeps a room alive while a player sends input', () => {
    const client = joined('Ada', createRoom());
    for (let minute = 0; minute < 40; minute++) {
      runFor(60_000);
      client.say({ type: MessageType.Input, tick: 0, payload: encodeToyInput({ x: 1, y: 0 }) });
      client.received.length = 0;
    }
    expect(server.roomCount()).toBe(1);
  });

  it('does not let pongs alone keep a room alive', () => {
    const client = joined('Ada', createRoom());
    for (let minute = 0; minute < 31; minute++) {
      runFor(60_000);
      answerPings(client);
    }
    expect(server.roomCount()).toBe(0);
  });
});

describe('simulation', () => {
  it('runs at 60 Hz and sends snapshots at 30 Hz', () => {
    const client = joined('Ada', createRoom());
    runFor(1000);
    const snapshots = ofType(client, MessageType.Snapshot);
    expect(Math.abs(snapshots.length - 30)).toBeLessThanOrEqual(1);
    expect(Math.abs((snapshots.at(-1)?.tick ?? 0) - 60)).toBeLessThanOrEqual(2);
    expect(snapshots.every((snapshot) => snapshot.tick % 2 === 0)).toBe(true);
  });

  it('stays paused while a room is empty', () => {
    createRoom();
    runFor(5000);
    const client = joined('Ada', 'CODE0');
    runFor(100);
    expect(lastSnapshot(client).tick).toBeLessThanOrEqual(8);
  });

  it('moves a dot according to validated input', () => {
    const client = joined('Ada', createRoom());
    client.say({ type: MessageType.Input, tick: 0, payload: encodeToyInput({ x: 1, y: 0 }) });
    runFor(500);
    const snapshot = decodeToySnapshot(lastSnapshot(client).payload);
    const start = toySim.init(7).dots[0];
    expect(snapshot?.dots[0].x).toBeGreaterThan(start.x);
    expect(snapshot?.dots[0].y).toBe(start.y);
  });

  it('rejects out-of-range input instead of applying it', () => {
    const client = joined('Ada', createRoom());
    client.say({ type: MessageType.Input, tick: 0, payload: new Uint8Array([100, 100]) });
    expect(lastErrorCode(client)).toBe(ErrorCode.MalformedMessage);
    runFor(500);
    const snapshot = decodeToySnapshot(lastSnapshot(client).payload);
    expect(snapshot?.dots[0]).toEqual(toySim.init(7).dots[0]);
  });

  it('ignores input from someone not in a room', () => {
    const client = connect();
    hello(client, 'Ada');
    client.say({ type: MessageType.Input, tick: 0, payload: encodeToyInput({ x: 1, y: 0 }) });
    expect(lastErrorCode(client)).toBeUndefined();
  });

  it('stops applying a player’s last input once they leave', () => {
    const code = createRoom();
    const ada = joined('Ada', code);
    const grace = joined('Grace', code);
    grace.say({ type: MessageType.Input, tick: 0, payload: encodeToyInput({ x: -1, y: 0 }) });
    runFor(100);
    server.disconnect(grace.session);
    runFor(100);
    const atLeave = decodeToySnapshot(lastSnapshot(ada).payload)?.dots[1].x;
    runFor(500);
    expect(decodeToySnapshot(lastSnapshot(ada).payload)?.dots[1].x).toBe(atLeave);
  });
});

describe('lost frames', () => {
  function lastPingTimestamp(client: Client): number {
    const ping = ofType(client, MessageType.Ping).at(-1);
    if (!ping) throw new Error('Expected a Ping');
    return ping.timestampMs;
  }

  it('keeps a player seated through a long run of lost Pongs', () => {
    const code = createRoom();
    const ada = joined('Ada', code);
    joined('Grace', code);
    runFor(PULSE_INTERVAL_MS * 60);
    expect(ada.closed).toBe(false);
    expect(lastRoomState(ada).players).toHaveLength(2);
    expect(lastErrorCode(ada)).toBeUndefined();
  });

  it('recovers RTT on the first Pong after a long run of lost ones', () => {
    const client = joined('Ada', createRoom());
    runFor(PULSE_INTERVAL_MS * 60);
    const timestampMs = lastPingTimestamp(client);
    nowMs = timestampMs + 200;
    client.say({ type: MessageType.Pong, timestampMs });
    expect(client.session.rttMs).toBe(200);
  });

  it('measures the next Ping correctly when one Pong in the middle is lost', () => {
    const client = joined('Ada', createRoom());
    nowMs += 100;
    client.say({ type: MessageType.Pong, timestampMs: lastPingTimestamp(client) });
    runFor(PULSE_INTERVAL_MS);
    const lost = lastPingTimestamp(client);
    runFor(PULSE_INTERVAL_MS);
    const next = lastPingTimestamp(client);
    expect(next).not.toBe(lost);
    nowMs = next + 220;
    client.say({ type: MessageType.Pong, timestampMs: next });
    expect(client.session.rttMs).toBe(220);
  });

  it('keeps applying the last input until a newer one arrives', () => {
    const client = joined('Ada', createRoom());
    client.say({ type: MessageType.Input, tick: 0, payload: encodeToyInput({ x: 1, y: 0 }) });
    runFor(200);
    const early = decodeToySnapshot(lastSnapshot(client).payload)?.dots[0].x ?? 0;
    runFor(200);
    const late = decodeToySnapshot(lastSnapshot(client).payload)?.dots[0].x ?? 0;
    expect(late).toBeGreaterThan(early);

    client.say({ type: MessageType.Input, tick: 0, payload: encodeToyInput({ x: 0, y: 0 }) });
    runFor(100);
    const stopped = decodeToySnapshot(lastSnapshot(client).payload)?.dots[0].x;
    runFor(200);
    expect(decodeToySnapshot(lastSnapshot(client).payload)?.dots[0].x).toBe(stopped);
  });
});

describe('RTT', () => {
  it('pings straight after Welcome and then about once a second', () => {
    const client = connect();
    hello(client, 'Ada');
    expect(ofType(client, MessageType.Ping)).toHaveLength(1);
    runFor(PULSE_INTERVAL_MS * 3);
    expect(ofType(client, MessageType.Ping)).toHaveLength(4);
  });

  it('measures RTT and shows it to both players', () => {
    const code = createRoom();
    const ada = joined('Ada', code);
    const grace = joined('Grace', code);
    expect(lastRoomState(ada).players[0]?.rttMs).toBeNull();

    nowMs += 40;
    answerPings(ada);
    runFor(PULSE_INTERVAL_MS);

    expect(lastRoomState(grace).players[0]?.rttMs).toBe(40);
    expect(lastRoomState(ada).players[1]?.rttMs).toBeNull();
  });

  it('broadcasts RoomState about once a second even with no changes', () => {
    const client = joined('Ada', createRoom());
    client.received.length = 0;
    runFor(PULSE_INTERVAL_MS * 3);
    expect(ofType(client, MessageType.RoomState).length).toBeGreaterThanOrEqual(3);
  });

  it('ignores a Pong for a Ping the server never sent', () => {
    const client = joined('Ada', createRoom());
    client.say({ type: MessageType.Pong, timestampMs: nowMs - 5 });
    client.say({ type: MessageType.Pong, timestampMs: nowMs + 1_000_000 });
    expect(client.session.rttMs).toBeNull();
  });

  it('counts each Ping once', () => {
    const client = connect();
    hello(client, 'Ada');
    const timestampMs = ofType(client, MessageType.Ping)[0]?.timestampMs ?? 0;
    nowMs += 10;
    client.say({ type: MessageType.Pong, timestampMs });
    nowMs += 500;
    client.say({ type: MessageType.Pong, timestampMs });
    expect(client.session.rttMs).toBe(10);
  });

  it('answers a client Ping with a Pong, before Hello too', () => {
    const client = connect();
    client.say({ type: MessageType.Ping, timestampMs: 123.5 });
    expect(ofType(client, MessageType.Pong)).toEqual([
      { type: MessageType.Pong, timestampMs: 123.5 },
    ]);
  });
});
