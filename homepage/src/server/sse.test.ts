import { describe, expect, it } from 'vitest';
import { healthyBootstrapFixture } from '../shared/fixtures.js';
import { BootstrapEventBroker, type SseConnection } from './sse.js';

function connection(accept = true) {
  const writes: string[] = [];
  let close: (() => void) | undefined;
  let ended = false;
  const value: SseConnection = { write: (chunk) => { writes.push(chunk); return accept; }, end: () => { ended = true; }, onClose: (handler) => { close = handler; } };
  return { value, writes, close: () => close?.(), get ended() { return ended; } };
}

describe('bootstrap SSE broker', () => {
  it('orders event IDs and replays only missed events after reconnect', () => {
    const broker = new BootstrapEventBroker();
    broker.publish(healthyBootstrapFixture); broker.publish({ ...healthyBootstrapFixture, generatedAt: '2026-07-19T12:01:00.000Z' });
    expect(broker.latestEventId()).toBe(2);
    const first = connection(); broker.subscribe(first.value, 0);
    expect(first.writes.join('')).toContain('id: 1');
    expect(first.writes.join('')).toContain('id: 2');
    const resumed = connection(); broker.subscribe(resumed.value, 1);
    expect(resumed.writes.join('')).not.toContain('id: 1');
    expect(resumed.writes.join('')).toContain('id: 2');
  });

  it('closes slow clients instead of retaining unbounded backpressure', () => {
    const broker = new BootstrapEventBroker();
    const slow = connection(false); broker.subscribe(slow.value);
    broker.publish(healthyBootstrapFixture);
    expect(slow.ended).toBe(true);
    expect(broker.subscriberCount()).toBe(0);
  });

  it('does not retain a connection that closes while replaying buffered events', () => {
    const broker = new BootstrapEventBroker();
    broker.publish(healthyBootstrapFixture);
    const closedDuringReplay = connection(false);
    broker.subscribe(closedDuringReplay.value);
    expect(closedDuringReplay.ended).toBe(true);
    expect(broker.subscriberCount()).toBe(0);
  });
});
