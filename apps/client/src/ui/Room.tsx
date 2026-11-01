import type { RoomPlayer } from '@pvp/protocol';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { createConnection, type Connection, type SocketLike } from '../net/connection';
import { opponent, ownPlayer, type ConnectionState } from '../net/connectionState';
import { guestName, loadDeviceToken, loadName, saveDeviceToken, saveName } from '../net/identity';
import { roomLink } from '../net/roomCode';
import { chaosSearch, serverUrl } from '../net/serverUrl';
import { DebugOverlay } from './DebugOverlay';
import { formatMs } from './frameStats';
import { SceneCanvas } from './SceneCanvas';
import { useInputSender } from './useInputSender';

const COPIED_MS = 2000;

function displayName(): string {
  const name = loadName() || guestName();
  saveName(name);
  return name;
}

function connect(code: string): Connection {
  return createConnection({
    createSocket: () => new WebSocket(serverUrl(window.location)) as unknown as SocketLike,
    name: displayName(),
    deviceToken: loadDeviceToken(),
    roomCode: code,
    onDeviceToken: saveDeviceToken,
  });
}

function useConnectionState(connection: Connection): ConnectionState {
  const [state, setState] = useState(connection.getState);

  useEffect(() => {
    setState(connection.getState());
    return connection.subscribe(() => setState(connection.getState()));
  }, [connection]);

  return state;
}

function CopyLink({ link }: { link: string }) {
  const [isCopied, setIsCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_MS);
    } catch {
      // The link stays visible in the field below for copying by hand.
    }
  }

  return (
    <>
      <button type="button" onClick={copy}>
        {isCopied ? 'Copied!' : 'Copy link'}
      </button>
      <label>
        Your challenge link
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          data-testid="room-link"
        />
      </label>
    </>
  );
}

function PlayerRow({ player, label }: { player: RoomPlayer; label: string }) {
  return (
    <li class="player">
      <span>
        {player.name} <span class="muted">{label}</span>
      </span>
      <span class="muted">{formatMs(player.rttMs)}</span>
    </li>
  );
}

function Lobby({ state, link }: { state: ConnectionState; link: string }) {
  const self = ownPlayer(state);
  const rival = opponent(state);

  return (
    <main class="screen">
      <h1>{rival ? `${rival.name} is here!` : 'Waiting for your friend…'}</h1>
      {!rival && <CopyLink link={link} />}
      <ul class="players">
        {self && <PlayerRow player={self} label="(you)" />}
        {rival && <PlayerRow player={rival} label="" />}
      </ul>
    </main>
  );
}

function Failure({ text, onRetry }: { text: string | null; onRetry: () => void }) {
  return (
    <main class="screen">
      <h1>Not connected</h1>
      <p class="error" role="alert">
        {text}
      </p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
      <a class="button" href="/">
        Back home
      </a>
    </main>
  );
}

function Joined({ connection, state, link }: JoinedProps) {
  useInputSender(connection);

  return (
    <>
      <SceneCanvas />
      <Lobby state={state} link={link} />
      <DebugOverlay connection={connection} />
    </>
  );
}

interface JoinedProps {
  readonly connection: Connection;
  readonly state: ConnectionState;
  readonly link: string;
}

function ActiveRoom({ code, onRetry }: { code: string; onRetry: () => void }) {
  const connection = useMemo(() => connect(code), [code]);
  const state = useConnectionState(connection);

  useEffect(() => () => connection.dispose(), [connection]);

  if (state.status === 'failed') return <Failure text={state.errorText} onRetry={onRetry} />;
  if (state.status === 'joined') {
    return (
      <Joined
        connection={connection}
        state={state}
        link={roomLink(window.location.origin, code) + chaosSearch(window.location)}
      />
    );
  }
  return (
    <main class="screen">
      <h1>Joining…</h1>
    </main>
  );
}

/** Changing the key rebuilds ActiveRoom, which gives Try again a fresh connection. */
export function Room({ code }: { code: string }) {
  const [attempt, setAttempt] = useState(0);
  return <ActiveRoom key={attempt} code={code} onRetry={() => setAttempt(attempt + 1)} />;
}
