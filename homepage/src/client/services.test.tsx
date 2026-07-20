import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ServicesScreen } from './services.js';

describe('Services fixture launcher', () => {
  it('preserves every baseline service and bookmark destination', () => {
    const html = renderToStaticMarkup(<ServicesScreen search="" />);
    for (const label of ['Argo CD', 'Grafana', 'UniFi', 'pve-01', 'pve-02', 'bastion-01', 'CPU Temperature', 'System NVMe Temperature', 'VM Data NVMe Temperature', 'Host OS Storage', 'VM Data Disk I/O', 'Proxmox Network', 'Homelab Docs', 'nginx test', 'Repository', 'Homepage GitHub']) expect(html).toContain(label);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('SERVER CHECK: NOT CHECKED');
  });

  it('supports filtered, empty, unreachable, and stale fixture states', () => {
    const html = renderToStaticMarkup(<ServicesScreen search="pve" />);
    expect(html).toContain('STALE');
    expect(html).toContain('NO DATA');
    expect(renderToStaticMarkup(<ServicesScreen search="pve-02" />)).toContain('2 matching destinations');
    expect(renderToStaticMarkup(<ServicesScreen search="does not exist" />)).toContain('No local service matches');
  });
});
