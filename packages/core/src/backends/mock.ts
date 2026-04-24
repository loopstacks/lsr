import type { BackendRequest, BackendResponse, ModelBackend } from "../types.js";

/**
 * Mock backend — deterministic, no external calls.
 *
 * This is the critical backend for the demo: users can `docker run` and see
 * the full runtime work with zero external dependencies or API keys.
 *
 * Mock responds based on prompt content heuristics to produce plausible-looking
 * structured output. It's not intelligent — it's predictable.
 */
export class MockBackend implements ModelBackend {
  readonly id = "mock";

  async invoke(req: BackendRequest): Promise<BackendResponse> {
    // Simulate a brief network delay to make traces look realistic
    await new Promise((r) => setTimeout(r, 10 + Math.random() * 20));

    const text = this.generate(req.prompt);
    const inputTokens = Math.ceil(req.prompt.length / 4);
    const outputTokens = Math.ceil(text.length / 4);

    return {
      text,
      inputTokens,
      outputTokens,
      rawProviderResponse: { provider: "mock", length: text.length },
    };
  }

  /**
   * Produce a response that, where possible, parses as JSON matching what a
   * typical downstream schema would expect. For non-JSON prompts, return a
   * short natural-language response derived from the prompt.
   */
  private generate(prompt: string): string {
    const lower = prompt.toLowerCase();

    // Greeting pattern: "Greet someone named X in one sentence."
    const greetMatch = prompt.match(/greet\s+(?:someone\s+named\s+)?(\w+)/i);
    if (greetMatch) {
      return JSON.stringify({ greeting: `Hello, ${greetMatch[1]}!` });
    }

    // Summarize pattern
    if (lower.includes("summarize") || lower.includes("summary")) {
      return JSON.stringify({
        summary: "This is a mock summary. The input describes a topic and its key facets.",
        keyPoints: ["First key point", "Second key point", "Third key point"],
      });
    }

    // Classify pattern
    if (lower.includes("classify") || lower.includes("category")) {
      return JSON.stringify({
        category: "general",
        confidence: 0.87,
      });
    }

    // Retrieve pattern — returns a documents array.
    // Check BEFORE keyword pattern, because retrieve prompts often mention "keywords".
    if (lower.includes("retrieve") || lower.includes("documents for")) {
      return JSON.stringify({
        documents: [
          "Document 1: relevant context about the topic.",
          "Document 2: additional background information.",
          "Document 3: specific details and examples.",
        ],
      });
    }

    // Extract-keywords pattern
    if (lower.includes("keyword") || lower.includes("extract")) {
      return JSON.stringify({
        keywords: ["alpha", "beta", "gamma"],
      });
    }

    // Answer/synthesize pattern
    if (lower.includes("answer") || lower.includes("synthesize")) {
      return JSON.stringify({
        answer: "This is a mock synthesized answer based on the provided context.",
      });
    }

    // Default: plain-text response
    return JSON.stringify({
      text: "This is a mock response from the Mock backend. Configure a real backend (OpenAI, Anthropic) via environment variables for real model inference.",
    });
  }
}
