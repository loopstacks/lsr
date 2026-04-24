/**
 * LSEM — Loop Stack Execution Model
 * Core type definitions for v0.1
 *
 * These types are the load-bearing primitives. Everything in the runtime
 * serializes to and from these. Keep them stable.
 */

// ============================================================================
// JSON Schema (we use a loose type here; validation is via ajv)
// ============================================================================

export type JSONSchema = Record<string, unknown>;

// ============================================================================
// Loop Definition — the static description of a loop
// ============================================================================

export type LoopKind = "prompt" | "composite" | "tool";

export interface LoopDef {
  /** Unique within a registry. e.g. "summarize-v1" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Semver version string */
  version: string;

  /** Input schema (JSON Schema) */
  inputSchema: JSONSchema;
  /** Output schema (JSON Schema) */
  outputSchema: JSONSchema;

  /** Loop kind — determines execution semantics */
  kind: LoopKind;

  /** REQUIRED if kind === "prompt" */
  prompt?: PromptSpec;
  /** REQUIRED if kind === "composite" */
  composite?: CompositeSpec;
  /** REQUIRED if kind === "tool" */
  tool?: ToolSpec;

  /** Default backend for prompt loops */
  backend?: BackendRef;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface PromptSpec {
  /** Template with {{var}} placeholders */
  template: string;
  /** Optional system prompt */
  systemPrompt?: string;
  /** Variable names used in template */
  variables: string[];
  /** Max tokens for the backend */
  maxTokens?: number;
  /** Temperature for the backend */
  temperature?: number;
}

export interface CompositeSpec {
  steps: CompositeStep[];
}

export interface CompositeStep {
  /** Which loop to invoke */
  loopId: string;
  /** Optional version pin */
  loopVersion?: string;
  /**
   * How to construct the child's input.
   * Keys are child's input field names.
   * Values are JSONPath-like references: "$.input.field" or "$.steps[n].output.field"
   */
  inputMapping: Record<string, string>;
  /** Optional name to bind this step's output for later steps */
  outputBinding?: string;
}

export interface ToolSpec {
  /** Opaque implementation reference (e.g. "builtin:echo") */
  implementation: string;
  /** Tool-specific config */
  config?: Record<string, unknown>;
}

export interface BackendRef {
  /** Backend id, e.g. "openai", "anthropic", "mock" */
  id: string;
  /** Model name, e.g. "gpt-4o-mini", "claude-sonnet-4-5" */
  model?: string;
}

// ============================================================================
// Loop Call and Result
// ============================================================================

export type LoopCallStatus = "running" | "ok" | "error";

export interface LoopCall {
  callId: string;
  loopId: string;
  loopVersion: string;
  input: Record<string, unknown>;
  parentCallId?: string;
  startedAt: string;
}

export interface LoopResult {
  callId: string;
  loopId: string;
  loopVersion: string;
  status: "ok" | "error";
  output?: Record<string, unknown>;
  error?: LoopException;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  trace: TraceEvent[];
}

export interface LoopException {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// Trace Events — the observability surface
// ============================================================================

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

// ============================================================================
// Backend interface — pluggable model providers
// ============================================================================

export interface BackendRequest {
  model?: string;
  systemPrompt?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface BackendResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  rawProviderResponse?: unknown;
}

export interface ModelBackend {
  id: string;
  invoke(req: BackendRequest): Promise<BackendResponse>;
}

// ============================================================================
// Tool interface — pluggable tool implementations
// ============================================================================

export interface ToolInvocation {
  input: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface ToolHandler {
  implementation: string;
  invoke(inv: ToolInvocation): Promise<Record<string, unknown>>;
}
