import { useState, useEffect } from "react";
import type { LoopDef } from "../lib/types";
import { api } from "../lib/api";

export interface RunnerProps {
  loop: LoopDef;
  onRun: (loopId: string) => void;
  onDone: () => void;
}

function defaultInputFor(loop: LoopDef): string {
  const schema = loop.inputSchema as { properties?: Record<string, { type?: string }> };
  const props = schema?.properties ?? {};
  const obj: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(props)) {
    const t = def?.type;
    if (t === "string") obj[key] = "";
    else if (t === "number" || t === "integer") obj[key] = 0;
    else if (t === "boolean") obj[key] = false;
    else if (t === "array") obj[key] = [];
    else if (t === "object") obj[key] = {};
    else obj[key] = null;
  }
  return JSON.stringify(obj, null, 2);
}

export function Runner(props: RunnerProps): React.ReactElement {
  const { loop, onRun, onDone } = props;
  const [input, setInput] = useState<string>(defaultInputFor(loop));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInput(defaultInputFor(loop));
    setError(null);
  }, [loop.id]);

  const handleRun = async (): Promise<void> => {
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      setError("input is not valid JSON");
      return;
    }
    setRunning(true);
    onRun(loop.id);
    try {
      await api.run(loop.id, parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      onDone();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-800 flex items-baseline gap-3">
        <span className="font-mono text-cyan-400">{loop.id}</span>
        <span className="text-xs text-slate-500">v{loop.version}</span>
        <span className="text-xs text-slate-500 ml-auto">{loop.name}</span>
      </div>

      <div className="p-4 flex flex-col gap-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-wide text-slate-500">input</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInput(defaultInputFor(loop))}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
              type="button"
            >
              reset
            </button>
            <button
              onClick={handleRun}
              disabled={running}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                running
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
              type="button"
            >
              {running ? "running…" : "▶ run"}
            </button>
          </div>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="font-mono text-sm bg-slate-900 text-slate-100 p-3 rounded border border-slate-800 focus:border-blue-600 focus:outline-none resize-none"
          rows={6}
        />
        {error && (
          <div className="text-sm text-red-400 font-mono">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
