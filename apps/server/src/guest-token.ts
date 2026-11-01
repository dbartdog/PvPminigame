import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

function sign(playerId: string, secret: string): string {
  return createHmac('sha256', secret).update(playerId).digest('base64url');
}

export interface GuestIdentity {
  readonly playerId: string;
  readonly deviceToken: string;
}

export function issueGuestIdentity(secret: string): GuestIdentity {
  const playerId = randomUUID();
  return { playerId, deviceToken: `${playerId}.${sign(playerId, secret)}` };
}

/** Returns the player the token was issued to, or null if it wasn't signed by this server. */
export function verifyDeviceToken(deviceToken: string, secret: string): string | null {
  const separator = deviceToken.lastIndexOf('.');
  if (separator <= 0) return null;
  const playerId = deviceToken.slice(0, separator);
  const given = Buffer.from(deviceToken.slice(separator + 1));
  const expected = Buffer.from(sign(playerId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? playerId : null;
}
