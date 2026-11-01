export interface ChaosProfile {
  /** Added to every frame in each direction, so the round trip grows by about twice this. */
  readonly latencyMs: number;
  /** Each frame's delay varies by up to this much either side of latencyMs. */
  readonly jitterMs: number;
  /** Chance from 0 to 1 that a droppable frame is lost. */
  readonly lossRate: number;
}

export interface ChaosConfig {
  readonly port: number;
  readonly target: string;
  readonly profile: ChaosProfile;
  readonly seed: number;
}

export const DEFAULT_PROFILE: ChaosProfile = { latencyMs: 100, jitterMs: 20, lossRate: 0.02 };
export const DEFAULT_PORT = 3002;
export const DEFAULT_TARGET = 'ws://localhost:3001/ws';

type Env = Readonly<Record<string, string | undefined>>;

function readNumber(env: Env, name: string, fallback: number, max = Infinity): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${name} must be a number from 0 to ${max}, got "${raw}"`);
  }
  return value;
}

export function loadConfig(env: Env, fallbackSeed: number): ChaosConfig {
  return {
    port: readNumber(env, 'CHAOS_PORT', DEFAULT_PORT, 65535),
    target: env.CHAOS_TARGET || DEFAULT_TARGET,
    profile: {
      latencyMs: readNumber(env, 'CHAOS_LATENCY_MS', DEFAULT_PROFILE.latencyMs),
      jitterMs: readNumber(env, 'CHAOS_JITTER_MS', DEFAULT_PROFILE.jitterMs),
      lossRate: readNumber(env, 'CHAOS_LOSS_PERCENT', DEFAULT_PROFILE.lossRate * 100, 100) / 100,
    },
    seed: readNumber(env, 'CHAOS_SEED', fallbackSeed),
  };
}
