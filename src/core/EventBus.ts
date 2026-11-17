type Listener<T> = (payload: T) => void;

/**
 * Minimal typed pub/sub. Engines push discrete changes (phase, completion,
 * announcements) up to React through it, so React never reaches into engine
 * internals and never re-renders per animation frame.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(listener);
    return () => this.listeners[event]?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners[event]?.forEach((l) => l(payload));
  }
}
