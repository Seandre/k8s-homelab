import { z } from 'zod';
import type { Cluster, Host, Workload } from '../shared/contracts.js';
import { SourceNormalizer, type Clock } from './normalization.js';

const NodeListSchema = z.object({ items: z.array(z.object({ metadata: z.object({ name: z.string().min(1) }), status: z.object({ conditions: z.array(z.object({ type: z.string(), status: z.string() })) }) })) });
const WorkloadListSchema = z.object({ items: z.array(z.object({ metadata: z.object({ name: z.string().min(1), namespace: z.string().min(1) }), spec: z.object({ replicas: z.number().int().nonnegative().optional() }).optional(), status: z.object({ readyReplicas: z.number().int().nonnegative().optional(), currentNumberScheduled: z.number().int().nonnegative().optional(), desiredNumberScheduled: z.number().int().nonnegative().optional() }).optional() })) });

export interface K3sReadClient {
  listNodes(): Promise<unknown>;
  listDeployments(): Promise<unknown>;
  listStatefulSets(): Promise<unknown>;
  listDaemonSets(): Promise<unknown>;
}

export interface K3sSnapshot { cluster: Cluster; hosts: Host[]; workloads: Workload[]; }

type RawSnapshot = { nodes: z.infer<typeof NodeListSchema>; deployments: z.infer<typeof WorkloadListSchema>; statefulSets: z.infer<typeof WorkloadListSchema>; daemonSets: z.infer<typeof WorkloadListSchema> };

function nodeReady(conditions: Array<{ type: string; status: string }>) { return conditions.some((condition) => condition.type === 'Ready' && condition.status === 'True'); }
function nodeHost(name: string, ready: boolean, metadata: Host['metadata']): Host {
  return { id: name, name, kind: 'K3S_NODE', cpuPercent: null, memoryPercent: null, memoryUsedBytes: null, memoryTotalBytes: null, diskUsedBytes: null, diskTotalBytes: null, diskIoPercent: null, cpuModel: null, cpuCorePercentages: null, loadAverage: null, cpuClockMhz: null, powerWatts: null, swapUsedBytes: null, swapTotalBytes: null, uptimeSeconds: null, runningVmCount: null, stoppedVmCount: null, runningContainerCount: null, stoppedContainerCount: null, temperatureCelsius: null, networkIngressBitsPerSecond: null, networkEgressBitsPerSecond: null, metadata: { ...metadata, severity: ready ? 'OK' : 'WARN', message: ready ? undefined : 'Node is not Ready.' } };
}
function workloadRecords(kind: string, list: z.infer<typeof WorkloadListSchema>, metadata: Workload['metadata']): Workload[] {
  return list.items.map((item) => {
    const desired = item.spec?.replicas ?? item.status?.desiredNumberScheduled ?? 1;
    const ready = item.status?.readyReplicas ?? item.status?.currentNumberScheduled ?? 0;
    const healthy = ready >= desired;
    return { id: `${kind}:${item.metadata.namespace}:${item.metadata.name}`, name: item.metadata.name, clusterId: 'k3s', namespace: item.metadata.namespace, readyReplicas: ready, desiredReplicas: desired, href: null, metadata: { ...metadata, severity: healthy ? 'OK' : 'WARN', message: healthy ? undefined : 'Workload is not fully ready.' } };
  });
}

export class K3sAdapter {
  private readonly normalizer: SourceNormalizer<RawSnapshot>;
  constructor(private readonly client: K3sReadClient, clock?: Clock) {
    this.normalizer = new SourceNormalizer<RawSnapshot>({ source: 'k3s-api', staleAfterMs: 30_000, ...(clock ? { clock } : {}) });
  }

  async read(): Promise<K3sSnapshot | null> {
    if (this.normalizer.canAttempt()) {
      try {
        const [nodes, deployments, statefulSets, daemonSets] = await Promise.all([this.client.listNodes(), this.client.listDeployments(), this.client.listStatefulSets(), this.client.listDaemonSets()]);
        this.normalizer.recordSuccess({ nodes: NodeListSchema.parse(nodes), deployments: WorkloadListSchema.parse(deployments), statefulSets: WorkloadListSchema.parse(statefulSets), daemonSets: WorkloadListSchema.parse(daemonSets) });
      } catch { this.normalizer.recordFailure(); }
    }
    const snapshot = this.normalizer.snapshot();
    if (!snapshot.value) return null;
    const hosts = snapshot.value.nodes.items.map((node) => nodeHost(node.metadata.name, nodeReady(node.status.conditions), snapshot.metadata));
    const workloads = [workloadRecords('deployment', snapshot.value.deployments, snapshot.metadata), workloadRecords('statefulset', snapshot.value.statefulSets, snapshot.metadata), workloadRecords('daemonset', snapshot.value.daemonSets, snapshot.metadata)].flat();
    return { hosts, workloads, cluster: { id: 'k3s', name: 'k3s', platform: 'K3S', nodeCount: hosts.length, readyNodeCount: hosts.filter((host) => host.metadata.severity === 'OK').length, workloadCount: workloads.length, cpuCapacityCores: null, cpuUsedCores: null, memoryCapacityBytes: null, memoryUsedBytes: null, metadata: snapshot.metadata } };
  }
}
