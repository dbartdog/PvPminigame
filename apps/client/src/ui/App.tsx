import { useEffect, useState } from 'preact/hooks';
import { parseRoomCode, roomPath } from '../net/roomCode';
import { chaosSearch } from '../net/serverUrl';
import { Home } from './Home';
import { Room } from './Room';

function currentRoomCode(): string | null {
  return parseRoomCode(window.location.pathname);
}

export function App() {
  const [code, setCode] = useState(currentRoomCode);

  useEffect(() => {
    const syncWithUrl = (): void => setCode(currentRoomCode());
    window.addEventListener('popstate', syncWithUrl);
    return () => window.removeEventListener('popstate', syncWithUrl);
  }, []);

  function openRoom(newCode: string): void {
    window.history.pushState(null, '', roomPath(newCode) + chaosSearch(window.location));
    setCode(newCode);
  }

  return code ? <Room key={code} code={code} /> : <Home onRoomCreated={openRoom} />;
}
