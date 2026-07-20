import { z } from 'zod';
import type { SourceMetadata, SpeedTestResult, UniFiState } from '../shared/contracts.js';
import { SourceNormalizer, withTimeout, type Clock } from './normalization.js';

const HostsResponseSchema = z.object({ data: z.array(z.object({
  isBlocked: z.boolean().optional(),
  reportedState: z.object({ state: z.string().optional() }).nullable().optional(),
})) });
const MetricsResponseSchema = z.object({ data: z.array(z.object({
  periods: z.array(z.object({
    metricTime: z.string().datetime({ offset: true }),
    data: z.object({ wan: z.object({ avgLatency: z.number().nonnegative().optional(), download_kbps: z.number().nonnegative().optional(), upload_kbps: z.number().nonnegative().optional() }).optional() }).optional(),
  })),
})) });

type UniFiSnapshot = { hosts: z.infer<typeof HostsResponseSchema>['data']; metrics: z.infer<typeof MetricsResponseSchema>['data']; };
export interface UniFiFetchResponse { ok: boolean; json(): Promise<unknown>; }
export type UniFiFetch = (url: string, init: { headers: { accept: string; 'x-api-key': string } }) => Promise<UniFiFetchResponse>;
export interface UniFiConfig { server: string; token: string; }
export interface UniFiReadResult { unifi: UniFiState; lastSpeedTest: SpeedTestResult; }

function request(config: UniFiConfig, path: string, fetcher: UniFiFetch) {
  return withTimeout(fetcher(`${config.server.replace(/\/$/, '')}${path}`, { headers: { accept: 'application/json', 'x-api-key': config.token } }), 5_000);
}

function data<T>(response: UniFiFetchResponse, schema: z.ZodType<T>) {
  if (!response.ok) throw new Error('UniFi request failed.');
  return response.json().then((body) => schema.parse(body));
}

function controllerState(hosts: z.infer<typeof HostsResponseSchema>['data']): UniFiState['status'] {
  if (hosts.length === 0) return null;
  if (hosts.some((host) => host.isBlocked)) return 'DEGRADED';
  const states = hosts.map((host) => host.reportedState?.state?.toLowerCase()).filter((state): state is string => Boolean(state));
  if (states.some((state) => state === 'connected')) return 'UP';
  if (states.some((state) => /disconnected|offline|down/.test(state))) return 'DOWN';
  return 'DEGRADED';
}

function latestMetric(metrics: z.infer<typeof MetricsResponseSchema>['data']) {
  return metrics.flatMap((entry) => entry.periods).reduce<z.infer<typeof MetricsResponseSchema>['data'][number]['periods'][number] | null>((latest, candidate) => !latest || candidate.metricTime > latest.metricTime ? candidate : latest, null);
}

export class UniFiAdapter {
  private readonly normalizer: SourceNormalizer<UniFiSnapshot>;

  constructor(private readonly config: UniFiConfig, private readonly enabled: boolean, clock?: Clock) {
    this.normalizer = new SourceNormalizer({ source: 'unifi-site-manager', staleAfterMs: 120_000, unsupported: !enabled, ...(clock ? { clock } : {}) });
  }

  async read(fetcher: UniFiFetch): Promise<UniFiReadResult> {
    if (this.enabled && this.normalizer.canAttempt()) {
      try {
        const [hosts, metrics] = await Promise.all([
          request(this.config, '/v1/hosts?pageSize=100', fetcher).then((response) => data(response, HostsResponseSchema)),
          request(this.config, '/v1/isp-metrics/5m?duration=24h', fetcher).then((response) => data(response, MetricsResponseSchema)),
        ]);
        this.normalizer.recordSuccess({ hosts: hosts.data, metrics: metrics.data });
      } catch { this.normalizer.recordFailure(); }
    }
    const snapshot = this.normalizer.snapshot();
    const metric = snapshot.value ? latestMetric(snapshot.value.metrics) : null;
    const state = snapshot.value ? controllerState(snapshot.value.hosts) : null;
    const metadata: SourceMetadata = {
      ...snapshot.metadata,
      ...(state === 'DOWN' ? { severity: 'CRIT' as const, message: 'UniFi controller reports no connected host.' } : state === 'DEGRADED' ? { severity: 'WARN' as const, message: 'UniFi controller state is incomplete or degraded.' } : {}),
    };
    return {
      unifi: { controller: state === null ? null : 'UniFi Site Manager', status: state, metadata },
      lastSpeedTest: {
        downloadMbps: metric?.data?.wan?.download_kbps === undefined ? null : metric.data.wan.download_kbps / 1_000,
        uploadMbps: metric?.data?.wan?.upload_kbps === undefined ? null : metric.data.wan.upload_kbps / 1_000,
        latencyMs: metric?.data?.wan?.avgLatency ?? null,
        observedAt: metric?.metricTime ?? null,
        metadata,
      },
    };
  }
}
