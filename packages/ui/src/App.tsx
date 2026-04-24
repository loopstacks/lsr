import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { useTraceStream } from "./lib/use-trace-stream";
import type { LoopDef, TraceEvent } from "./lib/types";
import { LoopList } from "./components/LoopList";
import { Runner } from "./components/Runner";
import { TraceViewer } from "./components/TraceViewer";

export function App(): React.ReactElement {
  const [loops, setLoops] = useState<LoopDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [backends, setBackends] = useState<string[]>([]);

  const { events, result, connected, clear } = useTraceStream();

  // Filter events to just the current run (started from this tab).
  const [activeCallIds, setActiveCallIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      try {
        const [loopsRes, backendsRes] = await Promise.all([
          api.listLoops(),
          api.listBackends(),
        ]);
        setLoops(loopsRes.loops);
        setBackends(backendsRes.backends);
        if (!selectedId && loopsRes.loops.length > 0) {
          setSelectedId(loopsRes.loops[0].id);
        }
      } catch (err) {
        console.error("failed to load:", err);
      }
    })();
  }, []);

  const selected = loops.find((l) => l.id === selectedId);

  // Group events by root call (events with parentCallId get grouped under root)
  // For v0.1 UI simplicity, show all events since the last "clear".
  const visibleEvents: TraceEvent[] = events;

  const handleRunStart = (_loopId: string): void => {
    clear();
  };

  const handleRunDone = (): void => {
    // no-op — result arrives via WebSocket
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-slate-100">LSR</span>
          <span className="text-xs text-slate-500 font-mono">
            Loop Stack Runtime · v0.1
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? "bg-emerald-500" : "bg-slate-600"
              }`}
            />
            <span className="text-slate-500">
              {connected ? "trace stream" : "disconnected"}
            </span>
          </div>
          <div className="text-slate-500">
            backends:{" "}
            <span className="text-slate-300">
              {backends.length > 0 ? backends.join(", ") : "—"}
            </span>
          </div>
        </div>
      </header>

      {/* Main layout: sidebar | runner | trace */}
      <div className="flex-1 grid grid-cols-[280px_420px_1fr] overflow-hidden">
        {/* Sidebar */}
        <div className="border-r border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="text-xs uppercase tracking-wide text-slate-500">loops</div>
            <div className="text-xs text-slate-600 mt-0.5">{loops.length} registered</div>
          </div>
          <LoopList
            loops={loops}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              clear();
            }}
          />
        </div>

        {/* Runner */}
        <div className="border-r border-slate-800 overflow-hidden">
          {selected ? (
            <Runner loop={selected} onRun={handleRunStart} onDone={handleRunDone} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              select a loop to run
            </div>
          )}
        </div>

        {/* Trace viewer */}
        <div className="overflow-hidden bg-slate-950">
          <TraceViewer
            events={visibleEvents}
            result={result}
            title={selected ? selected.id : undefined}
          />
        </div>
      </div>
    </div>
  );
}
