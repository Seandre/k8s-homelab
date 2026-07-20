import { describe, expect, it } from 'vitest';
import { ArgoCdAdapter, type ArgoFetch } from './argocd.js';
import type { Clock } from './normalization.js';

const clock: Clock = { now: () => new Date('2026-07-19T12:00:00.000Z') };
const response = { items: [{ metadata: { name: 'homelab' }, spec: { project: 'default' }, status: { health: { status: 'Healthy' }, sync: { status: 'Synced' }, operationState: { phase: 'Succeeded', syncResult: { revision: 'abc123' }, message: 'Sync completed.' } } }, { metadata: { name: 'koreader-sync' }, spec: { project: 'default' }, status: { health: { status: 'Progressing' }, sync: { status: 'OutOfSync' } } }] };

describe('Argo CD read-only adapter', () => {
  it('uses the Applications read endpoint and exposes only the approved summary fields', async () => {
    const seen: Array<{ url: string; authorization: string }> = [];
    const fetcher: ArgoFetch = async (url, init) => { seen.push({ url, authorization: init.headers.authorization }); return { ok: true, json: async () => response }; };
    const apps = await new ArgoCdAdapter('https://argocd.lab.seandre.dev', 'test-token', true, clock).read(fetcher);
    expect(seen).toEqual([{ url: 'https://argocd.lab.seandre.dev/api/v1/applications', authorization: 'Bearer test-token' }]);
    expect(apps).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'homelab', health: 'Healthy', sync: 'Synced', revision: 'abc123', metadata: expect.objectContaining({ severity: 'OK' }) }), expect.objectContaining({ name: 'koreader-sync', metadata: expect.objectContaining({ severity: 'WARN' }) })]));
    expect(apps?.[0]).not.toHaveProperty('spec');
  });

  it('does not request Argo CD when disabled', async () => {
    const fetcher: ArgoFetch = async () => { throw new Error('must not be called'); };
    expect(await new ArgoCdAdapter('https://argocd.lab.seandre.dev', 'token', false, clock).read(fetcher)).toBeNull();
  });
});
