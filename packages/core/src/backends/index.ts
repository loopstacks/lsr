import type { ModelBackend } from "../types.js";
import { MockBackend } from "./mock.js";
import { OpenAIBackend } from "./openai.js";
import { AnthropicBackend } from "./anthropic.js";

/**
 * BackendRegistry — pluggable model provider registry.
 *
 * Register a backend by id, retrieve it later by reference from a LoopDef.
 * The Mock backend is always registered by default to guarantee the runtime
 * works out of the box without API keys.
 *
 * Real backends (OpenAI, Anthropic) are auto-registered when the
 * corresponding environment variable is present:
 *   - OPENAI_API_KEY    → "openai" backend
 *   - ANTHROPIC_API_KEY → "anthropic" backend
 */
export class BackendRegistry {
  private backends = new Map<string, ModelBackend>();

  constructor(opts: { autoRegisterFromEnv?: boolean } = {}) {
    this.register(new MockBackend());

    if (opts.autoRegisterFromEnv === true) {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) this.register(new OpenAIBackend(openaiKey));

      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) this.register(new AnthropicBackend(anthropicKey));
    }
  }

  register(backend: ModelBackend): void {
    this.backends.set(backend.id, backend);
  }

  get(id: string): ModelBackend | undefined {
    return this.backends.get(id);
  }

  require(id: string): ModelBackend {
    const b = this.backends.get(id);
    if (!b) throw new Error(`backend not registered: ${id}`);
    return b;
  }

  list(): string[] {
    return Array.from(this.backends.keys());
  }
}

export { MockBackend, OpenAIBackend, AnthropicBackend };
