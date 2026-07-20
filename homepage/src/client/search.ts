import type { ServiceStatus } from '../shared/contracts.js';
import { healthyBootstrapFixture } from '../shared/fixtures.js';

export type SearchResultKind = 'service' | 'host' | 'document' | 'runbook' | 'action' | 'web';

export interface SearchResult {
  id: string;
  label: string;
  description: string;
  kind: SearchResultKind;
  href: string;
  external?: boolean;
  action?: 'help';
}

function serviceResult(service: ServiceStatus): SearchResult {
  return { id: `service-${service.id}`, label: service.name, description: `${service.group} · ${service.description}`, kind: 'service', href: service.href, external: true };
}

export const dashboardSearchItems: SearchResult[] = [
  ...healthyBootstrapFixture.services.map(serviceResult),
  ...healthyBootstrapFixture.hosts.map((host) => ({ id: `host-${host.id}`, label: host.name, description: `${host.kind.replace('_', ' ')} host detail`, kind: 'host' as const, href: '/compute' })),
  { id: 'doc-homelab', label: 'Homelab documentation', description: 'Infrastructure documentation and runbooks', kind: 'document', href: 'https://docs.lab.seandre.dev', external: true },
  { id: 'runbook-preview', label: 'Homepage preview runbook', description: 'Preview validation and rollback instructions', kind: 'runbook', href: 'https://docs.lab.seandre.dev', external: true },
  { id: 'action-overview', label: 'Open overview', description: 'Return to the operations overview', kind: 'action', href: '/' },
  { id: 'action-keyboard-help', label: 'Open keyboard help', description: 'Show all dashboard shortcuts', kind: 'action', href: '#help', action: 'help' },
];

export function searchDashboard(query: string, limit = 8): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const terms = normalized.split(/\s+/);
  const scored = dashboardSearchItems.map((item) => {
    const label = item.label.toLowerCase();
    const description = item.description.toLowerCase();
    const score = terms.reduce((total, term) => total + (label === term ? 100 : 0) + (label.startsWith(term) ? 60 : 0) + (label.includes(term) ? 35 : 0) + (description.includes(term) ? 15 : 0), 0);
    return { item, score };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label));
  return [...scored.slice(0, Math.max(0, limit - 1)).map(({ item }) => item), { id: `web-${normalized}`, label: `Search DuckDuckGo for “${query.trim()}”`, description: 'Web search · opens in a new tab', kind: 'web', href: `https://duckduckgo.com/?q=${encodeURIComponent(query.trim())}`, external: true }];
}

export function nextSearchIndex(current: number, length: number, direction: -1 | 1) {
  if (length === 0) return -1;
  return (current + direction + length) % length;
}
