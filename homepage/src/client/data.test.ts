import { describe, expect, it } from 'vitest';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import { mergeBootstrapHistory, parseBootstrapEvent } from './data.js';

describe('client bootstrap event parsing', () => {
  it('accepts validated updates and drops malformed events', () => {
    expect(parseBootstrapEvent(JSON.stringify(healthyBootstrapFixture))).toEqual(healthyBootstrapFixture);
    expect(parseBootstrapEvent('{not-json}')).toBeNull();
    expect(parseBootstrapEvent(JSON.stringify({ schemaVersion: 1 }))).toBeNull();
  });
});

describe('client telemetry history continuity', () => {
  it('retains genuine cached points when a reconnect reaches a newer replica with a shorter window', () => {
    const cached = structuredClone(healthyBootstrapFixture);
    const current = structuredClone(healthyBootstrapFixture);
    const series = current.timeSeries.find((candidate) => candidate.metric === 'pve-01 CPU')!;
    series.points = [series.points.at(-1)!];
    const merged = mergeBootstrapHistory(current, cached);
    expect(merged.timeSeries.find((candidate) => candidate.metric === 'pve-01 CPU')?.points).toHaveLength(cached.timeSeries.find((candidate) => candidate.metric === 'pve-01 CPU')!.points.length);
  });
});
