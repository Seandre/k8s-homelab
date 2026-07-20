import type { Freshness, Severity, SourceMetadata } from '../shared/contracts.js';

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ThresholdRule<T> {
  evaluate(value: T): Severity;
}

export interface SourceNormalizerOptions<T> {
  source: string;
  staleAfterMs: number;
  failureThreshold?: number;
  successThreshold?: number;
  circuitCooldownMs?: number;
  clock?: Clock;
  threshold?: ThresholdRule<T>;
  planned?: boolean;
  unsupported?: boolean;
}

export interface NormalizedSource<T> {
  value: T | null;
  metadata: SourceMetadata;
  circuit: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Source timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function severityRank(severity: Severity) {
  return { OK: 0, INFO: 1, WARN: 2, CRIT: 3 }[severity];
}

function maxSeverity(left: Severity, right: Severity): Severity {
  return severityRank(left) >= severityRank(right) ? left : right;
}

function iso(date: Date) {
  return date.toISOString();
}

export class SourceNormalizer<T> {
  private readonly source: string;
  private readonly staleAfterMs: number;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly circuitCooldownMs: number;
  private readonly clock: Clock;
  private readonly threshold: ThresholdRule<T> | undefined;
  private readonly inactiveFreshness: Extract<Freshness, 'NOT_PROVISIONED' | 'NOT_SUPPORTED'> | undefined;
  private lastGood: { value: T; sampledAt: Date; severity: Severity } | undefined;
  private circuit: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt: Date | undefined;

  constructor(options: SourceNormalizerOptions<T>) {
    this.source = options.source;
    this.staleAfterMs = options.staleAfterMs;
    this.failureThreshold = options.failureThreshold ?? 2;
    this.successThreshold = options.successThreshold ?? 2;
    this.circuitCooldownMs = options.circuitCooldownMs ?? 15_000;
    this.clock = options.clock ?? systemClock;
    this.threshold = options.threshold;
    this.inactiveFreshness = options.planned ? 'NOT_PROVISIONED' : options.unsupported ? 'NOT_SUPPORTED' : undefined;
  }

  canAttempt(): boolean {
    if (this.inactiveFreshness || this.circuit === 'CLOSED') return true;
    if (this.circuit === 'HALF_OPEN') return true;
    const openedAt = this.openedAt;
    if (openedAt && this.clock.now().getTime() - openedAt.getTime() >= this.circuitCooldownMs) {
      this.circuit = 'HALF_OPEN';
      this.consecutiveSuccesses = 0;
      return true;
    }
    return false;
  }

  recordSuccess(value: T, sampledAt = this.clock.now()): NormalizedSource<T> {
    if (this.inactiveFreshness) return this.snapshot();
    const recovering = this.circuit !== 'CLOSED';
    this.lastGood = { value, sampledAt, severity: this.threshold?.evaluate(value) ?? 'OK' };
    this.consecutiveFailures = 0;
    if (recovering) {
      this.circuit = 'HALF_OPEN';
      this.consecutiveSuccesses += 1;
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.circuit = 'CLOSED';
        this.consecutiveSuccesses = 0;
        this.openedAt = undefined;
      }
    } else {
      this.consecutiveSuccesses = 0;
    }
    return this.snapshot();
  }

  recordFailure(): NormalizedSource<T> {
    if (this.inactiveFreshness) return this.snapshot();
    this.consecutiveFailures += 1;
    this.consecutiveSuccesses = 0;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.circuit = 'OPEN';
      this.openedAt = this.clock.now();
    }
    return this.snapshot();
  }

  snapshot(): NormalizedSource<T> {
    const now = this.clock.now();
    if (this.inactiveFreshness) {
      return this.result(null, { source: this.source, observedAt: iso(now), freshness: this.inactiveFreshness, severity: 'INFO', message: this.inactiveFreshness === 'NOT_PROVISIONED' ? 'Source is planned but inactive.' : 'Source capability is not supported.' });
    }
    if (!this.lastGood) {
      return this.result(null, { source: this.source, observedAt: iso(now), freshness: 'NO_DATA', severity: 'INFO', message: 'No successful sample is available.' });
    }
    const ageMs = Math.max(0, now.getTime() - this.lastGood.sampledAt.getTime());
    const failed = this.consecutiveFailures > 0;
    const stale = failed || ageMs > this.staleAfterMs;
    const recovering = this.circuit === 'HALF_OPEN';
    const severity = this.circuit === 'OPEN' || recovering || (stale && this.lastGood.severity !== 'CRIT') ? maxSeverity(this.lastGood.severity, 'WARN') : this.lastGood.severity;
    return this.result(this.lastGood.value, {
      source: this.source,
      observedAt: iso(this.lastGood.sampledAt),
      freshness: stale ? 'STALE' : 'CURRENT',
      severity,
      ...(stale ? { ageSeconds: Math.floor(ageMs / 1_000), message: failed ? 'Last known safe value retained after source failure.' : 'Last known safe value has exceeded its freshness window.' } : {}),
    });
  }

  private result(value: T | null, metadata: SourceMetadata): NormalizedSource<T> {
    return { value, metadata, circuit: this.circuit, consecutiveFailures: this.consecutiveFailures, consecutiveSuccesses: this.consecutiveSuccesses };
  }
}

export function aggregateGlobalSeverity(sources: Array<Pick<NormalizedSource<unknown>, 'metadata'>>): Severity {
  return sources.reduce<Severity>((global, source) => {
    if (source.metadata.freshness === 'NOT_PROVISIONED' || source.metadata.freshness === 'NOT_SUPPORTED') return global;
    return maxSeverity(global, source.metadata.severity);
  }, 'OK');
}
