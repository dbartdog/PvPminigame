import { isRoomCode } from './roomCode';

const CREATE_FAILED = "Couldn't create a room. Try again.";

export class CreateRoomError extends Error {
  constructor() {
    super(CREATE_FAILED);
  }
}

async function readRoomCode(response: Response): Promise<string> {
  const body = (await response.json()) as { code?: unknown };
  if (!isRoomCode(body.code)) throw new CreateRoomError();
  return body.code;
}

export async function createRoom(fetchFn: typeof fetch = fetch): Promise<string> {
  try {
    const response = await fetchFn('/rooms', { method: 'POST' });
    if (!response.ok) throw new CreateRoomError();
    return await readRoomCode(response);
  } catch {
    throw new CreateRoomError();
  }
}
