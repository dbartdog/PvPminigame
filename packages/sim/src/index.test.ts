import { describe, expect, it } from 'vitest';
import { SNAPSHOT_RATE_HZ, TICK_RATE_HZ } from './index';

describe('tick rates', () => {
  it('sends snapshots on a whole number of ticks', () => {
    expect(TICK_RATE_HZ % SNAPSHOT_RATE_HZ).toBe(0);
  });
});
