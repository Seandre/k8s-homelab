import { z } from 'zod';
import type { SourceMetadata, StorageBackup, StorageSummary } from '../shared/contracts.js';
import { SourceNormalizer, withTimeout, type Clock } from './normalization.js';

const UsageResponseSchema = z.object({ data: z.array(z.object({
  store: z.string().min(1),
  total: z.number().nonnegative().optional(),
  used: z.number().nonnegative().optional(),
})) });
const SnapshotsResponseSchema = z.object({ data: z.array(z.object({
  'backup-time': z.number().int().nonnegative(),
  verification: z.object({ state: z.string().optional() }).optional(),
})) });

type PbsSnapshot = {
  usage?: z.infer<typeof UsageResponseSchema>['data'][number];
  snapshots?: z.infer<typeof SnapshotsResponseSchema>['data'];
  partial: boolean;
};

export interface PbsFetchResponse { ok: boolean; json(): Promise<unknown>; }
export type PbsFetch = (url: string, init: { headers: { authorization: string }; caCertificate: string }) => Promise<PbsFetchResponse>;
export interface PbsConfig {
  id: string;
  name: string;
  datastore: string;
  server: string;
  tokenId: string;
  tokenSecret: string;
  caCertificate: string;
}
export interface PbsReadResult { storage: StorageSummary; backups: StorageBackup[]; }

function request(config: PbsConfig, path: string, fetcher: PbsFetch) {
  const authorization = `PBSAPIToken=${config.tokenId}:${config.tokenSecret}`;
  return withTimeout(fetcher(`${config.server.replace(/\/$/, '')}${path}`, { headers: { authorization }, caCertificate: config.caCertificate }), 5_000);
}

function data<T>(response: PbsFetchResponse, schema: z.ZodType<T>) {
  if (!response.ok) throw new Error('PBS request failed.');
  return response.json().then((body) => schema.parse(body));
}

function failure(snapshot: z.infer<typeof SnapshotsResponseSchema>['data'][number]) {
  return /failed|error/i.test(snapshot.verification?.state ?? '');
}

export class PbsAdapter {
  private readonly normalizer: SourceNormalizer<PbsSnapshot>;

  constructor(private readonly config: PbsConfig, private readonly enabled: boolean, clock?: Clock) {
    this.normalizer = new SourceNormalizer({ source: `pbs:${config.id}`, staleAfterMs: 120_000, unsupported: !enabled, ...(clock ? { clock } : {}) });
  }

  async read(fetcher: PbsFetch): Promise<PbsReadResult> {
    if (this.enabled && this.normalizer.canAttempt()) {
      try {
        const usage = await data(await request(this.config, '/status/datastore-usage', fetcher), UsageResponseSchema);
        const snapshots = await request(this.config, `/admin/datastore/${encodeURIComponent(this.config.datastore)}/snapshots`, fetcher)
          .then((response) => data(response, SnapshotsResponseSchema));
        const datastoreUsage = usage.data.find((entry) => entry.store === this.config.datastore);
        this.normalizer.recordSuccess({ ...(datastoreUsage ? { usage: datastoreUsage } : {}), snapshots: snapshots.data, partial: false });
      } catch {
        this.normalizer.recordFailure();
      }
    }
    const snapshot = this.normalizer.snapshot();
    const baseMetadata = snapshot.metadata;
    const failed = snapshot.value?.snapshots?.filter(failure) ?? [];
    const successful = (snapshot.value?.snapshots ?? []).filter((entry) => !failure(entry));
    const newest = successful.reduce<number | null>((latest, entry) => latest === null || entry['backup-time'] > latest ? entry['backup-time'] : latest, null);
    const metadata: SourceMetadata = {
      ...baseMetadata,
      ...(failed.length > 0 ? { severity: 'CRIT' as const, message: 'One or more approved PBS verification states report failure.' } : {}),
    };
    return {
      storage: { pbs: { datastore: this.config.datastore, reachable: snapshot.value ? true : null, metadata }, policy: { backupWarningAgeSeconds: 86_400, backupFailureThreshold: 1 } },
      backups: [{
        id: `${this.config.id}-${this.config.datastore}`,
        name: `${this.config.name} / ${this.config.datastore}`,
        capacityBytes: snapshot.value?.usage?.total ?? null,
        usedBytes: snapshot.value?.usage?.used ?? null,
        lastSuccessfulBackupAt: newest === null ? null : new Date(newest * 1_000).toISOString(),
        failureCount: failed.length,
        metadata,
      }],
    };
  }
}
