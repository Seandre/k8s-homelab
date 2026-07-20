import { describe, expect, it } from 'vitest';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import { backupState, storageModel } from './storage.js';

describe('storage fixture model', () => {
  it('keeps healthy, old, failed, and no-data backup states distinct', () => {
    const states = new Map(storageModel(healthyBootstrapFixture).backups.map(({ backup, state }) => [backup.id, state]));
    expect(states.get('pbs-01-pve02-backups')).toBe('HEALTHY');
    expect(states.get('pbs-01-pve01-old-backup')).toBe('OLD');
    expect(states.get('pbs-01-failed-backup')).toBe('FAILED');
    expect(states.get('pve-01-vmdata')).toBe('NO_DATA');
  });

  it('keeps PBS reachability separate from datastore state', () => {
    const unreachable = { ...healthyBootstrapFixture, storage: { ...healthyBootstrapFixture.storage, pbs: { ...healthyBootstrapFixture.storage.pbs, reachable: false, metadata: { ...healthyBootstrapFixture.storage.pbs.metadata, freshness: 'NO_DATA' as const, severity: 'WARN' as const } } } };
    expect(unreachable.storage.pbs.reachable).toBe(false);
    const healthy = unreachable.storageBackups.find((backup) => backup.id === 'pbs-01-pve02-backups')!;
    expect(backupState(healthy, unreachable)).toBe('HEALTHY');
  });
});
