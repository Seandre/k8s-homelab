export type NavigationDensity = 'expanded' | 'compact';
export type ContentDensity = 'compact' | 'comfortable';
export type OverviewLayout = 'balanced' | 'systems-first';

export interface DashboardLayout {
  navigation: NavigationDensity;
  density: ContentDensity;
  overview: OverviewLayout;
}

export const layoutStorageKey = 'homelab.dashboard.layout.v1';
export const defaultLayout: DashboardLayout = { navigation: 'expanded', density: 'compact', overview: 'balanced' };

export function readDashboardLayout(storage: Storage | undefined): DashboardLayout {
  if (!storage) return defaultLayout;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(layoutStorageKey) ?? '');
    if (typeof parsed === 'object' && parsed !== null && (parsed as DashboardLayout).navigation && (parsed as DashboardLayout).density && (parsed as DashboardLayout).overview) {
      const candidate = parsed as DashboardLayout;
      if (['expanded', 'compact'].includes(candidate.navigation) && ['compact', 'comfortable'].includes(candidate.density) && ['balanced', 'systems-first'].includes(candidate.overview)) return candidate;
    }
  } catch { /* Fall back to the safe default. */ }
  return defaultLayout;
}

export function persistDashboardLayout(layout: DashboardLayout, storage: Storage) {
  storage.setItem(layoutStorageKey, JSON.stringify(layout));
}
