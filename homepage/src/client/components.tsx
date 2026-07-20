import React, { useId, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { Freshness, Severity, TimeSeries } from '../shared/contracts.js';
import { toBrailleGraphRows } from './graph.js';

export function StateBadge({ severity, label = severity }: { severity: Severity; label?: string }) {
  return <span className={`state state-${severity.toLowerCase()}`}>{label}</span>;
}

export function FreshnessLabel({ freshness, ageSeconds }: { freshness: Freshness; ageSeconds?: number }) {
  const age = ageSeconds === undefined ? '' : ` · ${ageSeconds}s old`;
  return <span className={`freshness freshness-${freshness.toLowerCase()}`}>{freshness.replace('_', ' ')}{age}</span>;
}

export function Metric({ label, value, unit = '', detail }: { label: string; value: ReactNode; unit?: string; detail?: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}<small>{unit}</small></strong>
      {detail ? <span className="metric-detail">{detail}</span> : null}
    </div>
  );
}

export function Sparkline({ series, label }: { series: TimeSeries; label: string }) {
  const values = series.points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 92 - ((value - min) / range) * 78;
    return `${x},${y}`;
  }).join(' ');
  const summary = `${label}: ${values.at(-1) ?? 'no'} ${series.unit}; ${series.window} window; ${values.length} samples.`;
  return (
    <div className="sparkline-wrap">
      <svg className="sparkline" viewBox="0 0 100 100" role="img" aria-label={summary} preserveAspectRatio="none">
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="sr-only">{summary}</span>
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  severity = 'OK',
  freshness = 'CURRENT',
  children,
  href,
  expanded = false,
  onExpand,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  severity?: Severity;
  freshness?: Freshness;
  children: ReactNode;
  href?: string;
  expanded?: boolean;
  onExpand?: () => void;
  className?: string;
}) {
  const titleId = useId();
  const interactive = onExpand !== undefined;
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onExpand();
    }
  };
  return (
    <section
      className={`panel ${className} ${expanded ? 'panel-expanded' : ''}`}
      aria-labelledby={titleId}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onClick={interactive ? onExpand : undefined}
    >
      <header className="panel-header">
        <div>
          {eyebrow ? <span className="panel-eyebrow">{eyebrow}</span> : null}
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="panel-state"><StateBadge severity={severity} /><FreshnessLabel freshness={freshness} /></div>
      </header>
      <div className="panel-body">{children}</div>
      <footer className="panel-footer">
        {href ? <a className="open-link" href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open ↗</a> : <span />}
        {interactive ? <button className="expand-button" type="button" onClick={(event) => { event.stopPropagation(); onExpand(); }}>{expanded ? 'Close details' : 'Expand details'}</button> : null}
      </footer>
    </section>
  );
}

export function DetailDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <aside className="drawer" aria-label={`${title} details`}>
      <div className="drawer-header"><h2>{title}</h2><button type="button" onClick={onClose}>Close</button></div>
      {children}
    </aside>
  );
}

export function DotGraph({ label, values, unit, tone = 'cpu', height = 2, width = 64 }: { label: string; values: number[]; unit: string; tone?: 'cpu' | 'memory' | 'disk' | 'download' | 'upload'; height?: number; width?: number }) {
  const hasSamples = values.length > 0;
  const activeCells = Math.min(width, Math.max(1, Math.ceil(values.length / 2)));
  const graphRows = toBrailleGraphRows(values, activeCells, height);
  const rows = hasSamples ? graphRows.map((row) => `${'\u00a0'.repeat(width - activeCells)}${row}`) : Array.from({ length: height }, () => '\u00a0'.repeat(width));
  const current = hasSamples ? `${values.at(-1)}${unit}` : 'N/S';
  return <div className={`dot-graph dot-graph-${tone}`} role="img" aria-label={`${label}: ${current}; ${values.length} samples; ${height * 4} vertical Braille dot levels`}><div className="dot-graph-trace" style={{ '--graph-columns': width } as CSSProperties} aria-hidden="true">{rows.map((row, index) => <span className="dot-graph-row" key={index}>{row}</span>)}</div><small>{label} {current}</small></div>;
}

export function ComponentGallery() {
  return (
    <section className="gallery" aria-labelledby="gallery-title">
      <div className="section-heading"><span className="panel-eyebrow">HP-007</span><h2 id="gallery-title">Component states</h2></div>
      <div className="gallery-grid">
        <Panel title="Healthy panel" severity="OK"><Metric label="Current" value="42" unit="%" /></Panel>
        <Panel title="Warning panel" severity="WARN" freshness="STALE"><Metric label="Last value" value="76" unit="%" detail="Muted until recovery" /></Panel>
        <Panel title="Critical panel" severity="CRIT" freshness="NO_DATA"><Metric label="Current" value="—" detail="No successful sample" /></Panel>
        <Panel title="Planned panel" severity="INFO" freshness="NOT_PROVISIONED"><Metric label="Status" value="N/P" detail="Future system" /></Panel>
        <Panel title="Unsupported panel" severity="INFO" freshness="NOT_SUPPORTED"><Metric label="Status" value="N/S" detail="Adapter not verified" /></Panel>
      </div>
    </section>
  );
}
