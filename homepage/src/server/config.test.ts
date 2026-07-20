import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('loads safe defaults', () => {
    expect(loadConfig({})).toEqual({
      environment: 'development',
      host: '0.0.0.0',
      port: 3000,
      shutdownGraceMs: 10_000,
    });
  });

  it('rejects invalid configuration', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(ConfigurationError);
  });
});
