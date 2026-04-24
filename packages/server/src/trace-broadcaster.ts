import type { TraceEvent, LoopResult } from "@loopstacks/core";

/**
 * TraceBroadcaster — publishes trace events and completed results to
 * in-process subscribers (WebSocket connections).
 *
 * Kept deliberately simple for v0.1: in-process pub/sub with callId-based
 * filtering. v0.2 will move to a real message bus (NATS or Redis Streams).
 */
export interface TraceStreamMessage {
  type: "trace" | "result";
  event?: TraceEvent;
  result?: LoopResult;
}

export type TraceSubscriber = (msg: TraceStreamMessage) => void;

export class TraceBroadcaster {
  private subs = new Set<{ callId?: string; fn: TraceSubscriber }>();

  subscribe(fn: TraceSubscriber, callId?: string): () => void {
    const entry = { callId, fn };
    this.subs.add(entry);
    return () => this.subs.delete(entry);
  }

  emitEvent(event: TraceEvent): void {
    for (const sub of this.subs) {
      if (sub.callId && sub.callId !== event.callId) continue;
      try {
        sub.fn({ type: "trace", event });
      } catch {
        /* ignore */
      }
    }
  }

  emitResult(result: LoopResult): void {
    for (const sub of this.subs) {
      if (sub.callId && sub.callId !== result.callId) continue;
      try {
        sub.fn({ type: "result", result });
      } catch {
        /* ignore */
      }
    }
  }
}
