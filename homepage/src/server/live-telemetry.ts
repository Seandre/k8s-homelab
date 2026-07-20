import { readFile } from 'node:fs/promises';
import type { Bootstrap, Host, SourceMetadata, TimeSeries } from '../shared/contracts.js';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import { GlancesAdapter, type GlancesFetch } from './glances.js';
import { aggregateGlobalSeverity } from './normalization.js';
import { ProxmoxAdapter, type ProxmoxFetch, type ProxmoxHostConfig } from './proxmox.js';
import type { RuntimeConfig } from './runtime-config.js';

const POLL_INTERVAL_MS = 5_000;
const HISTORY_LIMIT = 104;
const SECRET_ROOT = '/var/run/homepage-secrets';

type FetchResponse = { ok: boolean; json(): Promise<unknown> };
type SecretReader = (path: string) => Promise<string | null>;

const fetchJson = async (url: string, init?: RequestInit): Promise<FetchResponse> => {
  const response = await fetch(url, init);
  return { ok: response.ok, json: () => response.json() };
};

async function mountedSecret(path: string): Promise<string | null> {
  try { return (await readFile(path, 'utf8')).trim() || null; } catch { return null; }
}

function dynamicHost(id: string, name: string, metadata: SourceMetadata): Host {
  return {
    id, name, kind: 'PROXMOX', cpuPercent: null, memoryPercent: null, memoryUsedBytes: null, memoryTotalBytes: null,
    diskUsedBytes: null, diskTotalBytes: null, diskIoPercent: null, cpuModel: null, cpuCorePercentages: null,
    loadAverage: null, cpuClockMhz: null, powerWatts: null, swapUsedBytes: null, swapTotalBytes: null,
    uptimeSeconds: null, runningVmCount: null, stoppedVmCount: null, runningContainerCount: null,
    stoppedContainerCount: null, temperatureCelsius: null, networkIngressBitsPerSecond: null,
    networkEgressBitsPerSecond: null, metadata,
  };
}

function value<T>(preferred: T | null, fallback: T | null): T | null { return preferred ?? fallback; }

function mergedHost(id: string, name: string, proxmox: Host | undefined, glances: Host | undefined, now: string): Host {
  const metadata: SourceMetadata = {
    source: 'proxmox+glances', observedAt: now,
    freshness: proxmox?.metadata.freshness === 'CURRENT' || glances?.metadata.freshness === 'CURRENT' ? 'CURRENT' : 'NO_DATA',
    severity: proxmox?.metadata.severity === 'CRIT' || glances?.metadata.severity === 'CRIT' ? 'CRIT' : proxmox?.metadata.severity === 'WARN' || glances?.metadata.severity === 'WARN' ? 'WARN' : 'OK',
    ...(proxmox?.metadata.freshness !== 'CURRENT' && glances?.metadata.freshness !== 'CURRENT' ? { message: 'No current approved telemetry sample is available.' } : {}),
  };
  const blank = dynamicHost(id, name, metadata);
  return {
    ...blank,
    cpuPercent: value(glances?.cpuPercent ?? null, proxmox?.cpuPercent ?? null),
    memoryPercent: value(glances?.memoryPercent ?? null, proxmox?.memoryPercent ?? null),
    memoryUsedBytes: value(glances?.memoryUsedBytes ?? null, proxmox?.memoryUsedBytes ?? null),
    memoryTotalBytes: value(glances?.memoryTotalBytes ?? null, proxmox?.memoryTotalBytes ?? null),
    diskUsedBytes: value(proxmox?.diskUsedBytes ?? null, glances?.diskUsedBytes ?? null),
    diskTotalBytes: value(proxmox?.diskTotalBytes ?? null, glances?.diskTotalBytes ?? null),
    diskIoPercent: value(glances?.diskIoPercent ?? null, proxmox?.diskIoPercent ?? null),
    cpuModel: proxmox?.cpuModel ?? null,
    cpuCorePercentages: null,
    loadAverage: proxmox?.loadAverage ?? null,
    cpuClockMhz: proxmox?.cpuClockMhz ?? null,
    powerWatts: null,
    swapUsedBytes: proxmox?.swapUsedBytes ?? null,
    swapTotalBytes: proxmox?.swapTotalBytes ?? null,
    uptimeSeconds: value(glances?.uptimeSeconds ?? null, proxmox?.uptimeSeconds ?? null),
    runningVmCount: proxmox?.runningVmCount ?? null,
    stoppedVmCount: proxmox?.stoppedVmCount ?? null,
    runningContainerCount: proxmox?.runningContainerCount ?? null,
    stoppedContainerCount: proxmox?.stoppedContainerCount ?? null,
    temperatureCelsius: glances?.temperatureCelsius ?? null,
    networkIngressBitsPerSecond: glances?.networkIngressBitsPerSecond ?? null,
    networkEgressBitsPerSecond: glances?.networkEgressBitsPerSecond ?? null,
  };
}

export class LiveTelemetry {
  private readonly history = new Map<string, Array<{ timestamp: string; value: number }>>();
  private latest: Bootstrap | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private proxmox: ProxmoxAdapter | undefined;
  private readonly glances: GlancesAdapter;

  constructor(
    private readonly runtimeConfig: RuntimeConfig,
    private readonly publish: (bootstrap: Bootstrap) => void,
    private readonly secretReader: SecretReader = mountedSecret,
    private readonly httpFetch: typeof fetchJson = fetchJson,
  ) {
    this.glances = new GlancesAdapter([
      { id: 'pve-01', name: 'pve-01', endpoint: 'http://192.168.40.20:61208' },
      { id: 'pve-02', name: 'pve-02', endpoint: 'http://192.168.40.25:61208' },
    ], (url) => this.httpFetch(url) as ReturnType<GlancesFetch>, this.runtimeConfig.featureFlags.proxmox);
  }

  async start() { await this.refresh(); this.timer = setInterval(() => { void this.refresh(); }, POLL_INTERVAL_MS); this.timer.unref(); }
  stop() { if (this.timer) clearInterval(this.timer); }
  bootstrap = () => this.latest ?? this.emptyBootstrap();

  private async proxmoxHosts() {
    const configured = await Promise.all([
      this.proxmoxConfig('pve-01', 'pve-01', 'pve01', 'pve01'),
      this.proxmoxConfig('pve-02', 'pve-02', 'pve-02', 'pve02'),
    ]);
    const hosts = configured.filter((host): host is ProxmoxHostConfig => host !== null);
    this.proxmox ??= new ProxmoxAdapter(hosts, this.runtimeConfig.featureFlags.proxmox);
    return this.proxmox.read((url, init) => this.httpFetch(url, init) as ReturnType<ProxmoxFetch>);
  }

  private async proxmoxConfig(id: string, name: string, node: string, secretName: string): Promise<ProxmoxHostConfig | null> {
    const base = `${SECRET_ROOT}/${secretName}`;
    const [server, tokenId, tokenSecret] = await Promise.all([this.secretReader(`${base}/server`), this.secretReader(`${base}/token-id`), this.secretReader(`${base}/token-secret`)]);
    return server && tokenId && tokenSecret ? { id, name, node, server, tokenId, tokenSecret } : null;
  }

  private async glancesHosts() {
    return this.glances.read();
  }

  async refresh() {
    const [proxmox, glances] = await Promise.all([this.proxmoxHosts(), this.glancesHosts()]);
    const now = new Date().toISOString();
    const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
    const proxmoxById = byId(proxmox);
    const glancesById = byId(glances);
    const hosts = ['pve-01', 'pve-02'].map((id) => mergedHost(id, id, proxmoxById.get(id), glancesById.get(id), now));
    for (const host of hosts) this.recordHost(host, now);
    const base = this.emptyBootstrap();
    base.generatedAt = now;
    base.hosts = [...hosts, ...base.hosts.filter((host) => host.kind !== 'PROXMOX')];
    base.timeSeries = this.timeSeries(hosts);
    base.globalSeverity = aggregateGlobalSeverity(hosts.map((host) => ({ metadata: host.metadata })));
    this.latest = base;
    this.publish(base);
  }

  private emptyBootstrap(): Bootstrap {
    const base = structuredClone(healthyBootstrapFixture);
    base.alerts = [];
    base.timeSeries = [];
    return base;
  }

  private recordHost(host: Host, timestamp: string) {
    const metrics: Array<[string, number | null]> = [
      [`${host.name} CPU`, host.cpuPercent], [`${host.name} MEMORY`, host.memoryPercent],
      [`${host.name} DISK`, host.diskUsedBytes !== null && host.diskTotalBytes ? host.diskUsedBytes / host.diskTotalBytes * 100 : null],
      [`${host.name} RX`, host.networkIngressBitsPerSecond === null ? null : host.networkIngressBitsPerSecond / 1_000_000],
      [`${host.name} TX`, host.networkEgressBitsPerSecond === null ? null : host.networkEgressBitsPerSecond / 1_000_000],
    ];
    for (const [metric, sample] of metrics) {
      if (sample === null || !Number.isFinite(sample)) continue;
      const points = this.history.get(metric) ?? [];
      points.push({ timestamp, value: Number(sample.toFixed(2)) });
      this.history.set(metric, points.slice(-HISTORY_LIMIT));
    }
  }

  private timeSeries(hosts: Host[]): TimeSeries[] {
    const current = new Map(hosts.map((host) => [host.name, host]));
    return [...this.history.entries()].map(([metric, points]) => {
      const host = current.get(metric.split(' ')[0]!);
      return { metric, unit: metric.endsWith('RX') || metric.endsWith('TX') ? 'Mb/s' : '%', window: '15m', points, metadata: host?.metadata ?? { source: 'proxmox+glances', observedAt: new Date().toISOString(), freshness: 'NO_DATA', severity: 'INFO' } };
    });
  }
}
