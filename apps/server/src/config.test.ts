import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('defaults to port 3001 with a dev secret outside production', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3001);
    expect(config.guestTokenSecret).not.toBe('');
  });

  it('reads PORT and GUEST_TOKEN_SECRET', () => {
    expect(loadConfig({ PORT: '4000', GUEST_TOKEN_SECRET: 'abc' })).toEqual({
      port: 4000,
      guestTokenSecret: 'abc',
    });
  });

  it.each(['abc', '-1', '70000', '1.5'])('rejects PORT %s', (PORT) => {
    expect(() => loadConfig({ PORT })).toThrow('PORT');
  });

  it('refuses to start in production without a secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('GUEST_TOKEN_SECRET');
    expect(() => loadConfig({ NODE_ENV: 'production', GUEST_TOKEN_SECRET: '' })).toThrow(
      'GUEST_TOKEN_SECRET',
    );
  });

  it('starts in production with a secret', () => {
    expect(loadConfig({ NODE_ENV: 'production', GUEST_TOKEN_SECRET: 's' }).guestTokenSecret).toBe(
      's',
    );
  });
});
