import { describe, it, expect, beforeEach } from "vitest";
import {
  LoopRegistry,
  LoopExecutor,
  BackendRegistry,
  type LoopDef,
} from "../src/index.js";

const helloLoop: LoopDef = {
  id: "hello",
  name: "Hello Loop",
  version: "1.0.0",
  kind: "prompt",
  inputSchema: {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  },
  outputSchema: {
    type: "object",
    properties: { greeting: { type: "string" } },
    required: ["greeting"],
  },
  prompt: {
    template: "Greet someone named {{name}} in one sentence.",
    variables: ["name"],
  },
  backend: { id: "mock" },
};

describe("LoopExecutor — prompt loops", () => {
  let registry: LoopRegistry;
  let backends: BackendRegistry;
  let executor: LoopExecutor;

  beforeEach(() => {
    registry = new LoopRegistry();
    backends = new BackendRegistry();
    executor = new LoopExecutor(registry, backends);
    registry.register(helloLoop);
  });

  it("executes a simple prompt loop end-to-end", async () => {
    const result = await executor.execute("hello", { name: "world" });

    expect(result.status).toBe("ok");
    expect(result.output).toBeDefined();
    expect(result.output!.greeting).toContain("world");
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it("emits the expected lifecycle trace events", async () => {
    const result = await executor.execute("hello", { name: "Alice" });

    const types = result.trace.map((e) => e.type);
    expect(types).toContain("call.started");
    expect(types).toContain("call.input.validated");
    expect(types).toContain("call.backend.requested");
    expect(types).toContain("call.backend.responded");
    expect(types).toContain("call.output.validated");
    expect(types).toContain("call.completed");
  });

  it("fails on input that doesn't match inputSchema", async () => {
    // name is required but missing
    const result = await executor.execute("hello", {} as Record<string, unknown>);

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("INPUT_VALIDATION_FAILED");
    const types = result.trace.map((e) => e.type);
    expect(types).toContain("call.errored");
  });

  it("carries a non-zero duration and call id", async () => {
    const result = await executor.execute("hello", { name: "Bob" });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.callId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("LoopExecutor — composite loops", () => {
  it("executes a composite loop with two steps, passing output forward", async () => {
    const registry = new LoopRegistry();
    const backends = new BackendRegistry();
    const executor = new LoopExecutor(registry, backends);

    // A simple prompt loop that extracts keywords
    registry.register({
      id: "extract-keywords",
      name: "Extract Keywords",
      version: "1.0.0",
      kind: "prompt",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      outputSchema: {
        type: "object",
        properties: { keywords: { type: "array", items: { type: "string" } } },
        required: ["keywords"],
      },
      prompt: {
        template: "Extract keywords from: {{text}}",
        variables: ["text"],
      },
      backend: { id: "mock" },
    });

    // A tool loop that wraps/echoes
    registry.register({
      id: "wrap",
      name: "Wrap",
      version: "1.0.0",
      kind: "tool",
      inputSchema: {
        type: "object",
        properties: { keywords: { type: "array" } },
        required: ["keywords"],
      },
      outputSchema: {
        type: "object",
        properties: { keywords: { type: "array" } },
        required: ["keywords"],
      },
      tool: { implementation: "builtin:echo" },
    });

    // Composite: extract-keywords → wrap
    registry.register({
      id: "pipeline",
      name: "Pipeline",
      version: "1.0.0",
      kind: "composite",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      outputSchema: {
        type: "object",
        properties: { keywords: { type: "array" } },
        required: ["keywords"],
      },
      composite: {
        steps: [
          { loopId: "extract-keywords", inputMapping: { text: "$.input.text" } },
          { loopId: "wrap", inputMapping: { keywords: "$.steps[0].output.keywords" } },
        ],
      },
    });

    const result = await executor.execute("pipeline", {
      text: "agentic AI runtime typed loops",
    });

    expect(result.status).toBe("ok");
    expect(result.output?.keywords).toBeDefined();
    expect(Array.isArray(result.output!.keywords)).toBe(true);

    // Trace should include child lifecycle events
    const types = result.trace.map((e) => e.type);
    expect(types.filter((t) => t === "child.started")).toHaveLength(2);
    expect(types.filter((t) => t === "child.completed")).toHaveLength(2);
  });
});

describe("LoopRegistry", () => {
  it("rejects loops with missing required fields", () => {
    const registry = new LoopRegistry();
    expect(() =>
      registry.register({
        id: "broken",
        name: "Broken",
        // missing version, inputSchema, etc
      } as LoopDef),
    ).toThrow();
  });

  it("rejects prompt loops without a prompt spec", () => {
    const registry = new LoopRegistry();
    expect(() =>
      registry.register({
        id: "broken",
        name: "Broken",
        version: "1.0.0",
        kind: "prompt",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      } as LoopDef),
    ).toThrow(/prompt/);
  });
});
