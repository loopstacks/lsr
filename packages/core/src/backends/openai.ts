import type { BackendRequest, BackendResponse, ModelBackend } from "../types.js";

/**
 * OpenAI backend. Uses fetch directly (no SDK dependency) to keep the
 * bundle small and avoid version coupling to the OpenAI SDK.
 *
 * Activated by setting OPENAI_API_KEY. The backend is registered only if
 * the key is present at runtime construction time.
 */
export class OpenAIBackend implements ModelBackend {
  readonly id = "openai";

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("OpenAIBackend requires an API key");
  }

  async invoke(req: BackendRequest): Promise<BackendResponse> {
    const model = req.model ?? "gpt-4o-mini";

    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      rawProviderResponse: data,
    };
  }
}
