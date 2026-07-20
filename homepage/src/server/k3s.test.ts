import { describe, expect, it } from 'vitest';
import { K3sAdapter, type K3sReadClient } from './k3s.js';
import type { Clock } from './normalization.js';

const clock: Clock = { now: () => new Date('2026-07-19T12:00:00.000Z') };
const nodes = { items: [{ metadata: { name: 'k3s-control-01' }, status: { conditions: [{ type: 'Ready', status: 'True' }] } }, { metadata: { name: 'k3s-worker-02' }, status: { conditions: [{ type: 'Ready', status: 'False' }] } }] };
const deployments = { items: [{ metadata: { name: 'homepage', namespace: 'homelab' }, spec: { replicas: 2 }, status: { readyReplicas: 2 } }, { metadata: { name: 'koreader-sync', namespace: 'apps' }, spec: { replicas: 1 }, status: { readyReplicas: 0 } }] };
const empty = { items: [] };
function client(): K3sReadClient { return { listNodes: async () => nodes, listDeployments: async () => deployments, listStatefulSets: async () => empty, listDaemonSets: async () => empty }; }

describe('k3s read-only adapter', () => {
  it('normalizes only node and workload summary fields into shared contracts', async () => {
    const snapshot = await new K3sAdapter(client(), clock).read();
    expect(snapshot?.cluster).toMatchObject({ nodeCount: 2, readyNodeCount: 1, workloadCount: 2 });
    expect(snapshot?.hosts.find((host) => host.name === 'k3s-worker-02')?.metadata.severity).toBe('WARN');
    expect(snapshot?.workloads.find((workload) => workload.name === 'koreader-sync')).toMatchObject({ readyReplicas: 0, desiredReplicas: 1, href: null, metadata: { severity: 'WARN' } });
  });

  it('returns a scoped no-data state after a permission denial without leaking raw errors', async () => {
    const denied: K3sReadClient = { listNodes: async () => { throw new Error('403 token=secret'); }, listDeployments: async () => empty, listStatefulSets: async () => empty, listDaemonSets: async () => empty };
    expect(await new K3sAdapter(denied, clock).read()).toBeNull();
  });
});
