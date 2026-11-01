import { afterEach, describe, expect, it, vi } from 'vitest';
import { chaosSearch, serverUrl } from './serverUrl';

const devPage = { protocol: 'http:', host: 'localhost:5173' };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('serverUrl', () => {
  it('uses ws on a plain http page', () => {
    expect(serverUrl({ protocol: 'http:', host: 'localhost:5173', search: '' })).toBe(
      'ws://localhost:5173/ws',
    );
  });

  it('uses wss on an https page, because browsers block ws there', () => {
    expect(serverUrl({ protocol: 'https:', host: 'example.test', search: '' })).toBe(
      'wss://example.test/ws',
    );
  });

  it('routes through the chaos proxy with ?chaos=1 in development', () => {
    expect(serverUrl({ ...devPage, search: '?chaos=1' })).toBe('ws://localhost:3002/ws');
  });

  it.each(['?chaos=0', '?chaos', '?other=1'])('ignores %s', (search) => {
    expect(serverUrl({ ...devPage, search })).toBe('ws://localhost:5173/ws');
  });

  it('ignores ?chaos=1 in a production build', () => {
    vi.stubEnv('DEV', false);
    expect(serverUrl({ protocol: 'https:', host: 'example.test', search: '?chaos=1' })).toBe(
      'wss://example.test/ws',
    );
  });
});

describe('chaosSearch', () => {
  it('keeps the flag in development', () => {
    expect(chaosSearch({ search: '?chaos=1' })).toBe('?chaos=1');
  });

  it('keeps nothing else from the query string', () => {
    expect(chaosSearch({ search: '?utm=1' })).toBe('');
  });

  it('is always empty in a production build', () => {
    vi.stubEnv('DEV', false);
    expect(chaosSearch({ search: '?chaos=1' })).toBe('');
  });
});
