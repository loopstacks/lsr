import { useEffect, useRef, useState } from "react";
import type { TraceEvent, LoopResult } from "./types";

export interface TraceStreamMessage {
  type: "trace" | "result";
  event?: TraceEvent;
  result?: LoopResult;
}

/**
 * Hook that maintains a live WebSocket to /ws/traces and collects
 * trace events + results. Returns the currently-accumulated events and
 * the latest result (if any).
 */
export function useTraceStream(): {
  events: TraceEvent[];
  result: LoopResult | null;
  connected: boolean;
  clear: () => void;
} {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [result, setResult] = useState<LoopResult | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/traces`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as TraceStreamMessage;
        if (msg.type === "trace" && msg.event) {
          setEvents((prev) => [...prev, msg.event!]);
        } else if (msg.type === "result" && msg.result) {
          setResult(msg.result);
        }
      } catch {
        /* ignore malformed */
      }
    };

    return () => ws.close();
  }, []);

  const clear = (): void => {
    setEvents([]);
    setResult(null);
  };

  return { events, result, connected, clear };
}
