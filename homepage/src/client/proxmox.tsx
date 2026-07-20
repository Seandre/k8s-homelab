import React from 'react';
import type { Host } from '../shared/contracts.js';
import { DotGraph, Metric, Panel } from './components.js';
import { bytesToGiB, bytesToTiB } from './overview.js';

function uptimeLabel(seconds: number | null) {
  if (seconds === null) return '—';
  return `${Math.floor(seconds / 86_400)}d`;
}

function ProxmoxDetail({ host }: { host: Host }) {
  return (
    <div className="proxmox-detail">
      <div className="proxmox-detail-heading"><span>HOST DRILL-DOWN</span><small>Fixture telemetry · read-only</small></div>
      <div className="metric-grid proxmox-detail-grid">
        <Metric label="CPU CLOCK" value={host.cpuClockMhz === null ? 'N/S' : (host.cpuClockMhz / 1_000).toFixed(1)} unit={host.cpuClockMhz === null ? '' : 'GHz'} detail={host.cpuClockMhz === null ? 'NOT SUPPORTED' : 'current clock'} />
        <Metric label="LOAD AVG" value={host.loadAverage?.map((value) => value.toFixed(2)).join(' / ') ?? 'N/S'} detail={host.loadAverage === null ? 'NOT SUPPORTED' : '1m / 5m / 15m'} />
        <Metric label="POWER" value={host.powerWatts ?? 'N/S'} unit={host.powerWatts === null ? '' : 'W'} detail={host.powerWatts === null ? 'NOT SUPPORTED' : 'measured package draw'} />
        <Metric label="SWAP" value={host.swapUsedBytes === null ? 'N/S' : bytesToGiB(host.swapUsedBytes)} unit={host.swapUsedBytes === null ? '' : ` / ${bytesToGiB(host.swapTotalBytes)} GiB`} detail={host.swapUsedBytes === null ? 'NOT SUPPORTED' : 'used / installed'} />
        <Metric label="UPTIME" value={uptimeLabel(host.uptimeSeconds)} detail={host.uptimeSeconds === null ? 'NOT SUPPORTED' : 'host runtime'} />
        <Metric label="GUESTS" value={`${host.runningVmCount ?? 'N/S'} VM / ${host.runningContainerCount ?? 'N/S'} CT`} detail={`stopped: ${host.stoppedVmCount ?? 'N/S'} VM / ${host.stoppedContainerCount ?? 'N/S'} CT`} />
      </div>
      <div className="proxmox-core-row"><span>PER-CORE</span>{host.cpuCorePercentages ? host.cpuCorePercentages.map((value, index) => <span key={index}>C{index} <b>{value}%</b></span>) : <span>NOT SUPPORTED</span>}</div>
      <div className="proxmox-storage-row"><span>STORAGE</span><span><b>{bytesToTiB(host.diskUsedBytes)} TiB</b> used / {bytesToTiB(host.diskTotalBytes)} TiB</span><span>DISK I/O <b>{host.diskIoPercent ?? 'N/S'}%</b></span></div>
    </div>
  );
}

export function ProxmoxPanel({ host, index, expanded, onExpand }: { host: Host; index: number; expanded: boolean; onExpand: () => void }) {
  const cpu = host.cpuPercent ?? 0;
  const memory = host.memoryPercent ?? 0;
  const download = Math.round((host.networkIngressBitsPerSecond ?? 0) / 1_000_000);
  const upload = Math.round((host.networkEgressBitsPerSecond ?? 0) / 1_000_000);
  const disk = host.diskTotalBytes === null || host.diskUsedBytes === null ? 0 : Math.round(host.diskUsedBytes / host.diskTotalBytes * 100);
  return (
    <Panel className="cpu-box pve-card" title={host.name} eyebrow="CPU / PROXMOX" severity={host.metadata.severity} freshness={host.metadata.freshness} href={`https://${host.name}.lab.seandre.dev:8006`} expanded={expanded} onExpand={onExpand}>
      <div className="pve-cpu-region">
        <DotGraph label="CPU" values={[Math.max(0, cpu - 16), Math.max(0, cpu - 7), Math.max(0, cpu - 11), cpu]} unit="%" tone="cpu" height={6} width={52} />
        <div className="pve-cpu-summary"><strong>{host.cpuModel ?? 'CPU MODEL N/S'}</strong><span>TEMP <b>{host.temperatureCelsius ?? '—'}°C</b></span><span>LOAD <b>{host.loadAverage?.[0].toFixed(2) ?? 'N/S'}</b></span><span>VMS <b>{host.runningVmCount ?? 'N/S'}</b></span><span>UP <b>{uptimeLabel(host.uptimeSeconds)}</b></span></div>
      </div>
      <div className="pve-resource-grid">
        <section className="pve-resource memory-resource"><h3>MEMORY</h3><DotGraph label="USED" values={[Math.max(0, memory - 14), Math.max(0, memory - 7), Math.max(0, memory - 3), memory]} unit="%" tone="memory" height={2} width={20} /><p><b>{bytesToGiB(host.memoryUsedBytes)} GiB</b> used / {bytesToGiB(host.memoryTotalBytes)} GiB</p><p>{host.memoryTotalBytes === null || host.memoryUsedBytes === null ? '—' : bytesToGiB(host.memoryTotalBytes - host.memoryUsedBytes)} GiB available</p></section>
        <section className="pve-resource disk-resource"><h3>DISKS</h3><DotGraph label="VM DATA" values={[Math.max(0, disk - 11), Math.max(0, disk - 6), Math.max(0, disk - 3), disk]} unit="%" tone="disk" height={2} width={20} /><p><b>{bytesToTiB(host.diskUsedBytes)} TiB</b> used / {bytesToTiB(host.diskTotalBytes)} TiB</p><p>IO <b>{host.diskIoPercent ?? '—'}%</b> · PBS {index === 0 ? '42' : '54'}%</p></section>
        <section className="pve-resource network-resource"><h3>NETWORK</h3><DotGraph label="DOWN" values={[Math.max(0, download - 38), Math.max(0, download - 22), Math.max(0, download - 9), download]} unit="Mb/s" tone="download" height={1} width={20} /><DotGraph label="UP" values={[Math.max(0, upload - 27), Math.max(0, upload - 12), Math.max(0, upload - 5), upload]} unit="Mb/s" tone="upload" height={1} width={20} /><p>RX <b>{download} Mb/s</b> · TX <b>{upload} Mb/s</b></p><p>vmbr0 · 192.168.40.{index === 0 ? '11' : '12'}</p></section>
      </div>
      {expanded ? <ProxmoxDetail host={host} /> : null}
    </Panel>
  );
}
