import { describe, expect, it } from 'vitest';
import { PbsAdapter, type PbsFetch } from './pbs.js';
import type { Clock } from './normalization.js';

const clock: Clock = { now: () => new Date('2026-07-19T12:00:00.000Z') };
const config = { id: 'pbs-01', name: 'pbs-01', datastore: 'pve02-backups', server: 'https://pbs-01.lab.seandre.dev:8007/api2/json', tokenId: 'homepage@pbs!dashboard', tokenSecret: 'test-secret', caCertificate: 'test-ca' };

describe('PBS read-only adapter', () => {
  it('uses only approved status and snapshot reads, then emits an aggregate backup summary', async () => {
    const seen: Array<{ url: string; authorization: string; caCertificate: string }> = [];
    const fetcher: PbsFetch = async (url, init) => {
      seen.push({ url, authorization: init.headers.authorization, caCertificate: init.caCertificate });
      if (url.endsWith('/status/datastore-usage')) return { ok: true, json: async () => ({ data: [{ store: 'pve02-backups', total: 1_000, used: 250 }] }) };
      return { ok: true, json: async () => ({ data: [{ 'backup-time': 1_784_358_781, verification: { state: 'ok' }, owner: 'not-exposed' }, { 'backup-time': 1_784_300_000, verification: { state: 'failed' } }] }) };
    };
    const result = await new PbsAdapter(config, true, clock).read(fetcher);
    expect(seen).toEqual([
      { url: 'https://pbs-01.lab.seandre.dev:8007/api2/json/status/datastore-usage', authorization: 'PBSAPIToken=homepage@pbs!dashboard:test-secret', caCertificate: 'test-ca' },
      { url: 'https://pbs-01.lab.seandre.dev:8007/api2/json/admin/datastore/pve02-backups/snapshots', authorization: 'PBSAPIToken=homepage@pbs!dashboard:test-secret', caCertificate: 'test-ca' },
    ]);
    expect(result).toMatchObject({ storage: { pbs: { datastore: 'pve02-backups', reachable: true, metadata: { severity: 'CRIT' } } }, backups: [{ capacityBytes: 1_000, usedBytes: 250, failureCount: 1, lastSuccessfulBackupAt: '2026-07-18T07:13:01.000Z' }] });
    expect(JSON.stringify(result)).not.toContain('not-exposed');
    expect(JSON.stringify(result)).not.toContain('test-secret');
    expect(JSON.stringify(result)).not.toContain('test-ca');
  });

  it('returns an explicit unsupported state without requesting PBS when disabled', async () => {
    const fetcher: PbsFetch = async () => { throw new Error('must not be called'); };
    const result = await new PbsAdapter(config, false, clock).read(fetcher);
    expect(result.storage.pbs.metadata.freshness).toBe('NOT_SUPPORTED');
    expect(result.storage.pbs.reachable).toBeNull();
  });
});
