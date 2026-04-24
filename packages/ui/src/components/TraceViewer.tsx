import type { TraceEvent, LoopResult } from "../lib/types";

function relativeOffset(tsISO: string, baseMs: number): string {
  const offset = new Date(tsISO).getTime() - baseMs;
  return `+${offset}ms`;
}

function eventColor(type: string): string {
  if (type.startsWith("call.backend")) return "text-blue-400";
  if (type.startsWith("call.tool")) return "text-fuchsia-400";
  if (type.startsWith("child.")) return "text-amber-400";
  if (type === "call.errored") return "text-red-400";
  if (type === "call.completed") return "text-emerald-400";
  return "text-slate-400";
}

function eventLine(event: TraceEvent, baseMs: number): React.ReactNode {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const offset = relativeOffset(event.ts, baseMs);

  let detail: React.ReactNode = null;
  switch (event.type) {
    case "call.started": {
      const loopId = payload.loopId as string | undefined;
      detail = (
        <>
          <span className="text-slate-500">loop</span>{" "}
          <span className="text-cyan-300">{loopId}</span>
        </>
      );
      break;
    }
    case "call.backend.requested": {
      const backend = payload.backendId as string | undefined;
      const model = payload.model as string | undefined;
      detail = (
        <>
          <span className="text-slate-500">→</span>{" "}
          <span className="text-cyan-300">
            {backend}
            {model ? `/${model}` : ""}
          </span>
        </>
      );
      break;
    }
    case "call.backend.responded": {
      const d = payload.durationMs as number | undefined;
      const ti = payload.inputTokens as number | undefined;
      const to = payload.outputTokens as number | undefined;
      detail = (
        <span className="text-slate-500">
          ({d}ms, {ti}→{to} tokens)
        </span>
      );
      break;
    }
    case "call.tool.invoked": {
      const impl = payload.implementation as string | undefined;
      detail = (
        <>
          <span className="text-slate-500">→</span>{" "}
          <span className="text-cyan-300">{impl}</span>
        </>
      );
      break;
    }
    case "child.started":
    case "child.completed": {
      const idx = payload.stepIndex;
      const loopId = payload.loopId as string | undefined;
      const status = payload.status as string | undefined;
      detail = (
        <>
          {loopId && (
            <>
              <span className="text-slate-500">→</span>{" "}
              <span className="text-cyan-300">{loopId}</span>{" "}
            </>
          )}
          <span className="text-slate-500">[step {String(idx)}]</span>
          {status && (
            <>
              {" "}
              <span className={status === "ok" ? "text-emerald-400" : "text-red-400"}>
                ({status})
              </span>
            </>
          )}
        </>
      );
      break;
    }
    case "call.errored": {
      const code = payload.code as string | undefined;
      const msg = payload.message as string | undefined;
      detail = (
        <span className="text-red-400">
          {code}: {msg}
        </span>
      );
      break;
    }
  }

  return (
    <div className="flex items-baseline gap-2 py-0.5 font-mono text-sm">
      <span className="text-slate-600">├</span>
      <span className={eventColor(event.type)}>{event.type}</span>
      {detail}
      <span className="ml-auto text-slate-600 text-xs">{offset}</span>
    </div>
  );
}

export interface TraceViewerProps {
  events: TraceEvent[];
  result: LoopResult | null;
  title?: string;
}

export function TraceViewer(props: TraceViewerProps): React.ReactElement {
  const { events, result, title } = props;

  const firstEvent = events[0] ?? (result?.trace[0] as TraceEvent | undefined);
  const baseMs = firstEvent
    ? new Date(firstEvent.ts).getTime()
    : Date.now();

  const displayEvents: TraceEvent[] = events.length > 0 ? events : (result?.trace ?? []);

  if (displayEvents.length === 0 && !result) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="font-mono text-sm mb-2">no trace events yet</div>
          <div className="text-xs">run a loop to see events stream in</div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-mono text-sm p-4 overflow-auto h-full">
      {title && (
        <div className="pb-2 mb-2 border-b border-slate-800 flex items-baseline gap-2">
          <span className="text-cyan-400">▶</span>
          <span className="text-slate-100 font-semibold">{title}</span>
          {result && (
            <span className="ml-auto text-xs text-slate-500">
              {result.callId.split("-")[0]}
            </span>
          )}
        </div>
      )}
      <div>
        {displayEvents.map((e, i) => (
          <div key={`${e.callId}-${e.ts}-${i}`}>{eventLine(e, baseMs)}</div>
        ))}
      </div>
      {result && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          {result.status === "ok" ? (
            <div className="text-emerald-400">
              ✓ completed in {result.durationMs}ms
            </div>
          ) : (
            <div className="text-red-400">
              ✗ failed in {result.durationMs}ms —{" "}
              {result.error?.code}: {result.error?.message}
            </div>
          )}
          {result.output && (
            <div className="mt-3">
              <div className="text-slate-500 text-xs mb-1">output</div>
              <pre className="text-slate-200 text-xs bg-slate-900 rounded p-3 overflow-auto">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
