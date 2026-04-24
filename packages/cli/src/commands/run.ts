import { readFileSync } from "node:fs";
import pc from "picocolors";
import { CLIState } from "../state.js";
import { formatTraceTree } from "../format.js";

export interface RunOpts {
  input?: string;
  inputFile?: string;
  dir: string;
  watch?: boolean;
}

export async function cmdRun(loopId: string, opts: RunOpts): Promise<void> {
  const state = new CLIState();
  const loadResult = state.loadDirectory(opts.dir);

  // Surface load errors that happen to be for other files, but don't block the run
  for (const err of loadResult.errors) {
    if (!err.error.includes("does not exist")) {
      console.error(pc.yellow("!"), `${err.file}: ${err.error}`);
    }
  }

  const def = state.registry.get(loopId);
  if (!def) {
    console.error(pc.red("✗"), `loop not found: ${loopId}`);
    console.error(pc.dim(`   searched in ${opts.dir}, loaded: ${loadResult.loaded.join(", ") || "none"}`));
    process.exitCode = 1;
    return;
  }

  let input: Record<string, unknown>;
  try {
    input = parseInput(opts);
  } catch (err) {
    console.error(pc.red("✗"), "failed to parse input:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  // --watch: stream trace events as they happen.
  // v0.1 implementation renders the full tree at completion — the executor
  // emits events synchronously during await, so the "stream" is effectively
  // the rendered tree once execute() returns. v0.2 with the server will do
  // actual WebSocket streaming.
  const result = await state.executor.execute(loopId, input);

  if (opts.watch) {
    console.log(formatTraceTree(result));
  } else {
    // Non-watch: just show status + output
    if (result.status === "ok") {
      console.log(pc.green("✓"), `${loopId} completed in ${result.durationMs}ms`);
      if (result.output) {
        console.log(JSON.stringify(result.output, null, 2));
      }
    } else {
      console.log(pc.red("✗"), `${loopId} failed: ${result.error?.message ?? "unknown"}`);
      process.exitCode = 1;
    }
  }
}

function parseInput(opts: RunOpts): Record<string, unknown> {
  if (opts.inputFile) {
    const raw = readFileSync(opts.inputFile, "utf8");
    return JSON.parse(raw);
  }
  if (opts.input) {
    return JSON.parse(opts.input);
  }
  return {};
}
