import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDelayLine } from './delayLine';

describe('delay line', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delivers an item at its release time, not before', () => {
    const delivered: string[] = [];
    const line = createDelayLine<string>(
      (item) => delivered.push(item),
      () => Date.now(),
    );
    line.push('a', Date.now() + 100);
    vi.advanceTimersByTime(99);
    expect(delivered).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(delivered).toEqual(['a']);
  });

  it('delivers everything in push order, including items due at the same time', () => {
    const delivered: number[] = [];
    const line = createDelayLine<number>(
      (item) => delivered.push(item),
      () => Date.now(),
    );
    const start = Date.now();
    line.push(1, start + 50);
    line.push(2, start + 50);
    line.push(3, start + 80);
    line.push(4, start + 80);
    vi.advanceTimersByTime(100);
    expect(delivered).toEqual([1, 2, 3, 4]);
  });

  it('keeps going for items pushed from inside a delivery', () => {
    const delivered: string[] = [];
    const line = createDelayLine<string>(
      (item) => {
        delivered.push(item);
        if (item === 'first') line.push('second', Date.now() + 10);
      },
      () => Date.now(),
    );
    line.push('first', Date.now());
    vi.advanceTimersByTime(20);
    expect(delivered).toEqual(['first', 'second']);
  });

  it('delivers nothing after being cleared', () => {
    const delivered: string[] = [];
    const line = createDelayLine<string>(
      (item) => delivered.push(item),
      () => Date.now(),
    );
    line.push('a', Date.now() + 10);
    line.clear();
    vi.advanceTimersByTime(100);
    expect(delivered).toEqual([]);
  });
});
