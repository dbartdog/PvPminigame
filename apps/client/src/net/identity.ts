const TOKEN_KEY = 'pvp.deviceToken';
const NAME_KEY = 'pvp.name';

export const MAX_NAME_LENGTH = 20;

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Reading localStorage can throw in private windows or with site data blocked. */
function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(key: string, store: KeyValueStore | null): string {
  try {
    return store?.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string, store: KeyValueStore | null): void {
  try {
    store?.setItem(key, value);
  } catch {
    // Guest play still works; the player just gets a new identity next visit.
  }
}

export function loadDeviceToken(store = browserStore()): string {
  return read(TOKEN_KEY, store);
}

export function saveDeviceToken(token: string, store = browserStore()): void {
  write(TOKEN_KEY, token, store);
}

export function loadName(store = browserStore()): string {
  return read(NAME_KEY, store);
}

export function saveName(name: string, store = browserStore()): void {
  write(NAME_KEY, name, store);
}

export function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

export function guestName(random: () => number = Math.random): string {
  return `Guest ${1000 + Math.floor(random() * 9000)}`;
}
