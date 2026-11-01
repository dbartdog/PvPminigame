import {
  ErrorCode,
  MessageType,
  PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
  encodeToySnapshot,
  type Message,
} from '@pvp/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createConnection, type SocketLike } from './connection';
import { opponent, ownPlayer, snapshotAgeMs } from './connectionState';

function createFakeSocket() {
  const sent: Message[] = [];
  const socket: SocketLike = {
    binaryType: 'blob',
    onopen: null,
    onmessage: null,
    onclose: null,
    send(data) {
      const result = decodeMessage(data);
      if (result.ok) sent.push(result.message);
    },
    close: vi.fn(),
  };
  const receive = (message: Message): void => {
    const bytes = encodeMessage(message);
    const data = bytes.buffer.slice(0, bytes.length);
    socket.onmessage?.({ data });
  };
  return { socket, sent, receive };
}

function setup(deviceToken = '') {
  const fake = createFakeSocket();
  const onDeviceToken = vi.fn();
  let now = 1000;
  const connection = createConnection({
    createSocket: () => fake.socket,
    name: 'Ada',
    deviceToken,
    roomCode: 'XK7P2M',
    onDeviceToken,
    nowMs: () => now,
  });
  return { ...fake, connection, onDeviceToken, setNow: (ms: number) => (now = ms) };
}

const self = { playerId: 'me', name: 'Ada', rttMs: 40 };
const players = [self, { playerId: 'them', name: 'Grace', rttMs: 55 }];
const welcome: Message = { type: MessageType.Welcome, playerId: 'me', deviceToken: 'token.new' };
const roomState: Message = { type: MessageType.RoomState, code: 'XK7P2M', players };

describe('joining a room', () => {
  it('asks for binary data, as the protocol needs', () => {
    expect(setup().socket.binaryType).toBe('arraybuffer');
  });

  it('says Hello with the stored token once the socket opens', () => {
    const { socket, sent } = setup('token.old');
    expect(sent).toEqual([]);
    socket.onopen?.();
    expect(sent).toEqual([
      {
        type: MessageType.Hello,
        protocolVersion: PROTOCOL_VERSION,
        deviceToken: 'token.old',
        name: 'Ada',
      },
    ]);
  });

  it('stores the issued token and joins after Welcome', () => {
    const { connection, sent, receive, onDeviceToken } = setup();
    receive(welcome);
    expect(onDeviceToken).toHaveBeenCalledWith('token.new');
    expect(sent).toEqual([{ type: MessageType.JoinRoom, code: 'XK7P2M' }]);
    expect(connection.getState()).toMatchObject({ status: 'joining', playerId: 'me' });
  });

  it('counts as joined at the first RoomState and tells players apart', () => {
    const { connection, receive } = setup();
    receive(welcome);
    receive(roomState);
    const state = connection.getState();
    expect(state.status).toBe('joined');
    expect(ownPlayer(state)?.rttMs).toBe(40);
    expect(opponent(state)?.name).toBe('Grace');
  });

  it('has no opponent while waiting alone', () => {
    const { connection, receive } = setup();
    receive(welcome);
    receive({ type: MessageType.RoomState, code: 'XK7P2M', players: [self] });
    expect(opponent(connection.getState())).toBeNull();
  });
});

describe('staying connected', () => {
  it('echoes a Ping as a Pong with the same timestamp', () => {
    const { sent, receive } = setup();
    receive({ type: MessageType.Ping, timestampMs: 1234.5 });
    expect(sent).toEqual([{ type: MessageType.Pong, timestampMs: 1234.5 }]);
  });

  it('tracks the tick and age of the latest snapshot', () => {
    const { connection, receive, setNow } = setup();
    receive({ type: MessageType.Snapshot, tick: 42, payload: new Uint8Array() });
    expect(connection.getState().tick).toBe(42);
    setNow(1033);
    expect(snapshotAgeMs(connection.getState(), 1033)).toBe(33);
  });

  it('keeps the decoded dots and pickup from a snapshot', () => {
    const { connection, receive } = setup();
    const snapshot = {
      dots: [
        { x: 1, y: 2, score: 3 },
        { x: 4, y: 5, score: 6 },
      ],
      pickup: { x: 7, y: 8 },
    } as const;
    receive({ type: MessageType.Snapshot, tick: 1, payload: encodeToySnapshot(snapshot) });
    expect(connection.getState().snapshot).toEqual(snapshot);
  });

  it('still tracks the tick when a snapshot payload is unreadable', () => {
    const { connection, receive } = setup();
    receive({ type: MessageType.Snapshot, tick: 9, payload: new Uint8Array([1]) });
    expect(connection.getState()).toMatchObject({ tick: 9, snapshot: null });
  });

  it('has no snapshot age before the first snapshot', () => {
    expect(snapshotAgeMs(setup().connection.getState(), 1000)).toBeNull();
  });

  it('does not wake the UI for snapshots', () => {
    const { connection, receive } = setup();
    const listener = vi.fn();
    connection.subscribe(listener);
    receive({ type: MessageType.Snapshot, tick: 1, payload: new Uint8Array() });
    expect(listener).not.toHaveBeenCalled();
    receive(welcome);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('sends inputs only after joining', () => {
    const { connection, sent, receive } = setup();
    const payload = new Uint8Array([1, 255]);
    connection.sendInput(5, payload);
    expect(sent).toEqual([]);
    receive(welcome);
    receive(roomState);
    connection.sendInput(5, payload);
    expect(sent.at(-1)).toEqual({ type: MessageType.Input, tick: 5, payload });
  });

  it('ignores unreadable data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { connection, socket } = setup();
    socket.onmessage?.({ data: new Uint8Array([200]).buffer });
    socket.onmessage?.({ data: 'not binary' });
    expect(connection.getState().status).toBe('connecting');
    warn.mockRestore();
  });
});

describe('failures', () => {
  it.each([
    [ErrorCode.RoomFull, 'This room is full.'],
    [ErrorCode.RoomNotFound, "That room doesn't exist or has expired."],
    [ErrorCode.VersionMismatch, 'A new version is out. Refresh the page to update.'],
    [ErrorCode.MalformedMessage, 'Something went wrong. Try again.'],
    [ErrorCode.SessionReplaced, "You're playing in another tab or device now."],
  ])('shows friendly text for error code %i and closes', (code, text) => {
    const { connection, socket, receive } = setup();
    receive({ type: MessageType.Error, code, message: 'raw server text' });
    expect(connection.getState()).toMatchObject({ status: 'failed', errorText: text });
    expect(socket.close).toHaveBeenCalled();
  });

  it('never reconnects by itself after being replaced, or two tabs would fight over the seat', () => {
    const fake = createFakeSocket();
    const createSocket = vi.fn(() => fake.socket);
    createConnection({
      createSocket,
      name: 'Ada',
      deviceToken: 'token.old',
      roomCode: 'XK7P2M',
      onDeviceToken: vi.fn(),
    });
    fake.receive({ type: MessageType.Error, code: ErrorCode.SessionReplaced, message: 'x' });
    fake.socket.onclose?.();
    expect(createSocket).toHaveBeenCalledOnce();
  });

  it('reports a lost connection', () => {
    const { connection, socket } = setup();
    socket.onclose?.();
    expect(connection.getState()).toMatchObject({
      status: 'failed',
      errorText: 'Connection lost. Try again.',
    });
  });

  it('keeps the rejection reason when the socket closes afterwards', () => {
    const { connection, socket, receive } = setup();
    receive({ type: MessageType.Error, code: ErrorCode.RoomFull, message: 'x' });
    socket.onclose?.();
    expect(connection.getState().errorText).toBe('This room is full.');
  });

  it('ignores anything that arrives after a failure', () => {
    const { connection, sent, receive } = setup();
    receive({ type: MessageType.Error, code: ErrorCode.RoomFull, message: 'x' });
    receive(roomState);
    receive({ type: MessageType.Ping, timestampMs: 1 });
    expect(connection.getState().status).toBe('failed');
    expect(sent).toEqual([]);
  });
});

describe('dispose', () => {
  it('closes the socket and stays quiet afterwards', () => {
    const { connection, socket } = setup();
    const listener = vi.fn();
    connection.subscribe(listener);
    const onclose = socket.onclose;
    connection.dispose();
    expect(socket.close).toHaveBeenCalled();
    expect(socket.onclose).toBeNull();
    expect(onclose).not.toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });
});
