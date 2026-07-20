import { describe, expect, it } from 'vitest';
import { defaultLayout, layoutStorageKey, persistDashboardLayout, readDashboardLayout } from './layout.js';

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } } as Storage;
}

describe('browser-local layout preferences', () => {
  it('uses a safe default when browser storage is absent or invalid', () => {
    expect(readDashboardLayout(undefined)).toEqual(defaultLayout);
    const local = storage(); local.setItem(layoutStorageKey, '{bad');
    expect(readDashboardLayout(local)).toEqual(defaultLayout);
  });

  it('persists the supported layout controls', () => {
    const local = storage();
    persistDashboardLayout({ navigation: 'compact', density: 'comfortable', overview: 'systems-first' }, local);
    expect(readDashboardLayout(local)).toEqual({ navigation: 'compact', density: 'comfortable', overview: 'systems-first' });
  });
});
