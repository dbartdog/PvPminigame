import { randomInt } from 'node:crypto';
import uWS from 'uWebSockets.js';
import { TICK_RATE_HZ } from '@pvp/sim';
import type { Config } from './config';
import { createGameServer, type Peer, type Session } from './game-server';
import { generateRoomCode } from './room-code';

/** Hello is the largest client message: a device token plus a name. Oversized frames are dropped. */
const MAX_FRAME_BYTES = 1024;
const SOCKET_IDLE_TIMEOUT_SECONDS = 32;
const MAX_SEED = 2 ** 32;
const ADVANCE_INTERVAL_MS = Math.floor(1000 / TICK_RATE_HZ);

interface SocketData {
  session?: Session;
  markClosed?: () => void;
}

export interface RunningServer {
  readonly port: number;
  stop(): void;
}

function createPeer(socket: uWS.WebSocket<SocketData>): Peer & { markClosed(): void } {
  // Touching a uWS socket after it closes is a crash, not an exception.
  let open = true;
  return {
    send(bytes) {
      if (open) socket.send(bytes, true);
    },
    close() {
      if (!open) return;
      open = false;
      socket.end();
    },
    markClosed() {
      open = false;
    },
  };
}

function sendJson(res: uWS.HttpResponse, status: string, body: unknown): void {
  res.writeStatus(status).writeHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export function startServer(config: Config): Promise<RunningServer> {
  const gameServer = createGameServer({
    guestTokenSecret: config.guestTokenSecret,
    now: () => performance.now(),
    generateCode: generateRoomCode,
    generateSeed: () => randomInt(MAX_SEED),
  });

  const app = uWS
    .App()
    .get('/health', (res) => sendJson(res, '200 OK', { status: 'ok' }))
    .post('/rooms', (res) => {
      const code = gameServer.createRoom();
      if (code) sendJson(res, '201 Created', { code });
      else sendJson(res, '503 Service Unavailable', { error: "We're full. Try again soon." });
    })
    .ws<SocketData>('/ws', {
      maxPayloadLength: MAX_FRAME_BYTES,
      idleTimeout: SOCKET_IDLE_TIMEOUT_SECONDS,
      open(socket) {
        const peer = createPeer(socket);
        const data = socket.getUserData();
        data.session = gameServer.connect(peer);
        data.markClosed = peer.markClosed;
      },
      message(socket, message) {
        const { session } = socket.getUserData();
        if (session) gameServer.receive(session, message);
      },
      close(socket) {
        const { session, markClosed } = socket.getUserData();
        markClosed?.();
        if (session) gameServer.disconnect(session);
      },
    })
    .any('/*', (res) => sendJson(res, '404 Not Found', { error: 'Not found' }));

  return new Promise((resolve, reject) => {
    app.listen(config.port, (listenSocket) => {
      if (!listenSocket) {
        reject(new Error(`Couldn't listen on port ${config.port}`));
        return;
      }
      const interval = setInterval(gameServer.advance, ADVANCE_INTERVAL_MS);
      resolve({
        port: uWS.us_socket_local_port(listenSocket),
        stop() {
          clearInterval(interval);
          app.close();
        },
      });
    });
  });
}
