import { describe, expect, it } from 'vitest';
import { advanceTimestep, createTimestep } from './timestep';

describe('fixed timestep', () => {
  it('runs no ticks until a full step has passed', () => {
    const { steps, timestep } = advanceTimestep(createTimestep(10), 99);
    expect(steps).toBe(0);
    expect(timestep.carryMs).toBe(99);
  });

  it('carries leftover time into the next advance', () => {
    const first = advanceTimestep(createTimestep(10), 150);
    const second = advanceTimestep(first.timestep, 50);
    expect(first.steps).toBe(1);
    expect(second.steps).toBe(1);
  });

  it('gives the same tick count however time is sliced across frame rates', () => {
    const countTicks = (frameMs: number): number => {
      let timestep = createTimestep(60);
      let total = 0;
      for (let elapsed = 0; elapsed < 10_000; elapsed += frameMs) {
        const advance = advanceTimestep(timestep, frameMs);
        timestep = advance.timestep;
        total += advance.steps;
      }
      return total;
    };
    expect(Math.abs(countTicks(1000 / 30) - 600)).toBeLessThanOrEqual(1);
    expect(Math.abs(countTicks(1000 / 144) - 600)).toBeLessThanOrEqual(1);
  });

  it('drops the backlog after a long stall', () => {
    const { steps, timestep } = advanceTimestep(createTimestep(60, 5), 10_000);
    expect(steps).toBe(5);
    expect(timestep.carryMs).toBe(0);
  });

  it('ignores a clock that moves backwards', () => {
    const { steps, timestep } = advanceTimestep(createTimestep(60), -500);
    expect(steps).toBe(0);
    expect(timestep.carryMs).toBe(0);
  });
});
