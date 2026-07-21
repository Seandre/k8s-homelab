import type { Bootstrap } from '../shared/contracts.js';

export interface BootstrapEvent {
  id: number;
  data: Bootstrap;
}

export interface SseConnection {
  write(chunk: string): boolean;
  end(): void;
  onClose(handler: () => void): void;
}

export class BootstrapEventBroker {
  private readonly events: BootstrapEvent[] = [];
  private readonly subscribers = new Set<SseConnection>();
  private nextId = 1;

  constructor(private readonly eventLimit = 100) {}

  publish(data: Bootstrap): BootstrapEvent {
    const event = { id: this.nextId++, data };
    this.events.push(event);
    if (this.events.length > this.eventLimit) this.events.shift();
    for (const connection of this.subscribers) this.writeEvent(connection, event);
    return event;
  }

  subscribe(connection: SseConnection, afterId = 0): () => void {
    const unsubscribe = () => this.subscribers.delete(connection);
    connection.onClose(unsubscribe);
    this.subscribers.add(connection);
    for (const event of this.events.filter((candidate) => candidate.id > afterId)) {
      if (!this.writeEvent(connection, event)) break;
    }
    return unsubscribe;
  }

  keepAlive(connection: SseConnection) {
    if (!connection.write(': keepalive\n\n')) {
      this.subscribers.delete(connection);
      connection.end();
    }
  }

  eventCount() {
    return this.events.length;
  }

  subscriberCount() {
    return this.subscribers.size;
  }

  latestEventId() {
    return this.nextId - 1;
  }

  private writeEvent(connection: SseConnection, event: BootstrapEvent): boolean {
    let accepted = false;
    try { accepted = connection.write(`id: ${event.id}\nevent: bootstrap\ndata: ${JSON.stringify(event.data)}\n\n`); } catch { accepted = false; }
    if (!accepted) {
      this.subscribers.delete(connection);
      connection.end();
    }
    return accepted;
  }
}
