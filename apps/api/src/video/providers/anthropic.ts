import { z } from 'zod';
import { providerFetch } from './http';
import { ProviderError, type LlmProvider } from './types';

const SYSTEM = `Türkçe bir emlak tanıtım metni yaz. Yalnızca verilen "facts" alanındaki bilgileri kullan.
Verilmeyen hiçbir sayı, özellik, manzara, mesafe veya iddia ekleme. Çıktıyı yalnızca şu JSON biçiminde ver: {"text":"..."}`;

const outputSchema = z.object({ text: z.string().min(10).max(1_000) });

/** Anthropic Messages API. The output is parsed and schema-checked here; number checks happen in the pipeline. */
export class AnthropicLlm implements LlmProvider {
  readonly name = 'anthropic';
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model: string,
  ) {
    this.model = model;
  }

  async generateScript(input: {
    facts: Record<string, string | number | boolean | null>;
    durationSeconds: number;
  }) {
    const res = await providerFetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 600,
          system: SYSTEM,
          messages: [
            {
              role: 'user',
              content: `Süre: ${input.durationSeconds} saniye.\nfacts: ${JSON.stringify(input.facts)}`,
            },
          ],
        }),
      },
      { timeoutMs: 30_000, retries: 2 },
    );
    const body = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const raw = body.content?.find((c) => c.type === 'text')?.text ?? '';
    let parsed: z.infer<typeof outputSchema>;
    try {
      parsed = outputSchema.parse(JSON.parse(raw));
    } catch {
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'llm output not in schema');
    }
    const units = (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0);
    return {
      text: parsed.text,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'script',
        externalRequestId: null,
        units,
        unitType: 'calls' as const,
        // Token prices are not in config yet; cost is recorded as 0 until the rate is set (plan-06).
        estimatedCostMicroUsd: 0,
        isMock: false,
      },
    };
  }
}
