# LSR — Loop Stack Runtime

> **The reference runtime for [LSEM](https://github.com/loopstacks/spec).**
> Every AI invocation is a typed loop.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## 60-second demo

```bash
docker run -p 3000:3000 ghcr.io/loopstacks/lsr:latest
# Open http://localhost:3000
```

No API keys required — LSR ships with a mock backend so you can see the
full execution model with zero external dependencies. Add `OPENAI_API_KEY`
or `ANTHROPIC_API_KEY` as environment variables to invoke real models.

---

## What is LSR?

LSR is the reference TypeScript runtime for the **Loop Stack Execution
Model (LSEM)**. LSEM formalizes a simple insight: every AI invocation —
every prompt, tool call, RAG lookup, agent handoff, policy decision — is
a **typed loop** with a first-class lifecycle and tracing surface.

Most agent frameworks treat orchestration as glue code. LSR treats it as
a runtime concern.

**What LSR gives you:**

- **A typed loop primitive.** Define loops with JSON input/output schemas.
  Invocations are validated end-to-end.
- **Composition by construction.** Loops call loops as tools. RAG is a
  composite. Multi-agent is a composite. Tool-calling is a composite.
  One primitive, many patterns.
- **First-class tracing.** Every call emits a structured event stream —
  `call.started`, `call.backend.requested`, `call.backend.responded`,
  `call.output.validated`, `call.completed` (or `call.errored`). Stream
  over WebSocket, persist to any tracer.
- **Pluggable model backends.** OpenAI, Anthropic, and Mock ship by default.
- **Three surfaces.** CLI, REST + WebSocket API, web UI.

---

## Try it

### Run a loop from the CLI

```bash
lsr load examples/01-hello.json
lsr run hello --input '{"name":"world"}' --watch
```

You'll see the trace tree stream to your terminal:

```
▶ hello (a3f1b2c4)
  ├ input.validated +2ms
  ├ backend.requested → mock +3ms
  ├ backend.responded (15ms, 11→7 tokens) +18ms
  ├ output.validated +19ms
  └ ✓ completed in 20ms

  output: { "greeting": "Hello, world!" }
```

### Run a composite loop

A RAG pipeline is three composed loops — extract keywords, retrieve
context, synthesize answer. No framework required; just composition.

```bash
lsr run rag-answer --input '{"question":"What are typed loops?"}' --watch
```

### Run via REST

```bash
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{"loopId":"hello","input":{"name":"world"}}'
```

### Subscribe to traces via WebSocket

```bash
websocat ws://localhost:3000/ws/traces
# every trace event, every result, streamed live
```

---

## Repository layout

```
packages/
├── core/       @loopstacks/core    — types, registry, executor, tracer, backends
├── cli/        @loopstacks/cli     — lsr command
├── server/     @loopstacks/server  — Fastify REST + WebSocket
└── ui/         @loopstacks/ui      — React web console
examples/                            — sample loop definitions
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Surfaces:  Web UI    │   CLI    │   REST + WebSocket    │
├──────────────────────────────────────────────────────────┤
│  LoopRegistry  │  LoopExecutor  │  Tracer                │
├──────────────────────────────────────────────────────────┤
│  Backends:  OpenAI  │  Anthropic  │  Mock  │  (custom)   │
└──────────────────────────────────────────────────────────┘
```

- `@loopstacks/core` — types, registry, executor, tracer, backends. No I/O.
- `@loopstacks/server` — Fastify HTTP + WebSocket, static UI serving.
- `@loopstacks/cli` — `lsr` command. Wraps the core for local execution.
- `@loopstacks/ui` — React web console served by the server.

---

## Building from source

```bash
git clone https://github.com/loopstacks/lsr
cd lsr
npm install
cd packages/core   && npx tsc && cd ../..
cd packages/cli    && npx tsc && cd ../..
cd packages/server && npx tsc && cd ../..
cd packages/ui     && npx vite build && cd ../..
```

### Run the server

```bash
LSR_BUNDLE_DIR=./examples \
LSR_STATIC_DIR=./packages/ui/dist \
node packages/server/dist/index.js
```

### Run with Docker

```bash
docker build -t loopstacks/lsr:latest .
docker run -p 3000:3000 loopstacks/lsr:latest
```

---

## Design principles

1. **Typed everything.** Loops declare input and output schemas. The runtime
   validates both on every call.

2. **No custom code.** LSR does not execute arbitrary user-provided code.
   Loops are `prompt`, `composite`, or `tool` — nothing else. Extensibility
   comes through kernel plugins (backends, tool implementations, adapters)
   that run at runtime-operator privilege, not user-land.

3. **Observability is intrinsic.** Every lifecycle transition is a trace
   event. The trace is the audit log.

4. **Composition is the only escape valve.** Need something complex?
   Compose smaller loops. There is no "script" node, no "eval" node, no
   "freeform tool" node.

5. **The runtime is built on its own primitives.** Health checks, adapter
   monitoring, and (eventually) operational workflows are themselves loops.
   One execution model.

---

## License

Apache 2.0. See [LICENSE](LICENSE).
