#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { ServerRuntime } from "./runtime.js";
import { registerRoutes } from "./routes.js";
import { registerWebSocket } from "./websocket.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const BUNDLE_DIR = process.env.LSR_BUNDLE_DIR ?? "./examples";
const STATIC_DIR = process.env.LSR_STATIC_DIR; // set by Dockerfile to UI dist

async function main(): Promise<void> {
  const runtime = new ServerRuntime();

  // Load any bundles present on disk
  const loadResult = runtime.loadDirectory(BUNDLE_DIR);
  if (loadResult.loaded.length > 0) {
    console.log(`[lsr] loaded ${loadResult.loaded.length} loops from ${BUNDLE_DIR}:`);
    for (const id of loadResult.loaded) console.log(`      - ${id}`);
  }
  if (loadResult.errors.length > 0) {
    for (const err of loadResult.errors) {
      if (!err.error.includes("does not exist")) {
        console.warn(`[lsr] warn: ${err.file}: ${err.error}`);
      }
    }
  }

  const fastify = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  await fastify.register(fastifyWebsocket);

  registerRoutes(fastify, runtime);
  registerWebSocket(fastify, runtime);

  // Serve the UI if a static directory is configured and exists.
  const resolvedStatic = STATIC_DIR ? resolve(STATIC_DIR) : resolveDefaultStatic();
  if (resolvedStatic && existsSync(resolvedStatic)) {
    console.log(`[lsr] serving UI from ${resolvedStatic}`);
    await fastify.register(fastifyStatic, {
      root: resolvedStatic,
      prefix: "/",
      wildcard: false,
    });
    // SPA fallback: any unmatched non-/api request returns index.html
    fastify.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws")) {
        reply.code(404).send({ error: "not found" });
        return;
      }
      reply.sendFile("index.html");
    });
  } else {
    fastify.get("/", async () => ({
      name: "LSR",
      version: "0.1.0",
      message: "UI not bundled. Use the REST API directly or mount a UI dist directory at LSR_STATIC_DIR.",
      endpoints: {
        health: "GET /api/health",
        loops: "GET /api/loops",
        runs: "POST /api/runs",
        traces: "WS /ws/traces",
      },
    }));
  }

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`[lsr] listening on http://${HOST}:${PORT}`);
    console.log(`[lsr] backends: ${runtime.backends.list().join(", ")}`);
  } catch (err) {
    console.error("[lsr] failed to start:", err);
    process.exit(1);
  }
}

/**
 * When running the dev build, look for the UI next to the server dist.
 * Path: packages/server/dist/index.js → ../../../packages/ui/dist
 */
function resolveDefaultStatic(): string | undefined {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidate = join(here, "..", "..", "ui", "dist");
    return candidate;
  } catch {
    return undefined;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
