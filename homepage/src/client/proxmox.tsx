import React from 'react';
import type { Host, TimeSeries } from '../shared/contracts.js';
import { DotGraph, Metric, Panel } from './components.js';
import { bytesToGiB, bytesToTiB } from './overview.js';

function uptimeLabel(seconds: number | null) {
  if (seconds === null) return '—';
  return `${Math.floor(seconds / 86_400)}d`;
}

function ProxmoxDetail({ host }: { host: Host }) {
  return (
    <div className="proxmox-detail">
      <div className="proxmox-detail-heading"><span>HOST DRILL-DOWN</span><small>Live read-only telemetry</small></div>
      <div className="metric-grid proxmox-detail-grid">
        <Metric label="CPU CLOCK" value={host.cpuClockMhz === null ? 'N/S' : (host.cpuClockMhz / 1_000).toFixed(1)} unit={host.cpuClockMhz === null ? '' : 'GHz'} detail={host.cpuClockMhz === null ? 'NOT SUPPORTED' : 'current clock'} />
        <Metric label="LOAD AVG" value={host.loadAverage?.map((value) => value.toFixed(2)).join(' / ') ?? 'N/S'} detail={host.loadAverage === null ? 'NOT SUPPORTED' : '1m / 5m / 15m'} />
        <Metric label="POWER" value={host.powerWatts ?? 'N/S'} unit={host.powerWatts === null ? '' : 'W'} detail={host.powerWatts === null ? 'NOT SUPPORTED' : 'PDU outlet draw'} />
        <Metric label="SWAP" value={host.swapUsedBytes === null ? 'N/S' : bytesToGiB(host.swapUsedBytes)} unit={host.swapUsedBytes === null ? '' : ` / ${bytesToGiB(host.swapTotalBytes)} GiB`} detail={host.swapUsedBytes === null ? 'NOT SUPPORTED' : 'used / installed'} />
        <Metric label="UPTIME" value={uptimeLabel(host.uptimeSeconds)} detail={host.uptimeSeconds === null ? 'NOT SUPPORTED' : 'host runtime'} />
        <Metric label="GUESTS" value={`${host.runningVmCount ?? 'N/S'} VM / ${host.runningContainerCount ?? 'N/S'} CT`} detail={`stopped: ${host.stoppedVmCount ?? 'N/S'} VM / ${host.stoppedContainerCount ?? 'N/S'} CT`} />
      </div>
      <div className="proxmox-core-row"><span>PER-CORE</span>{host.cpuCorePercentages ? host.cpuCorePercentages.map((value, index) => <span key={index}>C{index} <b>{value}%</b></span>) : <span>NOT SUPPORTED</span>}</div>
      <div className="proxmox-storage-row"><span>STORAGE</span><span><b>{bytesToTiB(host.diskUsedBytes)} TiB</b> used / {bytesToTiB(host.diskTotalBytes)} TiB</span><span>I/O WAIT <b>{host.diskIoPercent ?? 'N/S'}%</b></span></div>
    </div>
  );
}

function seriesValues(series: TimeSeries[], metric: string, current: number | null) { return series.find((entry) => entry.metric === metric)?.points.map((point) => point.value) ?? (current === null ? [] : [current]); }

export function ProxmoxPanel({ host, expanded, onExpand, timeSeries = [] }: { host: Host; expanded: boolean; onExpand: () => void; timeSeries?: TimeSeries[] }) {
  const cpu = host.cpuPercent;
  const memory = host.memoryPercent;
  const download = host.networkIngressBitsPerSecond === null ? null : Math.round(host.networkIngressBitsPerSecond / 1_000_000);
  const upload = host.networkEgressBitsPerSecond === null ? null : Math.round(host.networkEgressBitsPerSecond / 1_000_000);
  const disk = host.diskTotalBytes === null || host.diskUsedBytes === null ? null : Math.round(host.diskUsedBytes / host.diskTotalBytes * 100);
  return (
    <Panel className="cpu-box pve-card" title={host.name} eyebrow="CPU / PROXMOX" severity={host.metadata.severity} freshness={host.metadata.freshness} href={`https://${host.name}.lab.seandre.dev:8006`} expanded={expanded} onExpand={onExpand}>
      <div className="pve-cpu-region">
        <DotGraph label="CPU" values={seriesValues(timeSeries, `${host.name} CPU`, cpu)} unit="%" tone="cpu" height={8} width={52} />
        <div className="pve-cpu-summary"><strong>{host.cpuModel ?? 'CPU MODEL N/S'}</strong><span>TEMP <b>{host.temperatureCelsius ?? '—'}°C</b></span><span>LOAD <b>{host.loadAverage?.[0].toFixed(2) ?? 'N/S'}</b></span><span>PWR <b>{host.powerWatts ?? 'N/S'}{host.powerWatts === null ? '' : ' W'}</b></span><span>VMS <b>{host.runningVmCount ?? 'N/S'}</b></span><span>UP <b>{uptimeLabel(host.uptimeSeconds)}</b></span></div>
      </div>
      <div className="pve-resource-grid">
        <section className="pve-resource memory-resource"><h3>MEMORY</h3><DotGraph label="USED" values={seriesValues(timeSeries, `${host.name} MEMORY`, memory)} unit="%" tone="memory" height={2} width={20} /><p><b>{bytesToGiB(host.memoryUsedBytes)} GiB</b> used / {bytesToGiB(host.memoryTotalBytes)} GiB</p><p>{host.memoryTotalBytes === null || host.memoryUsedBytes === null ? '—' : bytesToGiB(host.memoryTotalBytes - host.memoryUsedBytes)} GiB available</p></section>
        <section className="pve-resource disk-resource"><h3>DISKS</h3><DotGraph label="VM DATA" values={seriesValues(timeSeries, `${host.name} DISK`, disk)} unit="%" tone="disk" height={2} width={20} /><p><b>{bytesToTiB(host.diskUsedBytes)} TiB</b> used / {bytesToTiB(host.diskTotalBytes)} TiB</p><p>I/O WAIT <b>{host.diskIoPercent ?? '—'}%</b></p></section>
        <section className="pve-resource network-resource"><h3>NETWORK</h3><DotGraph label="DOWN" values={seriesValues(timeSeries, `${host.name} RX`, download)} unit="Mb/s" tone="download" height={1} width={20} /><DotGraph label="UP" values={seriesValues(timeSeries, `${host.name} TX`, upload)} unit="Mb/s" tone="upload" height={1} width={20} /><p>RX <b>{download ?? 'N/S'}{download === null ? '' : ' Mb/s'}</b> · TX <b>{upload ?? 'N/S'}{upload === null ? '' : ' Mb/s'}</b></p><p>Live Glances bridge</p></section>
      </div>
      {expanded ? <ProxmoxDetail host={host} /> : null}
    </Panel>
  );
}
