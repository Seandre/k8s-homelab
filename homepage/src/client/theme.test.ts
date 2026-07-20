import { describe, expect, it } from 'vitest';
import { APPEARANCE_STORAGE_KEY, persistAppearance, readStoredAppearance, resolveAppearance } from './theme.js';

describe('appearance modes', () => {
  it('uses the system preference only for auto mode', () => {
    expect(resolveAppearance('auto', true)).toBe('dark');
    expect(resolveAppearance('auto', false)).toBe('light');
    expect(resolveAppearance('dark', false)).toBe('dark');
    expect(resolveAppearance('light', true)).toBe('light');
  });

  it('persists explicit overrides and clears auto mode', () => {
    const values = new Map<string, string>();
    const storage: Storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
      removeItem: (key) => void values.delete(key),
      clear: () => values.clear(),
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    };
    persistAppearance('light', storage);
    expect(storage.getItem(APPEARANCE_STORAGE_KEY)).toBe('light');
    expect(readStoredAppearance(storage)).toBe('light');
    persistAppearance('auto', storage);
    expect(storage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
    expect(readStoredAppearance(storage)).toBe('auto');
  });
});
