import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import { ProxmoxPanel } from './proxmox.js';

describe('Proxmox drill-down', () => {
  it('renders the full approved host-detail metric set', () => {
    const host = healthyBootstrapFixture.hosts.find((candidate) => candidate.id === 'pve-01')!;
    const markup = renderToStaticMarkup(<ProxmoxPanel host={host} expanded onExpand={() => undefined} />);
    expect(markup).toContain('PER-CORE');
    expect(markup).toContain('CPU CLOCK');
    expect(markup).toContain('LOAD AVG');
    expect(markup).toContain('POWER');
    expect(markup).toContain('PWR');
    expect(markup).toContain('82 W');
    expect(markup).toContain('PDU outlet draw');
    expect(markup).toContain('SWAP');
    expect(markup).toContain('STORAGE');
    expect(markup).toContain('GUESTS');
    expect(markup).toContain('32 vertical Braille dot levels');
  });

  it('labels a partial supported metric as not supported instead of inventing a value', () => {
    const host = healthyBootstrapFixture.hosts.find((candidate) => candidate.id === 'pve-02')!;
    const markup = renderToStaticMarkup(<ProxmoxPanel host={{ ...host, powerWatts: null }} expanded onExpand={() => undefined} />);
    expect(markup).toContain('NOT SUPPORTED');
    expect(markup).toContain('STALE');
  });
});
