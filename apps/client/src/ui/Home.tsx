import { useState } from 'preact/hooks';
import { MAX_NAME_LENGTH, cleanName, guestName, loadName, saveName } from '../net/identity';
import { createRoom } from '../net/rooms';

export function Home({ onRoomCreated }: { onRoomCreated: (code: string) => void }) {
  const [name, setName] = useState(loadName);
  const [isCreating, setIsCreating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function challenge(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    setIsCreating(true);
    setErrorText(null);
    saveName(cleanName(name) || guestName());
    try {
      onRoomCreated(await createRoom());
    } catch (error) {
      setErrorText((error as Error).message);
      setIsCreating(false);
    }
  }

  return (
    <form class="screen" onSubmit={challenge}>
      <h1>PvP Minigame</h1>
      <p class="muted">Send a friend a link. Settle it in seconds.</p>
      <label>
        Your name
        <input
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Guest"
          autoComplete="off"
          onInput={(event) => setName(event.currentTarget.value)}
        />
      </label>
      <button type="submit" disabled={isCreating}>
        Challenge a friend
      </button>
      {errorText && (
        <p class="error" role="alert">
          {errorText}
        </p>
      )}
    </form>
  );
}
