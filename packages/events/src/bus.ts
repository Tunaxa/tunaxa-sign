import type { DomainEvent, EventHandler } from "./types";

type HandlerEntry = {
  handler: EventHandler;
  eventTypes: string[];
};

class EventBus {
  private handlers: HandlerEntry[] = [];

  on<T extends DomainEvent["type"]>(
    eventType: T,
    handler: EventHandler<Extract<DomainEvent, { type: T }>>
  ): () => void {
    const entry: HandlerEntry = {
      handler: handler as EventHandler,
      eventTypes: [eventType],
    };
    this.handlers.push(entry);

    return () => {
      const idx = this.handlers.indexOf(entry);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  async emit(event: DomainEvent): Promise<void> {
    const matching = this.handlers.filter((h) =>
      h.eventTypes.includes(event.type)
    );

    await Promise.allSettled(
      matching.map(async (entry) => {
        try {
          await entry.handler(event);
        } catch (error) {
          console.error(
            `[EventBus] Error in handler for '${event.type}':`,
            error
          );
        }
      })
    );
  }

  listenerCount(eventType: string): number {
    return this.handlers.filter((h) => h.eventTypes.includes(eventType))
      .length;
  }
}

export const eventBus = new EventBus();
