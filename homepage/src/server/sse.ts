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
    for (const event of this.events.filter((candidate) => candidate.id > afterId)) this.writeEvent(connection, event);
    this.subscribers.add(connection);
    const unsubscribe = () => this.subscribers.delete(connection);
    connection.onClose(unsubscribe);
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

  private writeEvent(connection: SseConnection, event: BootstrapEvent) {
    const accepted = connection.write(`id: ${event.id}\nevent: bootstrap\ndata: ${JSON.stringify(event.data)}\n\n`);
    if (!accepted) {
      this.subscribers.delete(connection);
      connection.end();
    }
  }
}
