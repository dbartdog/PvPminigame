const ROOM_CODE = /^[A-Za-z0-9_-]{4,32}$/;
const ROOM_PATH = /^\/r\/([^/]+)\/?$/;

export function isRoomCode(value: unknown): value is string {
  return typeof value === 'string' && ROOM_CODE.test(value);
}

/** Returns the code from a /r/<code> path, or null for any other page. */
export function parseRoomCode(pathname: string): string | null {
  const code = ROOM_PATH.exec(pathname)?.[1];
  return isRoomCode(code) ? code : null;
}

export function roomPath(code: string): string {
  return `/r/${code}`;
}

export function roomLink(origin: string, code: string): string {
  return `${origin}${roomPath(code)}`;
}
