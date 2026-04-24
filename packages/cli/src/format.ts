import pc from "picocolors";
import type { LoopResult, TraceEvent } from "@loopstacks/core";

/**
 * Format a LoopResult as a pretty trace tree for terminal output.
 * This is the canonical LSR demo view: a tree of the loop call hierarchy
 * with timings, backend calls, and final output.
 */
export function formatTraceTree(result: LoopResult): string {
  const lines: string[] = [];
  const t0 = new Date(result.startedAt).getTime();

  const status = result.status === "ok" ? pc.green("✓") : pc.red("✗");
  const header = `${pc.cyan("▶")} ${pc.bold(result.loopId)} ${pc.dim(`(${shortId(result.callId)})`)}`;
  lines.push(header);

  // Walk events in chronological order and emit one line per significant event
  for (const event of result.trace) {
    const offset = new Date(event.ts).getTime() - t0;
    const line = formatEvent(event, offset);
    if (line) lines.push(line);
  }

  // Final summary
  const durationLabel = pc.dim(`${result.durationMs}ms`);
  if (result.status === "ok") {
    lines.push(`  └ ${status} ${pc.green("completed")} in ${durationLabel}`);
  } else {
    lines.push(`  └ ${status} ${pc.red("failed")} in ${durationLabel}`);
    if (result.error) {
      lines.push(pc.red(`     ${result.error.code}: ${result.error.message}`));
      if (result.error.details) {
        lines.push(pc.red(`     details: ${JSON.stringify(result.error.details)}`));
      }
    }
  }

  // Output
  if (result.status === "ok" && result.output) {
    lines.push("");
    lines.push(pc.dim("  output:"));
    const outputJson = JSON.stringify(result.output, null, 2)
      .split("\n")
      .map((l) => "  " + pc.white(l))
      .join("\n");
    lines.push(outputJson);
  }

  return lines.join("\n");
}

function formatEvent(event: TraceEvent, offsetMs: number): string | null {
  const offset = pc.dim(`+${offsetMs}ms`);
  const payload = event.payload as Record<string, unknown> | undefined;

  switch (event.type) {
    case "call.started":
      return null; // header already shown
    case "call.input.validated":
      return `  ├ ${pc.gray("input.validated")} ${offset}`;
    case "call.backend.requested": {
      const backend = payload?.backendId ?? "?";
      const model = payload?.model ? `/${payload.model}` : "";
      return `  ├ ${pc.blue("backend.requested")} ${pc.dim("→")} ${pc.cyan(String(backend) + String(model))} ${offset}`;
    }
    case "call.backend.responded": {
      const d = payload?.durationMs ?? "?";
      const inTok = payload?.inputTokens ?? "?";
      const outTok = payload?.outputTokens ?? "?";
      return `  ├ ${pc.blue("backend.responded")} ${pc.dim(`(${d}ms, ${inTok}→${outTok} tokens)`)} ${offset}`;
    }
    case "call.tool.invoked": {
      const impl = payload?.implementation ?? "?";
      return `  ├ ${pc.magenta("tool.invoked")} ${pc.dim("→")} ${pc.cyan(String(impl))} ${offset}`;
    }
    case "call.tool.returned": {
      const d = payload?.durationMs ?? "?";
      return `  ├ ${pc.magenta("tool.returned")} ${pc.dim(`(${d}ms)`)} ${offset}`;
    }
    case "call.output.validated":
      return `  ├ ${pc.gray("output.validated")} ${offset}`;
    case "child.started": {
      const loopId = payload?.loopId ?? "?";
      const idx = payload?.stepIndex;
      return `  ├ ${pc.yellow("child.started")} ${pc.dim("→")} ${pc.cyan(String(loopId))} ${pc.dim(`[step ${idx}]`)} ${offset}`;
    }
    case "child.completed": {
      const status = payload?.status === "ok" ? pc.green("ok") : pc.red(String(payload?.status));
      const idx = payload?.stepIndex;
      return `  ├ ${pc.yellow("child.completed")} ${pc.dim(`[step ${idx}]`)} (${status}) ${offset}`;
    }
    case "call.completed":
      return null; // captured in the summary line
    case "call.errored":
      return null; // captured in the summary line
    case "log": {
      const msg = payload ? JSON.stringify(payload) : "";
      return `  ├ ${pc.dim("log")} ${msg} ${offset}`;
    }
    default:
      return `  ├ ${pc.dim(String(event.type))} ${offset}`;
  }
}

function shortId(id: string): string {
  return id.split("-")[0];
}
