import { describe, expect, it } from 'vitest';
import { issueGuestIdentity, verifyDeviceToken } from './guest-token';

const SECRET = 'test-secret';

describe('guest tokens', () => {
  it('verifies a token it issued, back to the same player', () => {
    const { playerId, deviceToken } = issueGuestIdentity(SECRET);
    expect(verifyDeviceToken(deviceToken, SECRET)).toBe(playerId);
  });

  it('gives each guest a different identity', () => {
    expect(issueGuestIdentity(SECRET).playerId).not.toBe(issueGuestIdentity(SECRET).playerId);
  });

  it('rejects a token signed with another secret', () => {
    const { deviceToken } = issueGuestIdentity('other-secret');
    expect(verifyDeviceToken(deviceToken, SECRET)).toBeNull();
  });

  it('rejects a token claiming a different player', () => {
    const { deviceToken } = issueGuestIdentity(SECRET);
    const signature = deviceToken.slice(deviceToken.lastIndexOf('.'));
    expect(verifyDeviceToken(`someone-else${signature}`, SECRET)).toBeNull();
  });

  it.each(['', '.', 'no-separator', '.signature-only', 'player.', 'player.bad'])(
    'rejects the malformed token "%s"',
    (token) => {
      expect(verifyDeviceToken(token, SECRET)).toBeNull();
    },
  );
});
