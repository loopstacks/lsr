import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  LoopRegistry,
  LoopExecutor,
  BackendRegistry,
  Tracer,
  type LoopDef,
  type LoopResult,
} from "@loopstacks/core";
import { TraceBroadcaster } from "./trace-broadcaster.js";

/**
 * ServerRuntime — the long-lived in-process runtime state.
 *
 * Holds the registry, backends, and the trace broadcaster.
 * Wraps the executor so every execution auto-publishes trace events to
 * the broadcaster.
 */
export class ServerRuntime {
  readonly registry = new LoopRegistry();
  readonly backends: BackendRegistry;
  readonly broadcaster = new TraceBroadcaster();
  private readonly rawExecutor: LoopExecutor;
  // Track in-flight runs so GET /api/runs can list them.
  private runs = new Map<string, LoopResult>();

  constructor() {
    this.backends = new BackendRegistry({ autoRegisterFromEnv: true });
    this.rawExecutor = new LoopExecutor(this.registry, this.backends);
  }

  /**
   * Execute a loop, auto-forwarding trace events to the broadcaster
   * and storing the final result for later retrieval.
   */
  async execute(
    loopId: string,
    input: Record<string, unknown>,
  ): Promise<LoopResult> {
    // Attach a bridge tracer that forwards into the broadcaster.
    const bridgeTracer = new Tracer("bridge");
    const unsub = bridgeTracer.subscribe((event) => {
      this.broadcaster.emitEvent(event);
    });

    try {
      const result = await this.rawExecutor.execute(loopId, input, {
        parentTracer: bridgeTracer,
      });
      this.runs.set(result.callId, result);
      this.broadcaster.emitResult(result);
      return result;
    } finally {
      unsub();
    }
  }

  getRun(callId: string): LoopResult | undefined {
    return this.runs.get(callId);
  }

  listRuns(limit = 50): LoopResult[] {
    return Array.from(this.runs.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  /**
   * Load loop definitions from a directory of .json files.
   */
  loadDirectory(dir: string): { loaded: string[]; errors: Array<{ file: string; error: string }> } {
    const resolved = resolve(dir);
    if (!existsSync(resolved)) {
      return { loaded: [], errors: [{ file: resolved, error: "directory does not exist" }] };
    }
    const loaded: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const entry of readdirSync(resolved)) {
      if (!entry.endsWith(".json")) continue;
      const path = join(resolved, entry);
      try {
        const def = this.loadFile(path);
        loaded.push(def.id);
      } catch (err) {
        errors.push({
          file: path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { loaded, errors };
  }

  loadFile(path: string): LoopDef {
    const raw = readFileSync(path, "utf8");
    const def = JSON.parse(raw) as LoopDef;
    this.registry.register(def);
    return def;
  }
}
