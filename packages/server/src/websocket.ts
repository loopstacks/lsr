import type { FastifyInstance } from "fastify";
import type { ServerRuntime } from "./runtime.js";

export function registerWebSocket(fastify: FastifyInstance, runtime: ServerRuntime): void {
  fastify.get("/ws/traces", { websocket: true }, (connection) => {
    const socket = connection as unknown as {
      send: (data: string) => void;
      on: (event: string, cb: (data: Buffer | string) => void) => void;
    };

    let filterCallId: string | undefined;

    const unsub = runtime.broadcaster.subscribe((msg) => {
      try {
        socket.send(JSON.stringify(msg));
      } catch {
        /* socket closed */
      }
    }, filterCallId);

    // Allow clients to send { type: "subscribe", callId: "..." } to filter.
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; callId?: string };
        if (msg.type === "subscribe" && msg.callId) {
          filterCallId = msg.callId;
          // (For v0.1, filter applies to new events. Simpler than re-subscribing.)
        }
      } catch {
        /* ignore malformed */
      }
    });

    socket.on("close", () => unsub());
  });
}
