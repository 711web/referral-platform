/**
 * Minimal OpenRouter proxy. Returns null if OPENROUTER_API_KEY is missing
 * so the caller can gracefully fall back. Free-tier models default to a
 * small Haiku-class model.
 */
export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';

export function aiAvailable(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function callOpenRouter(
  messages: AiMessage[],
  opts: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<AiCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const model = opts.model ?? DEFAULT_MODEL;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://partner.711web.com',
      'X-Title': 'Partner Referral Platform',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`openrouter ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model: data.model ?? model,
  };
}
