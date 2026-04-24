// Local copy of the LSEM types the UI consumes. Keeping them inline rather
// than importing @loopstacks/core avoids workspace coupling in the UI build
// and keeps the API surface explicit.

export type LoopKind = "prompt" | "composite" | "tool";

export interface LoopDef {
  id: string;
  name: string;
  description?: string;
  version: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  kind: LoopKind;
  prompt?: {
    template: string;
    systemPrompt?: string;
    variables: string[];
    maxTokens?: number;
    temperature?: number;
  };
  composite?: {
    steps: Array<{
      loopId: string;
      loopVersion?: string;
      inputMapping: Record<string, string>;
      outputBinding?: string;
    }>;
  };
  tool?: {
    implementation: string;
    config?: Record<string, unknown>;
  };
  backend?: { id: string; model?: string };
  metadata?: Record<string, unknown>;
}

export type TraceEventType =
  | "call.started"
  | "call.input.validated"
  | "call.backend.requested"
  | "call.backend.responded"
  | "call.tool.invoked"
  | "call.tool.returned"
  | "call.output.validated"
  | "call.completed"
  | "call.errored"
  | "child.started"
  | "child.completed"
  | "log";

export interface TraceEvent {
  callId: string;
  ts: string;
  type: TraceEventType;
  payload?: unknown;
}

export interface LoopResult {
  callId: string;
  loopId: string;
  loopVersion: string;
  status: "ok" | "error";
  output?: Record<string, unknown>;
  error?: { code: string; message: string; details?: unknown };
  startedAt: string;
  endedAt: string;
  durationMs: number;
  trace: TraceEvent[];
}
