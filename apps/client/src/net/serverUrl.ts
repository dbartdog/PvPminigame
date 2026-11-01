export type PageLocation = Pick<Location, 'protocol' | 'host' | 'search'>;

/** The one place that picks the game server's WebSocket address. */
export function serverUrl(location: PageLocation): string {
  // Tested inline so the bundler removes this branch and its URL from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('chaos') === '1') {
    return 'ws://localhost:3002/ws';
  }
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}/ws`;
}

/** Keeps a chaos session under chaos across the jump to a room, and in the link a friend opens. */
export function chaosSearch(location: Pick<Location, 'search'>): string {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('chaos') === '1') {
    return '?chaos=1';
  }
  return '';
}
