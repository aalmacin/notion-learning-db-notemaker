import OpenAI from 'openai';

export type TermExplanation = {
  name: string;
  content: string;
  categories: string[];
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a technical learning assistant. When given a technical term or concept, respond with a JSON object with exactly these fields:
- "name": the normalized term name (string)
- "content": a clear, concise explanation suitable for a technical notes database (string, 2-4 sentences)
- "categories": an array of relevant category tags (string[], e.g. ["programming", "databases"])

Respond ONLY with valid JSON, no markdown or extra text.`;

export async function explainTermWithAI(term: string): Promise<TermExplanation> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: term },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(raw) as Partial<TermExplanation>;

  if (
    typeof parsed.name !== 'string' ||
    typeof parsed.content !== 'string' ||
    !Array.isArray(parsed.categories) ||
    !parsed.categories.every((c) => typeof c === 'string')
  ) {
    throw new Error('Invalid response shape from OpenAI');
  }

  return {
    name: parsed.name,
    content: parsed.content,
    categories: parsed.categories,
  };
}
