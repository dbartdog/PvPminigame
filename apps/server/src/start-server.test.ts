import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ErrorCode,
  MessageType,
  PROTOCOL_VERSION,
  decodeMessage,
  decodeToySnapshot,
  encodeMessage,
  encodeToyInput,
  type Message,
} from '@pvp/protocol';
import { startServer, type RunningServer } from './start-server';

/** These tests use real sockets on a real port, covering what game-server.test.ts can't. */
const WAIT_LIMIT_MS = 4000;

interface TestClient {
  socket: WebSocket;
  received: Message[];
  isClosed(): boolean;
  say(message: Message): void;
  waitFor<T>(find: (messages: Message[]) => T | undefined): Promise<T>;
}

let server: RunningServer;
let httpUrl: string;
let wsUrl: string;
const openClients: TestClient[] = [];

function connect(): Promise<TestClient> {
  const socket = new WebSocket(wsUrl);
  socket.binaryType = 'arraybuffer';
  const received: Message[] = [];
  let closed = false;
  socket.addEventListener('close', () => (closed = true));
  socket.addEventListener('message', (event) => {
    const result = decodeMessage(event.data as ArrayBuffer);
    if (!result.ok) throw new Error('Server sent an unreadable message');
    if (result.message.type === MessageType.Ping) {
      socket.send(
        encodeMessage({ type: MessageType.Pong, timestampMs: result.message.timestampMs }),
      );
    }
    received.push(result.message);
  });

  const client: TestClient = {
    socket,
    received,
    isClosed: () => closed,
    say: (message) => socket.send(encodeMessage(message)),
    async waitFor(find) {
      const deadline = Date.now() + WAIT_LIMIT_MS;
      while (Date.now() < deadline) {
        const found = find(received);
        if (found !== undefined) return found;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('Timed out waiting for a message');
    },
  };
  openClients.push(client);
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(client));
    socket.addEventListener('error', () => reject(new Error('Socket failed')));
  });
}

async function createRoom(): Promise<string> {
  const response = await fetch(`${httpUrl}/rooms`, { method: 'POST' });
  expect(response.status).toBe(201);
  const { code } = (await response.json()) as { code: string };
  return code;
}

async function joinAs(name: string, code: string): Promise<TestClient> {
  const client = await connect();
  client.say({
    type: MessageType.Hello,
    protocolVersion: PROTOCOL_VERSION,
    deviceToken: '',
    name,
  });
  await client.waitFor((messages) => messages.find((m) => m.type === MessageType.Welcome));
  client.say({ type: MessageType.JoinRoom, code });
  return client;
}

function errorIn(messages: Message[]): Extract<Message, { type: 9 }> | undefined {
  return messages.find((m) => m.type === MessageType.Error);
}

beforeAll(async () => {
  server = await startServer({ port: 0, guestTokenSecret: 'test-secret' });
  httpUrl = `http://127.0.0.1:${server.port}`;
  wsUrl = `ws://127.0.0.1:${server.port}/ws`;
});

afterAll(() => {
  for (const client of openClients) client.socket.close();
  server.stop();
});

describe('HTTP', () => {
  it('reports health', async () => {
    const response = await fetch(`${httpUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('creates a room with a short URL-safe code', async () => {
    expect(await createRoom()).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
  });

  it('returns 404 for anything else, with no wildcard CORS', async () => {
    const response = await fetch(`${httpUrl}/nope`);
    expect(response.status).toBe(404);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('two players over real sockets', () => {
  it('see each other by name and RTT, and get live snapshots', async () => {
    const code = await createRoom();
    const ada = await joinAs('Ada', code);
    const grace = await joinAs('Grace', code);

    const seesBoth = (messages: Message[]): true | undefined =>
      messages.some(
        (m) =>
          m.type === MessageType.RoomState &&
          m.players.length === 2 &&
          m.players.every((player) => player.rttMs !== null),
      ) || undefined;
    await ada.waitFor(seesBoth);
    await grace.waitFor(seesBoth);

    ada.say({ type: MessageType.Input, tick: 0, payload: encodeToyInput({ x: 1, y: 0 }) });
    const moved = await grace.waitFor((messages) =>
      messages.find((m) => {
        if (m.type !== MessageType.Snapshot) return false;
        return (decodeToySnapshot(m.payload)?.dots[0].x ?? 0) > 0;
      }),
    );
    expect(moved).toBeDefined();
  });

  it('turns a third player away and keeps their socket usable', async () => {
    const code = await createRoom();
    await joinAs('Ada', code);
    await joinAs('Grace', code);
    const third = await joinAs('Linus', code);

    const error = await third.waitFor(errorIn);
    expect(error.code).toBe(ErrorCode.RoomFull);
    expect(third.isClosed()).toBe(false);
  });

  it('removes a player whose socket closes', async () => {
    const code = await createRoom();
    const ada = await joinAs('Ada', code);
    const grace = await joinAs('Grace', code);
    await ada.waitFor((messages) =>
      messages.find((m) => m.type === MessageType.RoomState && m.players.length === 2),
    );
    ada.received.length = 0;
    grace.socket.close();
    await ada.waitFor((messages) =>
      messages.find((m) => m.type === MessageType.RoomState && m.players.length === 1),
    );
  });
});

describe('bad clients over real sockets', () => {
  it('sends a version mismatch Error, then closes', async () => {
    const client = await connect();
    client.say({
      type: MessageType.Hello,
      protocolVersion: PROTOCOL_VERSION + 1,
      deviceToken: '',
      name: 'Old',
    });
    const error = await client.waitFor(errorIn);
    expect(error.code).toBe(ErrorCode.VersionMismatch);
    await client.waitFor((messages) => (client.isClosed() ? messages : undefined));
  });

  it('survives garbage frames', async () => {
    const client = await connect();
    client.socket.send(new Uint8Array([200, 1, 2]));
    client.socket.send('not binary at all');
    const error = await client.waitFor(errorIn);
    expect(error.code).toBe(ErrorCode.MalformedMessage);
    const response = await fetch(`${httpUrl}/health`);
    expect(response.status).toBe(200);
  });

  it('drops a connection sending an oversized frame', async () => {
    const client = await connect();
    client.socket.send(new Uint8Array(64 * 1024));
    await client.waitFor((messages) => (client.isClosed() ? messages : undefined));
    expect((await fetch(`${httpUrl}/health`)).status).toBe(200);
  });
});
