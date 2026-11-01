import { describe, expect, it } from 'vitest';
import { formatMs, summarizeFrames } from './frameStats';

describe('summarizeFrames', () => {
  it('averages over the whole sample', () => {
    expect(summarizeFrames([10, 20, 30, 40])).toEqual({ fps: 40, frameMs: 25 });
  });

  it('copes with no frames', () => {
    expect(summarizeFrames([])).toEqual({ fps: 0, frameMs: 0 });
  });
});

describe('formatMs', () => {
  it('rounds to whole milliseconds', () => {
    expect(formatMs(16.7)).toBe('17 ms');
  });

  it('shows a dash for an unknown value', () => {
    expect(formatMs(null)).toBe('–');
  });
});
