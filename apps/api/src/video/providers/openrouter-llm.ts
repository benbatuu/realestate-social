import { z } from 'zod';
import { providerFetch } from './http';
import { ProviderError, type LlmProvider } from './types';

const SYSTEM = `Türkçe bir emlak tanıtım metni yaz. Yalnızca verilen "facts" alanındaki bilgileri kullan.
Verilmeyen hiçbir sayı, özellik, manzara, mesafe veya iddia ekleme. Çıktıyı yalnızca şu JSON biçiminde ver: {"text":"..."}`;

const outputSchema = z.object({ text: z.string().min(10).max(1_000) });

/** Claude through OpenRouter's chat completions API, on the same key as the video models. */
export class OpenRouterLlm implements LlmProvider {
  readonly name = 'openrouter';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generateScript(input: {
    facts: Record<string, string | number | boolean | null>;
    durationSeconds: number;
  }) {
    const res = await providerFetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 600,
          response_format: { type: 'json_object' },
          usage: { include: true },
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: `Süre: ${input.durationSeconds} saniye.\nfacts: ${JSON.stringify(input.facts)}`,
            },
          ],
        }),
      },
      // A few cents at most; one retry on network errors is acceptable here.
      { timeoutMs: 60_000, retries: 1 },
    );
    const body = (await res.json()) as {
      id?: string;
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number; cost?: number };
    };
    const raw = (body.choices?.[0]?.message?.content ?? '').trim();
    let parsed: z.infer<typeof outputSchema>;
    try {
      parsed = outputSchema.parse(JSON.parse(stripFence(raw)));
    } catch {
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'llm output not in schema');
    }
    return {
      text: parsed.text,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'script',
        externalRequestId: body.id ?? null,
        units: body.usage?.total_tokens ?? 0,
        unitType: 'calls' as const,
        estimatedCostMicroUsd:
          typeof body.usage?.cost === 'number' ? Math.round(body.usage.cost * 1_000_000) : 0,
        isMock: false,
      },
    };
  }
}

/** Models sometimes wrap JSON in a ``` fence even when asked not to. */
function stripFence(text: string): string {
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  return m ? m[1]! : text;
}
