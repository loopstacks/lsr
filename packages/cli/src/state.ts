import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  LoopRegistry,
  LoopExecutor,
  BackendRegistry,
  type LoopDef,
} from "@loopstacks/core";

/**
 * CLIState — holds a registry, backends, and executor for the CLI session.
 *
 * For v0.1 CLI commands are stateless-per-invocation: `lsr run` freshly
 * creates these, loads the bundles dir, and executes. This mirrors how
 * most dev-tool CLIs work (kubectl, terraform, etc.).
 *
 * Bundles are loaded from the directory specified by $LSR_BUNDLE_DIR or
 * ./examples relative to cwd. Each .json file is parsed as a LoopDef.
 */
export class CLIState {
  readonly registry = new LoopRegistry();
  readonly backends = new BackendRegistry();
  readonly executor: LoopExecutor;

  constructor() {
    this.executor = new LoopExecutor(this.registry, this.backends);
  }

  /**
   * Load loops from a directory of .json files. Ignores files that don't
   * parse as valid LoopDef (logs a warning).
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

  /**
   * Load a single loop def from a .json file.
   */
  loadFile(path: string): LoopDef {
    const raw = readFileSync(path, "utf8");
    const def = JSON.parse(raw) as LoopDef;
    this.registry.register(def);
    return def;
  }
}
