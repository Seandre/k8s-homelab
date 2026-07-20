import React from 'react';
import { FreshnessLabel, StateBadge } from './components.js';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import type { Bootstrap } from '../shared/contracts.js';

function filterServices(search: string, bootstrap: Bootstrap) {
  const query = search.trim().toLowerCase();
  return bootstrap.services.filter((service) => !query || `${service.name} ${service.group} ${service.description}`.toLowerCase().includes(query));
}

export function ServicesScreen({ search, bootstrap = healthyBootstrapFixture }: { search: string; bootstrap?: Bootstrap }) {
  const services = filterServices(search, bootstrap);
  const groups = [...new Set(services.map((service) => service.group))];
  return <main className="dashboard" id="services">
    <section className="hero-row"><div><span className="panel-eyebrow">SERVICE LAUNCHER / FIXTURE MODE</span><h1>Services and bookmarks</h1></div><span className="hero-state">{services.length} matching destination{services.length === 1 ? '' : 's'}</span></section>
    {services.length === 0 ? <div className="empty-state service-empty">No local service matches. Try another name, group, or description.</div> : <div className="service-launcher">{groups.map((group) => <section key={group} aria-labelledby={`service-group-${group}`}><div className="section-heading"><span className="panel-eyebrow">{group}</span><h2 id={`service-group-${group}`}>{group}</h2></div><div className="service-launcher-grid">{services.filter((service) => service.group === group).map((service) => <a className="service-launcher-card" href={service.href} target="_blank" rel="noreferrer" key={service.id} aria-label={`Open ${service.name} in a new tab`}><span><strong>{service.name}</strong><small>{service.description}</small></span><span className="service-launcher-state"><StateBadge severity={service.metadata.severity} label={service.status} /><FreshnessLabel freshness={service.metadata.freshness} /></span><small className="reachability">SERVER CHECK: {service.latencyMs === null ? 'NOT CHECKED' : `${service.latencyMs} ms`}</small></a>)}</div></section>)}</div>}
  </main>;
}
