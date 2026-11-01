export interface Config {
  readonly port: number;
  readonly guestTokenSecret: string;
}

const DEFAULT_PORT = 3001;
const MAX_PORT = 65535;
const DEV_GUEST_TOKEN_SECRET = 'dev-only-guest-token-secret';

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > MAX_PORT) {
    throw new Error(`PORT must be a whole number from 0 to ${MAX_PORT}, got "${value}"`);
  }
  return port;
}

function parseGuestTokenSecret(env: NodeJS.ProcessEnv): string {
  if (env.GUEST_TOKEN_SECRET) return env.GUEST_TOKEN_SECRET;
  if (env.NODE_ENV === 'production') {
    throw new Error('GUEST_TOKEN_SECRET is required in production');
  }
  return DEV_GUEST_TOKEN_SECRET;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return { port: parsePort(env.PORT), guestTokenSecret: parseGuestTokenSecret(env) };
}
