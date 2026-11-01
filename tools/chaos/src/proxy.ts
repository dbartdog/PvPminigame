import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { createDelayLine } from './delayLine';
import type { ChaosConfig, ChaosProfile } from './profile';
import { createSeededRandom, messageTypeOf, shapeFrame, type RandomSource } from './shaper';

export interface ChaosProxy {
  readonly port: number;
  close(): Promise<void>;
}

type Outgoing =
  | { readonly kind: 'frame'; readonly data: Buffer; readonly isBinary: boolean }
  | { readonly kind: 'close'; readonly code: number; readonly reason: string };

interface Counters {
  forwarded: number;
  dropped: number;
}

const INTERNAL_ERROR_CLOSE = 1011;
const NO_STATUS_CLOSE = 1005;
const ABNORMAL_CLOSE = 1006;

function sendNow(socket: WebSocket, item: Outgoing): void {
  if (item.kind === 'frame') {
    if (socket.readyState === WebSocket.OPEN) socket.send(item.data, { binary: item.isBinary });
    return;
  }
  // These two codes describe a close with no code on the wire, so they can't be sent.
  const hasNoCode = item.code === NO_STATUS_CLOSE || item.code === ABNORMAL_CLOSE;
  if (hasNoCode) socket.close();
  else socket.close(item.code, item.reason);
}

function deliver(socket: WebSocket, item: Outgoing): void {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.once('open', () => sendNow(socket, item));
  } else {
    sendNow(socket, item);
  }
}

/**
 * Connects one direction of a link. Closes travel the same delay line as frames, or a server
 * sending an Error and then closing would lose the Error to its own close.
 */
function pipeDirection(
  from: WebSocket,
  to: WebSocket,
  profile: ChaosProfile,
  random: RandomSource,
  counters: Counters,
): void {
  const line = createDelayLine<Outgoing>(
    (item) => deliver(to, item),
    () => performance.now(),
  );
  let lastReleaseAtMs = 0;

  from.on('message', (raw: RawData, isBinary) => {
    // ws delivers a single Buffer unless binaryType is changed, which this proxy never does.
    const data = raw as Buffer;
    const shaped = shapeFrame(
      messageTypeOf(data, isBinary),
      performance.now(),
      lastReleaseAtMs,
      profile,
      random,
    );
    lastReleaseAtMs = shaped.lastReleaseAtMs;
    if (shaped.releaseAtMs === null) {
      counters.dropped++;
      return;
    }
    counters.forwarded++;
    line.push({ kind: 'frame', data, isBinary }, shaped.releaseAtMs);
  });

  from.on('close', (code, reason) => {
    const releaseAtMs = Math.max(performance.now(), lastReleaseAtMs);
    line.push({ kind: 'close', code, reason: reason.toString() }, releaseAtMs);
  });

  to.on('close', () => line.clear());
}

function linkClient(
  client: WebSocket,
  config: ChaosConfig,
  random: RandomSource,
  log: (line: string) => void,
): void {
  const upstream = new WebSocket(config.target, { perMessageDeflate: false });
  const counters: Counters = { forwarded: 0, dropped: 0 };

  pipeDirection(client, upstream, config.profile, random, counters);
  pipeDirection(upstream, client, config.profile, random, counters);

  client.on('error', () => client.terminate());
  upstream.on('error', (error) => {
    log(`Can't reach ${config.target}: ${error.message}`);
    client.close(INTERNAL_ERROR_CLOSE, 'Chaos proxy could not reach the server');
  });
  client.on('close', () => {
    log(`Connection closed: ${counters.forwarded} frames forwarded, ${counters.dropped} dropped`);
  });
}

function closeServer(server: WebSocketServer): Promise<void> {
  for (const client of server.clients) client.terminate();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function startChaosProxy(
  config: ChaosConfig,
  log: (line: string) => void = () => {},
): Promise<ChaosProxy> {
  const random = createSeededRandom(config.seed);
  const server = new WebSocketServer({ host: 'localhost', port: config.port, path: '/ws' });

  server.on('connection', (client) => linkClient(client, config, random, log));

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : config.port,
        close: () => closeServer(server),
      });
    });
  });
}
