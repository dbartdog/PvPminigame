import { encodeMessage, MessageType } from '@pvp/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import type { ChaosProfile } from './profile';
import { startChaosProxy, type ChaosProxy } from './proxy';

const NO_CHAOS: ChaosProfile = { latencyMs: 0, jitterMs: 0, lossRate: 0 };

const ping = (timestampMs: number): Uint8Array =>
  encodeMessage({ type: MessageType.Ping, timestampMs });
const roomState = encodeMessage({ type: MessageType.RoomState, code: 'ABC', players: [] });

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

function startServer(onConnection: (socket: WebSocket) => void): Promise<number> {
  const server = new WebSocketServer({ host: 'localhost', port: 0 });
  server.on('connection', onConnection);
  cleanups.push(() => {
    for (const client of server.clients) client.terminate();
    server.close();
  });
  return new Promise((resolve) => {
    server.once('listening', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function startEcho(): Promise<number> {
  return startServer((socket) => {
    socket.on('message', (data, isBinary) => socket.send(data, { binary: isBinary }));
  });
}

async function startProxy(serverPort: number, profile: ChaosProfile): Promise<ChaosProxy> {
  const proxy = await startChaosProxy({
    port: 0,
    target: `ws://localhost:${serverPort}`,
    profile,
    seed: 1,
  });
  cleanups.push(() => proxy.close());
  return proxy;
}

function connect(proxy: ChaosProxy): WebSocket {
  const socket = new WebSocket(`ws://localhost:${proxy.port}/ws`);
  cleanups.push(() => socket.terminate());
  return socket;
}

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => socket.once('open', () => resolve()));
}

function nextMessage(socket: WebSocket): Promise<Buffer> {
  return new Promise((resolve) => socket.once('message', (data) => resolve(data as Buffer)));
}

function closed(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    socket.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

describe('chaos proxy', () => {
  it('forwards frames both ways, unchanged', async () => {
    const proxy = await startProxy(await startEcho(), NO_CHAOS);
    const socket = connect(proxy);
    await opened(socket);
    socket.send(roomState);
    expect(new Uint8Array(await nextMessage(socket))).toEqual(roomState);
  });

  it('delivers frames sent before the server connection has opened', async () => {
    const proxy = await startProxy(await startEcho(), NO_CHAOS);
    const socket = connect(proxy);
    const reply = nextMessage(socket);
    socket.once('open', () => socket.send(roomState));
    expect(new Uint8Array(await reply)).toEqual(roomState);
  });

  it('adds the latency in each direction', async () => {
    const proxy = await startProxy(await startEcho(), { ...NO_CHAOS, latencyMs: 40 });
    const socket = connect(proxy);
    await opened(socket);
    const start = performance.now();
    socket.send(roomState);
    await nextMessage(socket);
    expect(performance.now() - start).toBeGreaterThanOrEqual(78);
  });

  it('drops only droppable frames', async () => {
    const proxy = await startProxy(await startEcho(), { ...NO_CHAOS, lossRate: 1 });
    const socket = connect(proxy);
    await opened(socket);
    const received: Buffer[] = [];
    socket.on('message', (data) => received.push(data as Buffer));
    socket.send(ping(1));
    socket.send(roomState);
    socket.send(ping(2));
    await closedAfter(socket, 60);
    expect(received.map((data) => data[0])).toEqual([MessageType.RoomState]);
  });

  it('keeps frames in order under heavy jitter', async () => {
    const proxy = await startProxy(await startEcho(), {
      latencyMs: 15,
      jitterMs: 15,
      lossRate: 0,
    });
    const socket = connect(proxy);
    await opened(socket);
    const received: number[] = [];
    const total = 300;
    const done = new Promise<void>((resolve) => {
      socket.on('message', (data: Buffer) => {
        received.push(data.readUInt16LE(1));
        if (received.length === total) resolve();
      });
    });
    for (let i = 0; i < total; i++) {
      const frame = Buffer.alloc(3);
      frame.writeUInt8(MessageType.RoomState, 0);
      frame.writeUInt16LE(i, 1);
      socket.send(frame);
    }
    await done;
    expect(received).toEqual([...Array(total).keys()]);
  });

  it('delivers a last message before passing on the close', async () => {
    const port = await startServer((socket) => {
      socket.send(roomState);
      socket.close(4000, 'Room full');
    });
    const proxy = await startProxy(port, { ...NO_CHAOS, latencyMs: 20 });
    const socket = connect(proxy);
    const message = nextMessage(socket);
    const close = closed(socket);
    expect(new Uint8Array(await message)).toEqual(roomState);
    expect(await close).toEqual({ code: 4000, reason: 'Room full' });
  });

  it('closes the server side when the client leaves', async () => {
    let serverClosed: Promise<unknown> = Promise.resolve();
    const port = await startServer((socket) => {
      serverClosed = closed(socket);
    });
    const proxy = await startProxy(port, NO_CHAOS);
    const socket = connect(proxy);
    await opened(socket);
    await new Promise((resolve) => setTimeout(resolve, 20));
    socket.close(1000);
    await expect(serverClosed).resolves.toBeDefined();
  });

  it('closes the client clearly when the server is down', async () => {
    const proxy = await startProxy(1, NO_CHAOS);
    const socket = connect(proxy);
    expect(await closed(socket)).toEqual({
      code: 1011,
      reason: 'Chaos proxy could not reach the server',
    });
  });
});

function closedAfter(socket: WebSocket, ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      socket.close();
      resolve();
    }, ms);
  });
}
