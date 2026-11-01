import { describe, expect, it } from 'vitest';
import { serverUrl } from './serverUrl';

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
});
