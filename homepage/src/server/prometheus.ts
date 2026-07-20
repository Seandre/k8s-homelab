import { z } from 'zod';
import { SourceNormalizer, withTimeout, type Clock } from './normalization.js';

const QueryResponseSchema = z.object({
  status: z.literal('success'),
  data: z.object({ resultType: z.literal('vector'), result: z.array(z.object({ value: z.tuple([z.union([z.number(), z.string()]), z.string()]) })) }),
});

export interface PrometheusFetchResponse { ok: boolean; json(): Promise<unknown>; }
export type PrometheusFetch = (url: string) => Promise<PrometheusFetchResponse>;
export interface PrometheusClusterMetrics {
  cpuCapacityCores: number | null;
  cpuUsedCores: number | null;
  memoryCapacityBytes: number | null;
  memoryUsedBytes: number | null;
}

// This catalog is deliberately fixed: the browser cannot send PromQL, metric
// names, labels, or endpoints to the backend.
const queries = {
  cpuCapacityCores: 'sum(kube_node_status_capacity{resource="cpu"})',
  memoryCapacityBytes: 'sum(kube_node_status_capacity{resource="memory"})',
  cpuUsedCores: 'sum(rate(container_cpu_usage_seconds_total{container!="",image!=""}[5m]))',
  memoryUsedBytes: 'sum(container_memory_working_set_bytes{container!="",image!=""})',
} as const;

function scalar(response: z.infer<typeof QueryResponseSchema>) {
  const raw = response.data.result[0]?.value[1];
  const parsed = raw === undefined ? null : Number(raw);
  return parsed === null || !Number.isFinite(parsed) ? null : parsed;
}

export class PrometheusAdapter {
  private readonly normalizer: SourceNormalizer<PrometheusClusterMetrics>;

  constructor(private readonly server: string, enabled: boolean, clock?: Clock) {
    this.normalizer = new SourceNormalizer({ source: 'prometheus-api', staleAfterMs: 45_000, unsupported: !enabled, ...(clock ? { clock } : {}) });
  }

  async readCluster(fetcher: PrometheusFetch): Promise<PrometheusClusterMetrics | null> {
    if (this.normalizer.canAttempt()) {
      try {
        const read = async (query: string) => {
          const endpoint = new URL(`${this.server.replace(/\/$/, '')}/api/v1/query`);
          endpoint.searchParams.set('query', query);
          const response = await withTimeout(fetcher(endpoint.toString()), 3_000);
          if (!response.ok) throw new Error('Prometheus request failed.');
          return scalar(QueryResponseSchema.parse(await response.json()));
        };
        const values = await Promise.all(Object.values(queries).map(read));
        this.normalizer.recordSuccess({ cpuCapacityCores: values[0] ?? null, memoryCapacityBytes: values[1] ?? null, cpuUsedCores: values[2] ?? null, memoryUsedBytes: values[3] ?? null });
      } catch { this.normalizer.recordFailure(); }
    }
    return this.normalizer.snapshot().value ?? null;
  }
}
