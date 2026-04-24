import type { BackendRequest, BackendResponse, ModelBackend } from "../types.js";

/**
 * Anthropic backend. Uses fetch directly. Activated by ANTHROPIC_API_KEY.
 */
export class AnthropicBackend implements ModelBackend {
  readonly id = "anthropic";

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("AnthropicBackend requires an API key");
  }

  async invoke(req: BackendRequest): Promise<BackendResponse> {
    const model = req.model ?? "claude-3-5-haiku-latest";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        system: req.systemPrompt,
        messages: [{ role: "user", content: req.prompt }],
        temperature: req.temperature,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    return {
      text,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      rawProviderResponse: data,
    };
  }
}
