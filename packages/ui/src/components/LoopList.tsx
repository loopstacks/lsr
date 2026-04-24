import type { LoopDef } from "../lib/types";

function kindBadge(kind: string): React.ReactElement {
  const colors: Record<string, string> = {
    prompt: "bg-blue-900/40 text-blue-300 border-blue-800/60",
    composite: "bg-amber-900/40 text-amber-300 border-amber-800/60",
    tool: "bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800/60",
  };
  const cls = colors[kind] ?? "bg-slate-800 text-slate-300 border-slate-700";
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>
      {kind}
    </span>
  );
}

export interface LoopListProps {
  loops: LoopDef[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function LoopList(props: LoopListProps): React.ReactElement {
  const { loops, selectedId, onSelect } = props;

  if (loops.length === 0) {
    return (
      <div className="p-4 text-slate-500 text-sm">
        no loops loaded. place loop definitions in the bundle directory or POST /api/loops.
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      {loops.map((loop) => {
        const selected = loop.id === selectedId;
        return (
          <button
            key={loop.id}
            onClick={() => onSelect(loop.id)}
            className={`w-full text-left px-4 py-3 border-b border-slate-800 transition-colors ${
              selected ? "bg-slate-800/80" : "hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-2">
              {kindBadge(loop.kind)}
              <span className="font-mono text-sm text-slate-100">{loop.id}</span>
              <span className="text-xs text-slate-500 ml-auto">v{loop.version}</span>
            </div>
            {loop.description && (
              <div className="text-xs text-slate-400 mt-1 line-clamp-2">{loop.description}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
