import OpenAI from 'openai';

export type TermExplanation = {
  name: string;
  content: string;
  categories: string[];
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_CATEGORIES = [
  'Web Development',
  'Backend',
  'Software Architecture',
  'DevOps',
  'Dev Stuff',
  'Network Engineering',
  'System Design',
  'Business',
  'Database Engineering',
  'Security',
  'TypeScript',
  'Java',
  'Artificial Intelligence',
  'Operating System',
  'Crypto',
  'Data Structures & Algorithms',
  'Math',
  'Statistics',
  'Uncategorized',
] as const;

export type Category = (typeof ALLOWED_CATEGORIES)[number];

const SYSTEM_PROMPT = `You are a technical learning assistant. When given a technical term or concept, respond with a JSON object with exactly these fields:
- "name": the properly cased term name as it is conventionally written (string, e.g. "DKIM", "TCP/IP", "GraphQL", "OAuth 2.0")
- "content": a clear, concise explanation suitable for a technical notes database (string, 2-4 sentences)
- "categories": an array of categories chosen ONLY from this exact list (use the exact casing shown): ${ALLOWED_CATEGORIES.join(', ')}. Use "Uncategorized" if none apply.

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

  const categories = (parsed.categories as string[]).filter((c): c is Category =>
    (ALLOWED_CATEGORIES as readonly string[]).includes(c)
  );

  return {
    name: parsed.name,
    content: parsed.content,
    categories: categories.length > 0 ? categories : ['Uncategorized'],
  };
}
