import type { TraceEvent, TraceEventType } from "./types.js";

export type TraceListener = (event: TraceEvent) => void;

/**
 * Tracer — emits TraceEvents into a per-call buffer and to any registered
 * live listeners.
 *
 * Each loop call gets its own Tracer scoped to that call, created via
 * Tracer.forCall(callId). Child calls also get their own Tracers; the
 * executor is responsible for bubbling child events up to parent tracers
 * where appropriate.
 */
export class Tracer {
  private buffer: TraceEvent[] = [];
  private listeners = new Set<TraceListener>();

  constructor(private readonly callId: string) {}

  /**
   * Emit a trace event. Adds to buffer, notifies listeners.
   * ts is auto-set to ISO 8601 now() if not supplied.
   */
  emit(type: TraceEventType, payload?: unknown): TraceEvent {
    const event: TraceEvent = {
      callId: this.callId,
      ts: new Date().toISOString(),
      type,
      payload,
    };
    this.buffer.push(event);
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // listener errors must not break execution
      }
    }
    return event;
  }

  /** Register a live listener. Returns an unsubscribe fn. */
  subscribe(listener: TraceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Get the full trace buffer (copy). */
  events(): TraceEvent[] {
    return [...this.buffer];
  }

  /** Forward events from another tracer into this one. */
  forward(child: Tracer): void {
    child.subscribe((event) => {
      this.buffer.push(event);
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch {
          /* ignore */
        }
      }
    });
  }
}
