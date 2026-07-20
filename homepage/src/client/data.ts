import { useEffect, useState } from 'react';
import { BootstrapSchema, type Bootstrap } from '../shared/contracts.js';
import { healthyBootstrapFixture } from '../shared/fixtures.js';

export function parseBootstrapEvent(payload: string): Bootstrap | null {
  try { return BootstrapSchema.parse(JSON.parse(payload)); } catch { return null; }
}

export function useBootstrapData(initial: Bootstrap = healthyBootstrapFixture) {
  const [data, setData] = useState<Bootstrap>(initial);
  useEffect(() => {
    let disposed = false;
    let stream: EventSource | undefined;
    const load = async () => {
      try {
        const response = await fetch('/api/v1/bootstrap');
        if (!response.ok) return;
        const body: unknown = await response.json();
        const parsed = BootstrapSchema.safeParse((body as { data?: unknown }).data);
        if (!disposed && parsed.success) setData(parsed.data);
      } catch { /* Fixture data remains the safe offline fallback. */ }
    };
    const connect = () => {
      if (document.hidden || typeof EventSource === 'undefined') return;
      stream = new EventSource('/api/v1/events');
      stream.addEventListener('bootstrap', (event) => {
        const parsed = parseBootstrapEvent((event as MessageEvent<string>).data);
        if (!disposed && parsed) setData(parsed);
      });
    };
    const onVisibilityChange = () => {
      if (document.hidden) { stream?.close(); stream = undefined; }
      else { void load(); connect(); }
    };
    void load(); connect();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { disposed = true; stream?.close(); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, []);
  return data;
}
