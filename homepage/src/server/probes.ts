import type { SourceMetadata } from '../shared/contracts.js';
import { SourceNormalizer, withTimeout, type Clock } from './normalization.js';
import type { RuntimeConfig } from './runtime-config.js';

export interface ProbeFetchResponse { ok: boolean; status: number; }
export type ProbeFetch = (url: string, init: { redirect: 'error'; signal?: AbortSignal }) => Promise<ProbeFetchResponse>;

export interface ProbeResult {
  id: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  latencyMs: number | null;
  metadata: SourceMetadata;
}

export class ProbeTargetNotAllowedError extends Error {
  constructor() { super('Probe target is not configured.'); this.name = 'ProbeTargetNotAllowedError'; }
}

interface ProbeState { normalizer: SourceNormalizer<number>; target: string; enabled: boolean; }

export class AllowlistedProbeRunner {
  private readonly states = new Map<string, ProbeState>();
  private readonly fetcher: ProbeFetch;
  private readonly timeoutMs: number;
  private readonly clock: Clock;

  constructor(config: RuntimeConfig, fetcher: ProbeFetch, clock: Clock, timeoutMs = 3_000) {
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.clock = clock;
    for (const probe of config.probes) {
      const source = config.sources.find((candidate) => candidate.id === probe.sourceId)!;
      this.states.set(probe.id, { target: probe.target, enabled: source.enabled && config.featureFlags.probes, normalizer: new SourceNormalizer<number>({ source: `probe:${probe.id}`, staleAfterMs: probe.intervalMs * 2, clock, unsupported: !(source.enabled && config.featureFlags.probes) }) });
    }
  }

  async run(id: string): Promise<ProbeResult> {
    const state = this.states.get(id);
    if (!state) throw new ProbeTargetNotAllowedError();
    if (state.enabled && state.normalizer.canAttempt()) {
      const started = this.clock.now().getTime();
      try {
        const response = await withTimeout(this.fetcher(state.target, { redirect: 'error' }), this.timeoutMs);
        if (!response.ok) throw new Error(`Probe received HTTP ${response.status}.`);
        state.normalizer.recordSuccess(Math.max(0, this.clock.now().getTime() - started));
      } catch { state.normalizer.recordFailure(); }
    }
    const snapshot = state.normalizer.snapshot();
    return { id, status: snapshot.value === null ? 'DOWN' : snapshot.circuit === 'CLOSED' ? 'UP' : 'DEGRADED', latencyMs: snapshot.value, metadata: snapshot.metadata };
  }

  async runConfigured(): Promise<ProbeResult[]> {
    return Promise.all([...this.states.keys()].map((id) => this.run(id)));
  }
}
