import { describe, expect, it } from 'vitest';
import { aggregateGlobalSeverity, SourceNormalizer, TimeoutError, withTimeout, type Clock } from './normalization.js';

function fakeClock(initial = '2026-07-19T12:00:00.000Z'): Clock & { advance(ms: number): void } {
  let now = new Date(initial);
  return { now: () => now, advance: (ms) => { now = new Date(now.getTime() + ms); } };
}

describe('source-independent normalization', () => {
  it('retains the last good value on first and second failures, opening the circuit only after the threshold', () => {
    const clock = fakeClock();
    const source = new SourceNormalizer<number>({ source: 'fixture-probe', staleAfterMs: 5_000, clock });
    source.recordSuccess(42);
    clock.advance(1_000);
    const first = source.recordFailure();
    expect(first).toMatchObject({ value: 42, circuit: 'CLOSED', consecutiveFailures: 1, metadata: { freshness: 'STALE', severity: 'WARN', ageSeconds: 1 } });
    const second = source.recordFailure();
    expect(second).toMatchObject({ value: 42, circuit: 'OPEN', consecutiveFailures: 2, metadata: { freshness: 'STALE', severity: 'WARN' } });
    expect(source.canAttempt()).toBe(false);
  });

  it('requires two successes to recover an opened circuit and evaluates thresholds only on safe samples', () => {
    const clock = fakeClock();
    const source = new SourceNormalizer<number>({ source: 'fixture-metric', staleAfterMs: 5_000, circuitCooldownMs: 1_000, clock, threshold: { evaluate: (value) => value >= 90 ? 'CRIT' : value >= 70 ? 'WARN' : 'OK' } });
    source.recordSuccess(95);
    source.recordFailure(); source.recordFailure();
    clock.advance(1_000);
    expect(source.canAttempt()).toBe(true);
    expect(source.recordSuccess(45)).toMatchObject({ circuit: 'HALF_OPEN', metadata: { freshness: 'CURRENT', severity: 'WARN' } });
    expect(source.recordSuccess(45)).toMatchObject({ circuit: 'CLOSED', metadata: { freshness: 'CURRENT', severity: 'OK' } });
  });

  it('ages samples, distinguishes never-sampled state, and keeps planned/unsupported sources neutral', () => {
    const clock = fakeClock();
    const source = new SourceNormalizer<string>({ source: 'fixture-history', staleAfterMs: 1_000, clock });
    expect(source.snapshot().metadata.freshness).toBe('NO_DATA');
    source.recordSuccess('safe'); clock.advance(1_001);
    expect(source.snapshot()).toMatchObject({ value: 'safe', metadata: { freshness: 'STALE', ageSeconds: 1, severity: 'WARN' } });
    const planned = new SourceNormalizer<string>({ source: 'fixture-okd', staleAfterMs: 1_000, clock, planned: true }).snapshot();
    const unsupported = new SourceNormalizer<string>({ source: 'fixture-unifi', staleAfterMs: 1_000, clock, unsupported: true }).snapshot();
    expect(planned.metadata.freshness).toBe('NOT_PROVISIONED');
    expect(unsupported.metadata.freshness).toBe('NOT_SUPPORTED');
    expect(aggregateGlobalSeverity([planned, unsupported, source.snapshot()])).toBe('WARN');
  });

  it('bounds asynchronous source reads with a typed timeout', async () => {
    await expect(withTimeout(new Promise<string>(() => {}), 1)).rejects.toBeInstanceOf(TimeoutError);
  });
});
