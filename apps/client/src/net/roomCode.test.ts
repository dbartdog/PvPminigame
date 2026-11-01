import { describe, expect, it } from 'vitest';
import { parseRoomCode, roomLink } from './roomCode';

describe('parseRoomCode', () => {
  it.each([
    ['/r/XK7P2M', 'XK7P2M'],
    ['/r/XK7P2M/', 'XK7P2M'],
    ['/r/ab_c-1', 'ab_c-1'],
  ])('reads the code from %s', (path, code) => {
    expect(parseRoomCode(path)).toBe(code);
  });

  it.each(['/', '/r', '/r/', '/rooms', '/r/abc', '/r/XK7P2M/extra', '/x/XK7P2M', '/r/bad%20code'])(
    'finds no room in %s',
    (path) => {
      expect(parseRoomCode(path)).toBeNull();
    },
  );
});

describe('roomLink', () => {
  it('builds a link that parses back to the same code', () => {
    const link = roomLink('https://example.test', 'XK7P2M');
    expect(link).toBe('https://example.test/r/XK7P2M');
    expect(parseRoomCode(new URL(link).pathname)).toBe('XK7P2M');
  });
});
