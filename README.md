# LSR — Loop Stack Runtime

> **The reference runtime for [LSEM](https://github.com/loopstacks/spec).**
> Every AI invocation is a typed loop.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@loopstacks/runtime.svg)](https://www.npmjs.com/package/@loopstacks/runtime)
[![CI](https://github.com/loopstacks/lsr/actions/workflows/ci.yml/badge.svg)](https://github.com/loopstacks/lsr/actions)

---

## 60-second demo

```bash
docker run -p 3000:3000 ghcr.io/loopstacks/lsr:latest
# Open http://localhost:3000
```

No API keys required — LSR ships with a mock backend so you can see the full execution model with zero external dependencies. Add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to invoke real models.

![LSR demo](docs/images/demo.gif)

---

## What is LSR?

LSR is the reference TypeScript runtime for the **Loop Stack Execution Model (LSEM)**.

LSEM formalizes a simple insight: every AI invocation — every prompt, tool call, RAG lookup, agent handoff, policy decision — is a **typed loop**. It has a defined input schema, a defined output schema, a lifecycle, and a tracing surface. Treating these as first-class runtime concerns (rather than glue code between framework calls) unlocks composition, observability, and reliability that are otherwise bolted on after the fact.

LSR makes this concrete. It gives you:

- **A typed loop primitive.** Define a loop with input/output JSON schemas. Invocations are validated end-to-end. No more guessing what your agent returned.
- **Composition by construction.** Loops can call other loops as tools. RAG is a composite loop. Multi-agent is a composite loop. Tool-calling is a composite loop. One primitive, many patterns.
- **First-class tracing.** Every loop call emits a structured event stream — `call.started`, `input.validated`, `backend.requested`, `backend.responded`, `output.validated`, `call.completed` (or `call.errored`). Stream over WebSocket to any UI, persist to any tracer backend.
- **Pluggable model backends.** OpenAI, Anthropic, and a Mock backend ship by default. Add your own with a small interface.
- **Three surfaces.** CLI, REST + WebSocket API, web UI. Use whichever fits your workflow.

LSR is **not** a framework that owns your agent code. It's a runtime that executes loops and gets out of the way.

---

## Try it

### Define a loop

A loop is a JSON document. Here's the simplest possible one:

```json
{
  "id": "hello",
  "name": "Hello Loop",
  "version": "1.0.0",
  "kind": "prompt",
  "inputSchema": {
    "type": "object",
    "properties": { "name": { "type": "string" } },
    "required": ["name"]
  },
  "outputSchema": {
    "type": "object",
    "properties": { "greeting": { "type": "string" } }
  },
  "prompt": {
    "template": "Greet someone named {{name}} in one sentence.",
    "variables": ["name"]
  },
  "backend": { "id": "mock" }
}
```

### Run it

```bash
lsr load examples/01-hello.json
lsr run hello --input '{"name":"world"}' --watch
```

You'll see the trace tree stream in real time:

```
▶ hello (call_abc123)
  ├ input.validated (1ms)
  ├ backend.requested → mock
  ├ backend.responded (12ms)
  ├ output.validated (1ms)
  └ ✓ completed in 14ms

  output: { "greeting": "Hello, world!" }
```

### Compose loops

The interesting move: loops can call loops. A RAG loop is just three composed loops — extract keywords, retrieve context, synthesize answer.

```json
{
  "id": "rag-answer",
  "kind": "composite",
  "composite": {
    "steps": [
      { "loopId": "extract-keywords", "inputMapping": { "text": "$.input.question" } },
      { "loopId": "retrieve-context", "inputMapping": { "keywords": "$.steps[0].output.keywords" } },
      { "loopId": "synthesize-answer", "inputMapping": {
          "question": "$.input.question",
          "context":  "$.steps[1].output.documents"
      }}
    ]
  }
}
```

The trace viewer shows nested calls under the parent. The composition is visible. You can swap any step for a different loop without touching the others.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Surfaces:  Web UI    │   CLI    │   REST + WebSocket    │
├──────────────────────────────────────────────────────────┤
│  LoopRegistry  │  LoopExecutor  │  Tracer                │
├──────────────────────────────────────────────────────────┤
│  Backends:  OpenAI  │  Anthropic  │  Mock  │  (custom)   │
├──────────────────────────────────────────────────────────┤
│  Storage:  SQLite (loops, runs, traces)                  │
└──────────────────────────────────────────────────────────┘
```

- **`@loopstacks/core`** — types, registry, executor, tracer, backends. No I/O.
- **`@loopstacks/server`** — Fastify HTTP + WebSocket server. SQLite persistence.
- **`@loopstacks/cli`** — `lsr` command. Wraps the core; can run standalone or talk to a server.
- **`@loopstacks/ui`** — React web console. Served as static assets by `@loopstacks/server`.

See [docs/architecture.md](docs/architecture.md) for the long version.

---

## Why typed loops?

Most agent frameworks let you wire up LLM calls, tools, and orchestration logic in code. That works for prototypes. It breaks down when you want to:

- **Trace a production failure** through five nested calls — without the framework's tracing being the source of truth, you're parsing log files.
- **Swap the model** for one step of a multi-step pipeline — without breaking the rest.
- **Validate that the model actually returned what you asked for** — without writing the validation by hand for every call site.
- **Compose loops written by someone else** — without rewriting them to fit your framework's idioms.

The framework approach optimizes for the first hour. The runtime approach optimizes for everything that comes after. LSEM and LSR exist because the agentic systems being built today are going to live in production for years, and they deserve a substrate that takes their lifecycle seriously.

This is the same pattern as compilers vs. transpilers, or container runtimes vs. shell scripts. The primitive matters more than the convenience.

---

## Roadmap

**v0.1 (current)** — core types, executor, tracer, OpenAI/Anthropic/Mock backends, CLI, REST + WebSocket server, web UI for define/run/trace, composite loops.

**v0.2** — visual composer (drag-and-drop loop composition), persistent run history, trace export (OpenTelemetry).

**v0.3** — eval harness (define test cases, run against any loop, compare across model backends), policy-based routing primitives.

Beyond that — coordination patterns at scale (cross-process, cross-cluster) — see the related [LoopStacks Platform](https://github.com/loopstacks-platform/loopstacks-platform) project.

---

## Documentation

- **[Architecture](docs/architecture.md)** — how the runtime is wired
- **[LSEM Specification](https://github.com/loopstacks/spec)** — the formal model
- **[Examples](https://github.com/loopstacks/examples)** — sample loops you can run

---

## Contributing

Issues, PRs, and discussions all welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

The fastest way to contribute right now: try the demo, file an issue describing what surprised you (good or bad), and we'll go from there.

---

## License

Apache 2.0. See [LICENSE](LICENSE).
