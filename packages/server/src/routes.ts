import type { FastifyInstance } from "fastify";
import type { LoopDef } from "@loopstacks/core";
import type { ServerRuntime } from "./runtime.js";

export function registerRoutes(fastify: FastifyInstance, runtime: ServerRuntime): void {
  // ---------- Health ----------
  fastify.get("/api/health", async () => ({
    status: "ok",
    version: "0.1.0",
    backends: runtime.backends.list(),
    loops: runtime.registry.size(),
  }));

  fastify.get("/api/version", async () => ({
    name: "LSR",
    version: "0.1.0",
    spec: "LSEM v0.1",
  }));

  // ---------- Loops CRUD ----------
  fastify.get("/api/loops", async () => {
    return { loops: runtime.registry.list() };
  });

  fastify.get<{ Params: { id: string } }>("/api/loops/:id", async (req, reply) => {
    const def = runtime.registry.get(req.params.id);
    if (!def) {
      reply.code(404);
      return { error: "not found", id: req.params.id };
    }
    return def;
  });

  fastify.post<{ Body: LoopDef }>("/api/loops", async (req, reply) => {
    try {
      runtime.registry.register(req.body);
      return { ok: true, id: req.body.id };
    } catch (err) {
      reply.code(400);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  fastify.put<{ Params: { id: string }; Body: LoopDef }>(
    "/api/loops/:id",
    async (req, reply) => {
      if (req.body.id !== req.params.id) {
        reply.code(400);
        return { error: "id mismatch between path and body" };
      }
      try {
        runtime.registry.register(req.body);
        return { ok: true, id: req.body.id };
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>("/api/loops/:id", async (req, reply) => {
    const removed = runtime.registry.remove(req.params.id);
    if (!removed) {
      reply.code(404);
      return { error: "not found" };
    }
    return { ok: true };
  });

  // ---------- Runs (execution) ----------
  fastify.post<{
    Body: { loopId: string; input: Record<string, unknown> };
  }>("/api/runs", async (req, reply) => {
    const { loopId, input } = req.body;
    if (!loopId) {
      reply.code(400);
      return { error: "loopId is required" };
    }
    if (!runtime.registry.get(loopId)) {
      reply.code(404);
      return { error: `loop not found: ${loopId}` };
    }
    const result = await runtime.execute(loopId, input ?? {});
    return result;
  });

  fastify.get<{ Params: { callId: string } }>("/api/runs/:callId", async (req, reply) => {
    const result = runtime.getRun(req.params.callId);
    if (!result) {
      reply.code(404);
      return { error: "not found" };
    }
    return result;
  });

  fastify.get("/api/runs", async () => {
    return { runs: runtime.listRuns() };
  });

  // ---------- Backends ----------
  fastify.get("/api/backends", async () => {
    return { backends: runtime.backends.list() };
  });
}
