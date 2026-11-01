import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, DEFAULT_PROFILE, DEFAULT_TARGET, loadConfig } from './profile';

describe('loadConfig', () => {
  it('uses the agreed defaults', () => {
    expect(loadConfig({}, 7)).toEqual({
      port: DEFAULT_PORT,
      target: DEFAULT_TARGET,
      profile: DEFAULT_PROFILE,
      seed: 7,
    });
    expect(DEFAULT_PROFILE).toEqual({ latencyMs: 50, jitterMs: 10, lossRate: 0.02 });
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig(
      {
        CHAOS_PORT: '4000',
        CHAOS_TARGET: 'ws://localhost:9/ws',
        CHAOS_LATENCY_MS: '50',
        CHAOS_JITTER_MS: '5',
        CHAOS_LOSS_PERCENT: '10',
        CHAOS_SEED: '3',
      },
      7,
    );
    expect(config).toEqual({
      port: 4000,
      target: 'ws://localhost:9/ws',
      profile: { latencyMs: 50, jitterMs: 5, lossRate: 0.1 },
      seed: 3,
    });
  });

  it('accepts zero, to switch one effect off', () => {
    expect(loadConfig({ CHAOS_LOSS_PERCENT: '0' }, 1).profile.lossRate).toBe(0);
  });

  it.each([
    ['CHAOS_LATENCY_MS', 'fast'],
    ['CHAOS_JITTER_MS', '-1'],
    ['CHAOS_LOSS_PERCENT', '101'],
    ['CHAOS_PORT', '70000'],
  ])('rejects %s=%s with a clear error', (name, value) => {
    expect(() => loadConfig({ [name]: value }, 1)).toThrow(name);
  });
});
