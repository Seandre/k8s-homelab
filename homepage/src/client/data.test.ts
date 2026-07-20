import { describe, expect, it } from 'vitest';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import { parseBootstrapEvent } from './data.js';

describe('client bootstrap event parsing', () => {
  it('accepts validated updates and drops malformed events', () => {
    expect(parseBootstrapEvent(JSON.stringify(healthyBootstrapFixture))).toEqual(healthyBootstrapFixture);
    expect(parseBootstrapEvent('{not-json}')).toBeNull();
    expect(parseBootstrapEvent(JSON.stringify({ schemaVersion: 1 }))).toBeNull();
  });
});
