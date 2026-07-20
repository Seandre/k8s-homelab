import { describe, expect, it } from 'vitest';
import { UniFiAdapter, type UniFiFetch } from './unifi.js';
import type { Clock } from './normalization.js';

const clock: Clock = { now: () => new Date('2026-07-19T12:00:00.000Z') };
const config = { server: 'https://api.ui.com', token: 'test-key' };

describe('UniFi Site Manager read-only adapter', () => {
  it('uses only approved GET endpoints and normalizes controller state plus existing ISP metrics', async () => {
    const seen: Array<{ url: string; key: string }> = [];
    const fetcher: UniFiFetch = async (url, init) => {
      seen.push({ url, key: init.headers['x-api-key'] });
      if (url.includes('/hosts')) return { ok: true, json: async () => ({ data: [{ isBlocked: false, reportedState: { state: 'connected' }, ipAddress: 'not-exposed' }] }) };
      return { ok: true, json: async () => ({ data: [{ periods: [{ metricTime: '2026-07-19T11:55:00.000Z', data: { wan: { avgLatency: 18, download_kbps: 940_000, upload_kbps: 35_000 } } }] }] }) };
    };
    const result = await new UniFiAdapter(config, true, clock).read(fetcher);
    expect(seen).toEqual([
      { url: 'https://api.ui.com/v1/hosts?pageSize=100', key: 'test-key' },
      { url: 'https://api.ui.com/v1/isp-metrics/5m?duration=24h', key: 'test-key' },
    ]);
    expect(result).toMatchObject({ unifi: { controller: 'UniFi Site Manager', status: 'UP', metadata: { freshness: 'CURRENT' } }, lastSpeedTest: { downloadMbps: 940, uploadMbps: 35, latencyMs: 18, observedAt: '2026-07-19T11:55:00.000Z' } });
    expect(JSON.stringify(result)).not.toContain('not-exposed');
    expect(JSON.stringify(result)).not.toContain('test-key');
  });

  it('contains authentication failure to the UniFi source and never makes a request when disabled', async () => {
    const failed: UniFiFetch = async () => ({ ok: false, json: async () => ({ traceId: 'not-exposed' }) });
    const unavailable = await new UniFiAdapter(config, true, clock).read(failed);
    expect(unavailable.unifi.metadata.freshness).toBe('NO_DATA');
    expect(unavailable.unifi.controller).toBeNull();
    const disabled: UniFiFetch = async () => { throw new Error('must not be called'); };
    expect((await new UniFiAdapter(config, false, clock).read(disabled)).unifi.metadata.freshness).toBe('NOT_SUPPORTED');
  });
});
