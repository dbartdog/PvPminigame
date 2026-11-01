import {
  MessageType,
  PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
  type Message,
} from '@pvp/protocol';
import {
  applyClose,
  applyMessage,
  initialConnectionState,
  type ConnectionState,
} from './connectionState';

/** The parts of WebSocket used here, so tests can pass a fake. */
export interface SocketLike {
  binaryType: BinaryType;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  send(data: Uint8Array<ArrayBuffer>): void;
  close(): void;
}

export interface ConnectionOptions {
  readonly createSocket: () => SocketLike;
  readonly name: string;
  readonly deviceToken: string;
  readonly roomCode: string;
  readonly onDeviceToken: (token: string) => void;
  readonly nowMs?: () => number;
}

export interface Connection {
  getState(): ConnectionState;
  /** Calls back on changes the UI shows. Snapshots are excluded: polling getState is cheaper. */
  subscribe(listener: () => void): () => void;
  sendInput(tick: number, payload: Uint8Array): void;
  dispose(): void;
}

function byteMessage(data: unknown): Uint8Array | null {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : null;
}

export function createConnection(options: ConnectionOptions): Connection {
  const nowMs = options.nowMs ?? (() => performance.now());
  const listeners = new Set<() => void>();
  const socket = options.createSocket();
  let state = initialConnectionState;

  function send(message: Message): void {
    socket.send(encodeMessage(message) as Uint8Array<ArrayBuffer>);
  }

  function setState(next: ConnectionState, notify: boolean): void {
    state = next;
    if (notify) listeners.forEach((listener) => listener());
  }

  function respond(message: Message): void {
    if (message.type === MessageType.Welcome) {
      options.onDeviceToken(message.deviceToken);
      send({ type: MessageType.JoinRoom, code: options.roomCode });
    } else if (message.type === MessageType.Ping) {
      send({ type: MessageType.Pong, timestampMs: message.timestampMs });
    }
  }

  function receive(message: Message): void {
    if (state.status === 'failed') return;
    const next = applyMessage(state, message, nowMs());
    setState(next, message.type !== MessageType.Snapshot);
    if (next.status === 'failed') {
      socket.close();
      return;
    }
    respond(message);
  }

  function handleData(data: unknown): void {
    const bytes = byteMessage(data);
    if (!bytes) return;
    const result = decodeMessage(bytes);
    if (result.ok) receive(result.message);
    else console.warn('Ignored an unreadable message', result.error.message);
  }

  function clearHandlers(): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
  }

  socket.binaryType = 'arraybuffer';
  socket.onopen = () => {
    send({
      type: MessageType.Hello,
      protocolVersion: PROTOCOL_VERSION,
      deviceToken: options.deviceToken,
      name: options.name,
    });
  };
  socket.onmessage = (event) => handleData(event.data);
  socket.onclose = () => setState(applyClose(state), true);

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendInput(tick, payload) {
      if (state.status === 'joined') send({ type: MessageType.Input, tick, payload });
    },
    dispose() {
      clearHandlers();
      listeners.clear();
      socket.close();
    },
  };
}
