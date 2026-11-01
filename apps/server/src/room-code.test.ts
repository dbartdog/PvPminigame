import { describe, expect, it } from 'vitest';
import { generateRoomCode } from './room-code';

describe('generateRoomCode', () => {
  it('gives short, URL-safe codes with no ambiguous characters', () => {
    for (let i = 0; i < 1_000; i++) {
      expect(generateRoomCode()).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    }
  });
});
