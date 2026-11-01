import { describe, expect, it } from 'vitest';
import { CreateRoomError, createRoom } from './rooms';

function respondWith(body: string, status: number): typeof fetch {
  return () => Promise.resolve(new Response(body, { status }));
}

describe('createRoom', () => {
  it('returns the code from a created room', async () => {
    await expect(createRoom(respondWith('{"code":"XK7P2M"}', 201))).resolves.toBe('XK7P2M');
  });

  it('posts to /rooms', async () => {
    const calls: [unknown, RequestInit | undefined][] = [];
    const fetchFn: typeof fetch = (url, init) => {
      calls.push([url, init]);
      return Promise.resolve(new Response('{"code":"XK7P2M"}', { status: 201 }));
    };
    await createRoom(fetchFn);
    expect(calls).toEqual([['/rooms', { method: 'POST' }]]);
  });

  it.each([
    ['a server error', respondWith('{"code":"XK7P2M"}', 500)],
    ['a body without a code', respondWith('{}', 201)],
    ['a body that is not JSON', respondWith('<html>', 201)],
    ['a network failure', () => Promise.reject(new TypeError('offline'))],
  ])('fails cleanly on %s', async (_name, fetchFn) => {
    await expect(createRoom(fetchFn)).rejects.toBeInstanceOf(CreateRoomError);
  });
});
