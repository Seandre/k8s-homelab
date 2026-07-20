import { z } from 'zod';
import type { SourceMetadata } from '../shared/contracts.js';
import { SourceNormalizer, withTimeout, type Clock } from './normalization.js';

const ApplicationsResponseSchema = z.object({ items: z.array(z.object({
  metadata: z.object({ name: z.string().min(1) }),
  spec: z.object({ project: z.string().min(1) }),
  status: z.object({
    health: z.object({ status: z.string() }).optional(),
    sync: z.object({ status: z.string() }).optional(),
    operationState: z.object({ phase: z.string().optional(), syncResult: z.object({ revision: z.string().optional() }).optional(), message: z.string().optional() }).optional(),
  }).optional(),
})) });
export interface ArgoFetchResponse { ok: boolean; json(): Promise<unknown>; }
export type ArgoFetch = (url: string, init: { headers: { authorization: string } }) => Promise<ArgoFetchResponse>;
export interface ArgoApplication { id: string; name: string; project: string; health: string; sync: string; operationPhase: string | null; revision: string | null; message: string | null; metadata: SourceMetadata; }

function severity(health: string, sync: string): SourceMetadata['severity'] {
  if (health === 'Degraded') return 'CRIT';
  if (health === 'Progressing' || sync === 'OutOfSync') return 'WARN';
  if (health === 'Healthy' && sync === 'Synced') return 'OK';
  return 'INFO';
}

export class ArgoCdAdapter {
  private readonly normalizer: SourceNormalizer<z.infer<typeof ApplicationsResponseSchema>>;
  constructor(private readonly server: string, private readonly token: string, enabled: boolean, clock?: Clock) {
    this.normalizer = new SourceNormalizer({ source: 'argocd-api', staleAfterMs: 30_000, unsupported: !enabled, ...(clock ? { clock } : {}) });
  }

  async read(fetcher: ArgoFetch): Promise<ArgoApplication[] | null> {
    if (this.normalizer.canAttempt()) {
      try {
        const response = await withTimeout(fetcher(`${this.server}/api/v1/applications`, { headers: { authorization: `Bearer ${this.token}` } }), 3_000);
        if (!response.ok) throw new Error('Argo CD request failed.');
        this.normalizer.recordSuccess(ApplicationsResponseSchema.parse(await response.json()));
      } catch { this.normalizer.recordFailure(); }
    }
    const snapshot = this.normalizer.snapshot();
    if (!snapshot.value) return null;
    return snapshot.value.items.map((item) => {
      const health = item.status?.health?.status ?? 'Unknown';
      const sync = item.status?.sync?.status ?? 'Unknown';
      return { id: item.metadata.name, name: item.metadata.name, project: item.spec.project, health, sync, operationPhase: item.status?.operationState?.phase ?? null, revision: item.status?.operationState?.syncResult?.revision ?? null, message: item.status?.operationState?.message ?? null, metadata: { ...snapshot.metadata, severity: severity(health, sync) } };
    });
  }
}
