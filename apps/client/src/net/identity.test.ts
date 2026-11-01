import { describe, expect, it } from 'vitest';
import {
  MAX_NAME_LENGTH,
  cleanName,
  guestName,
  loadDeviceToken,
  loadName,
  saveDeviceToken,
  saveName,
  type KeyValueStore,
} from './identity';

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const brokenStore: KeyValueStore = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('stored identity', () => {
  it('remembers the token and name separately', () => {
    const store = memoryStore();
    saveDeviceToken('token.abc', store);
    saveName('Ada', store);
    expect(loadDeviceToken(store)).toBe('token.abc');
    expect(loadName(store)).toBe('Ada');
  });

  it('starts empty', () => {
    expect(loadDeviceToken(memoryStore())).toBe('');
    expect(loadName(memoryStore())).toBe('');
  });

  it('keeps working when storage is blocked', () => {
    expect(() => saveDeviceToken('token.abc', brokenStore)).not.toThrow();
    expect(loadDeviceToken(brokenStore)).toBe('');
  });

  it('keeps working with no storage at all', () => {
    expect(() => saveName('Ada', null)).not.toThrow();
    expect(loadName(null)).toBe('');
  });
});

describe('names', () => {
  it('trims and shortens a typed name', () => {
    expect(cleanName('  Ada  ')).toBe('Ada');
    expect(cleanName('x'.repeat(50))).toHaveLength(MAX_NAME_LENGTH);
  });

  it('makes a four digit guest name', () => {
    expect(guestName(() => 0)).toBe('Guest 1000');
    expect(guestName(() => 0.99999)).toBe('Guest 9999');
  });
});
