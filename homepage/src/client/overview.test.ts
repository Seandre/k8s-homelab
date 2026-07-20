import { describe, expect, it } from 'vitest';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import { buildOverviewModel, bytesToGiB, bytesToTiB } from './overview.js';

describe('Overview fixture model', () => {
  it('keeps matching Proxmox hosts and all supported summaries visible', () => {
    const model = buildOverviewModel(healthyBootstrapFixture);
    expect(model.proxmoxHosts.map((host) => host.name)).toEqual(['pve-01', 'pve-02']);
    expect(model.k3sNodes).toHaveLength(3);
    expect(model.futureOkdNodes).toHaveLength(3);
    expect(model.proxmoxHosts.map((host) => host.memoryTotalBytes)).toEqual([17_179_869_184, 17_179_869_184]);
    expect(model.network.ingressVip).toBe('192.168.40.30');
    expect(model.network.gatewayLatencyProtocol).toBe('ICMP');
    expect(model.network.lastSpeedTest.metadata.freshness).toBe('STALE');
    expect(model.services).toHaveLength(17);
  });

  it('keeps an unprovisioned future OKD cluster separate from global severity', () => {
    const model = buildOverviewModel(healthyBootstrapFixture);
    expect(model.globalSeverity).toBe('WARN');
    expect(model.futureOkd?.metadata.freshness).toBe('NOT_PROVISIONED');
    expect(model.futureOkd?.metadata.severity).toBe('INFO');
  });

  it('formats fixture capacities consistently', () => {
    expect(bytesToGiB(17_179_869_184)).toBe('16.0');
    expect(bytesToTiB(2_199_023_255_552)).toBe('2.00');
  });
});
