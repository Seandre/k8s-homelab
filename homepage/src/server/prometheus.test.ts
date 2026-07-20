import { describe, expect, it } from 'vitest';
import { PrometheusAdapter } from './prometheus.js';

describe('Prometheus adapter', () => {
  it('uses its fixed aggregate catalog and returns only normalized values', async () => {
    const urls: string[] = [];
    const adapter = new PrometheusAdapter('http://prometheus.monitoring.svc:9090', true);
    const result = await adapter.readCluster(async (url) => {
      urls.push(url);
      const query = new URL(url).searchParams.get('query');
      const values: Record<string, string> = {
        'sum(kube_node_status_capacity{resource="cpu"})': '12',
        'sum(kube_node_status_capacity{resource="memory"})': '34359738368',
        'sum(rate(container_cpu_usage_seconds_total{container!="",image!=""}[5m]))': '2.5',
        'sum(container_memory_working_set_bytes{container!="",image!=""})': '4294967296',
      };
      return { ok: true, json: async () => ({ status: 'success', data: { resultType: 'vector', result: [{ value: [0, values[query ?? '']!] }] } }) };
    });
    expect(result).toEqual({ cpuCapacityCores: 12, memoryCapacityBytes: 34359738368, cpuUsedCores: 2.5, memoryUsedBytes: 4294967296 });
    expect(urls).toHaveLength(4);
    expect(urls.every((url) => url.startsWith('http://prometheus.monitoring.svc:9090/api/v1/query?query='))).toBe(true);
  });
});
