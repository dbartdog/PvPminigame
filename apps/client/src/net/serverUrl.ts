export type PageLocation = Pick<Location, 'protocol' | 'host' | 'search'>;

/** The one place that picks the game server's WebSocket address. */
export function serverUrl(location: PageLocation): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}/ws`;
}
