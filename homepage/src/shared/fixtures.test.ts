import { describe, expect, it } from 'vitest';
import { BootstrapSchema, FreshnessSchema, SeveritySchema } from './contracts.js';
import { healthyBootstrapFixture } from './fixtures.js';

describe('shared contracts', () => {
  it('accepts the complete deterministic bootstrap fixture', () => {
    expect(BootstrapSchema.parse(healthyBootstrapFixture)).toEqual(healthyBootstrapFixture);
  });

  it('restricts severity and freshness to the approved values', () => {
    expect(SeveritySchema.safeParse('ERROR').success).toBe(false);
    expect(FreshnessSchema.safeParse('UNKNOWN').success).toBe(false);
    expect(FreshnessSchema.options).toEqual([
      'CURRENT',
      'STALE',
      'NO_DATA',
      'NOT_PROVISIONED',
      'NOT_SUPPORTED',
    ]);
  });

  it('rejects credential-shaped fields in the public bootstrap contract', () => {
    expect(BootstrapSchema.safeParse({ ...healthyBootstrapFixture, token: 'never' }).success).toBe(false);
    expect(BootstrapSchema.parse(healthyBootstrapFixture)).not.toHaveProperty('token');
  });
});
