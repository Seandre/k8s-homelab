export type AppearanceMode = 'dark' | 'light' | 'auto';
export type ResolvedAppearance = 'dark' | 'light';

export const APPEARANCE_STORAGE_KEY = 'homelab-appearance';

export const darkTokens = {
  background: '#000000',
  foreground: '#cccccc',
  title: '#eeeeee',
  highlight: '#b54040',
  inactive: '#404040',
  graphText: '#606060',
  cpuBox: '#556d59',
  memoryBox: '#6c6c4b',
  networkBox: '#5c588d',
  workloadBox: '#805252',
  divider: '#303030',
  focus: '#77ca9b',
} as const;

export const lightTokens = {
  background: '#f4f5f2',
  foreground: '#26302a',
  title: '#101510',
  highlight: '#8f2929',
  inactive: '#68736c',
  graphText: '#68736c',
  cpuBox: '#d7e7d9',
  memoryBox: '#e8e5c9',
  networkBox: '#dddaf0',
  workloadBox: '#f0d9d9',
  divider: '#b8c1ba',
  focus: '#176b43',
} as const;

export function resolveAppearance(mode: AppearanceMode, prefersDark: boolean): ResolvedAppearance {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}

export function readStoredAppearance(storage: Storage | null): AppearanceMode {
  const value = storage?.getItem(APPEARANCE_STORAGE_KEY);
  return value === 'dark' || value === 'light' || value === 'auto' ? value : 'auto';
}

export function persistAppearance(mode: AppearanceMode, storage: Storage | null): void {
  if (storage === null) return;
  if (mode === 'auto') storage.removeItem(APPEARANCE_STORAGE_KEY);
  else storage.setItem(APPEARANCE_STORAGE_KEY, mode);
}
