import { describe, expect, it } from 'vitest';
import { gitOwnedRuntimeConfig, loadRuntimeConfig, RuntimeConfigurationError } from './runtime-config.js';

describe('Git-owned runtime configuration', () => {
  it('accepts the checked-in allowlist including private cluster hostnames', () => {
    expect(loadRuntimeConfig(gitOwnedRuntimeConfig)).toEqual(gitOwnedRuntimeConfig);
    expect(gitOwnedRuntimeConfig.sources.find((source) => source.id === 'prometheus-source')?.endpoint).toContain('.svc:9090');
    expect(gitOwnedRuntimeConfig.allowedHosts).toContain('pve-01.lab.seandre.dev');
  });

  it('rejects unknown fields, duplicate IDs, invalid URLs, and invalid thresholds at startup', () => {
    expect(() => loadRuntimeConfig({ ...gitOwnedRuntimeConfig, unsafe: true })).toThrow(RuntimeConfigurationError);
    expect(() => loadRuntimeConfig({ ...gitOwnedRuntimeConfig, views: [...gitOwnedRuntimeConfig.views, { id: 'overview', enabled: true }] })).toThrow('IDs must be unique');
    expect(() => loadRuntimeConfig({ ...gitOwnedRuntimeConfig, sources: [{ ...gitOwnedRuntimeConfig.sources[0]!, endpoint: 'ftp://example.com' }] })).toThrow('Only HTTP');
    expect(() => loadRuntimeConfig({ ...gitOwnedRuntimeConfig, thresholds: { ...gitOwnedRuntimeConfig.thresholds, cpuWarnPercent: 95 } })).toThrow('warning threshold');
    expect(() => loadRuntimeConfig({ ...gitOwnedRuntimeConfig, serviceLinks: [{ ...gitOwnedRuntimeConfig.serviceLinks[0]!, href: 'https://example.com' }] })).toThrow('not allowlisted');
  });

  it('keeps every integration Git-owned and limits probes to declared targets', () => {
    const weather = gitOwnedRuntimeConfig.sources.find((source) => source.id === 'weather-source')!;
    expect(weather).toMatchObject({ enabled: true, stateWhenDisabled: 'NOT_SUPPORTED' });
    expect(gitOwnedRuntimeConfig.featureFlags.prometheus).toBe(true);
    expect(gitOwnedRuntimeConfig.probes.every((probe) => probe.target !== 'https://example.com')).toBe(true);
  });

  it('permits an explicitly Git-allowlisted private IP without enabling general target selection', () => {
    const privateConfig = loadRuntimeConfig({ ...gitOwnedRuntimeConfig, allowedHosts: [...gitOwnedRuntimeConfig.allowedHosts, '192.168.40.30'], sources: [{ ...gitOwnedRuntimeConfig.sources[0]!, endpoint: 'https://192.168.40.30' }, ...gitOwnedRuntimeConfig.sources.slice(1)] });
    expect(privateConfig.sources[0]?.endpoint).toBe('https://192.168.40.30');
  });
});
