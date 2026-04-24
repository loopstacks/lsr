import { v4 as uuid } from "uuid";
import type {
  LoopDef,
  LoopResult,
  PromptSpec,
  CompositeSpec,
  ToolSpec,
  BackendRef,
  ModelBackend,
} from "./types.js";
import { LoopRegistry } from "./registry.js";
import { BackendRegistry } from "./backends/index.js";
import { SchemaValidator } from "./schema-validator.js";
import { Tracer } from "./tracer.js";

export interface ExecuteOptions {
  /** Optional parent call id — set when a composite step invokes a child. */
  parentCallId?: string;
  /** Optional parent tracer — child events are forwarded up to it. */
  parentTracer?: Tracer;
}

/**
 * LoopExecutor — takes a LoopDef + input, produces a LoopResult.
 *
 * Dispatches by loop kind:
 *   - "prompt":    renders the prompt template, calls the backend, parses JSON output
 *   - "composite": walks steps in order, invokes child loops, passes outputs forward
 *   - "tool":      invokes a registered tool handler
 *
 * Emits trace events at every lifecycle stage via the Tracer.
 */
export class LoopExecutor {
  private validator = new SchemaValidator();

  constructor(
    private readonly registry: LoopRegistry,
    private readonly backends: BackendRegistry,
  ) {}

  /**
   * Execute a loop by id.
   */
  async execute(
    loopId: string,
    input: Record<string, unknown>,
    opts: ExecuteOptions = {},
  ): Promise<LoopResult> {
    const def = this.registry.require(loopId);
    const callId = uuid();
    const tracer = new Tracer(callId);
    if (opts.parentTracer) opts.parentTracer.forward(tracer);

    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    tracer.emit("call.started", {
      loopId: def.id,
      loopVersion: def.version,
      parentCallId: opts.parentCallId,
    });

    // 1. Validate input
    const inputCheck = this.validator.validate(def.inputSchema, input);
    if (!inputCheck.valid) {
      return this.fail(def, callId, startedAt, t0, tracer, {
        code: "INPUT_VALIDATION_FAILED",
        message: "input failed schema validation",
        details: inputCheck.errors,
      });
    }
    tracer.emit("call.input.validated", { durationMs: Date.now() - t0 });

    // 2. Dispatch by kind
    let output: Record<string, unknown>;
    try {
      switch (def.kind) {
        case "prompt":
          output = await this.executePrompt(def, def.prompt!, input, tracer);
          break;
        case "composite":
          output = await this.executeComposite(def, def.composite!, input, callId, tracer);
          break;
        case "tool":
          output = await this.executeTool(def, def.tool!, input, tracer);
          break;
        default:
          throw new Error(`unknown loop kind: ${(def as LoopDef).kind}`);
      }
    } catch (err) {
      return this.fail(def, callId, startedAt, t0, tracer, {
        code: "EXECUTION_FAILED",
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // 3. Validate output
    const outputCheck = this.validator.validate(def.outputSchema, output);
    if (!outputCheck.valid) {
      return this.fail(def, callId, startedAt, t0, tracer, {
        code: "OUTPUT_VALIDATION_FAILED",
        message: "output failed schema validation",
        details: outputCheck.errors,
      });
    }
    tracer.emit("call.output.validated", { durationMs: Date.now() - t0 });

    // 4. Complete
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - t0;
    tracer.emit("call.completed", { totalDurationMs: durationMs });

    return {
      callId,
      loopId: def.id,
      loopVersion: def.version,
      status: "ok",
      output,
      startedAt,
      endedAt,
      durationMs,
      trace: tracer.events(),
    };
  }

  // --------------------------------------------------------------------------
  // Kind-specific execution
  // --------------------------------------------------------------------------

  private async executePrompt(
    def: LoopDef,
    spec: PromptSpec,
    input: Record<string, unknown>,
    tracer: Tracer,
  ): Promise<Record<string, unknown>> {
    const backendRef: BackendRef = def.backend ?? { id: "mock" };
    const backend: ModelBackend = this.backends.require(backendRef.id);

    const rendered = this.renderTemplate(spec.template, input, spec.variables);

    tracer.emit("call.backend.requested", {
      backendId: backend.id,
      model: backendRef.model,
      promptLength: rendered.length,
    });

    const t0 = Date.now();
    const response = await backend.invoke({
      model: backendRef.model,
      systemPrompt: spec.systemPrompt,
      prompt: rendered,
      maxTokens: spec.maxTokens,
      temperature: spec.temperature,
    });
    const durationMs = Date.now() - t0;

    tracer.emit("call.backend.responded", {
      durationMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    // Parse response as JSON if it looks like JSON; otherwise wrap in { text }
    const trimmed = response.text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return { text: response.text };
      }
    }
    return { text: response.text };
  }

  private async executeComposite(
    def: LoopDef,
    spec: CompositeSpec,
    input: Record<string, unknown>,
    parentCallId: string,
    tracer: Tracer,
  ): Promise<Record<string, unknown>> {
    // Build the context that inputMappings resolve against.
    // context.input = outer input
    // context.steps[i].output = step i's output (populated as we go)
    const context: {
      input: Record<string, unknown>;
      steps: Array<{ output: Record<string, unknown> }>;
    } = {
      input,
      steps: [],
    };

    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i];
      tracer.emit("child.started", { stepIndex: i, loopId: step.loopId });

      const childInput: Record<string, unknown> = {};
      for (const [key, path] of Object.entries(step.inputMapping)) {
        childInput[key] = this.resolvePath(path, context);
      }

      const childResult = await this.execute(step.loopId, childInput, {
        parentCallId,
        parentTracer: tracer,
      });

      if (childResult.status !== "ok" || !childResult.output) {
        tracer.emit("child.completed", {
          stepIndex: i,
          childCallId: childResult.callId,
          status: childResult.status,
        });
        throw new Error(
          `composite step ${i} (loop=${step.loopId}) failed: ${childResult.error?.message ?? "unknown"}`,
        );
      }

      context.steps.push({ output: childResult.output });
      tracer.emit("child.completed", {
        stepIndex: i,
        childCallId: childResult.callId,
        status: "ok",
      });
    }

    // Default: return the last step's output as this composite's output
    return context.steps[context.steps.length - 1].output;
  }

  private async executeTool(
    def: LoopDef,
    spec: ToolSpec,
    input: Record<string, unknown>,
    tracer: Tracer,
  ): Promise<Record<string, unknown>> {
    tracer.emit("call.tool.invoked", { implementation: spec.implementation });
    const t0 = Date.now();

    // v0.1 only ships one built-in tool: "builtin:echo"
    // Real tool plugins come in v0.2+
    let output: Record<string, unknown>;
    if (spec.implementation === "builtin:echo") {
      output = { ...input };
    } else {
      throw new Error(`unknown tool implementation: ${spec.implementation}`);
    }

    tracer.emit("call.tool.returned", { durationMs: Date.now() - t0 });
    return output;
  }

  // --------------------------------------------------------------------------
  // Template rendering and path resolution
  // --------------------------------------------------------------------------

  private renderTemplate(
    template: string,
    input: Record<string, unknown>,
    variables: string[],
  ): string {
    let rendered = template;
    for (const name of variables) {
      const value = input[name];
      const str = value === undefined || value === null ? "" : String(value);
      // Replace {{name}} with value (simple literal replacement, no regex special chars)
      rendered = rendered.split(`{{${name}}}`).join(str);
    }
    return rendered;
  }

  /**
   * Resolve a JSONPath-like reference against the composite context.
   * Supported forms (v0.1):
   *   "$.input.field"        → context.input.field
   *   "$.input.a.b"          → context.input.a.b
   *   "$.steps[0].output"    → context.steps[0].output
   *   "$.steps[1].output.x"  → context.steps[1].output.x
   *   "literal:foo"          → the literal string "foo" (no resolution)
   */
  private resolvePath(
    path: string,
    context: {
      input: Record<string, unknown>;
      steps: Array<{ output: Record<string, unknown> }>;
    },
  ): unknown {
    if (path.startsWith("literal:")) return path.slice("literal:".length);

    if (!path.startsWith("$.")) {
      throw new Error(`inputMapping path must start with $. or literal: — got: ${path}`);
    }

    const rest = path.slice(2); // drop "$."
    const tokens = this.tokenizePath(rest);

    let cursor: unknown = context;
    for (const tok of tokens) {
      if (cursor === null || cursor === undefined) {
        throw new Error(`path ${path} hit null/undefined at token ${tok}`);
      }
      if (typeof tok === "number") {
        if (!Array.isArray(cursor)) {
          throw new Error(`path ${path} expected array at token [${tok}]`);
        }
        cursor = cursor[tok];
      } else {
        cursor = (cursor as Record<string, unknown>)[tok];
      }
    }
    return cursor;
  }

  private tokenizePath(path: string): Array<string | number> {
    const tokens: Array<string | number> = [];
    const parts = path.split(".");
    for (const part of parts) {
      // Handle array index: "steps[0]" → "steps", 0
      const match = part.match(/^([^[]+)(\[(\d+)\])?$/);
      if (!match) throw new Error(`malformed path segment: ${part}`);
      tokens.push(match[1]);
      if (match[3] !== undefined) tokens.push(Number(match[3]));
    }
    return tokens;
  }

  // --------------------------------------------------------------------------
  // Error path
  // --------------------------------------------------------------------------

  private fail(
    def: LoopDef,
    callId: string,
    startedAt: string,
    t0: number,
    tracer: Tracer,
    error: { code: string; message: string; details?: unknown },
  ): LoopResult {
    tracer.emit("call.errored", error);
    const endedAt = new Date().toISOString();
    return {
      callId,
      loopId: def.id,
      loopVersion: def.version,
      status: "error",
      error,
      startedAt,
      endedAt,
      durationMs: Date.now() - t0,
      trace: tracer.events(),
    };
  }
}
