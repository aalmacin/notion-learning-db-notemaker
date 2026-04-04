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

export type PreRefinementEvaluation = {
  accuracy: number;
  review: string;
};

export type RefinementEvaluation = {
  accuracy: number;
  review: string;
  formattedNote: string;
  additionalNote: string;
};

const PRE_REFINEMENT_PROMPT = `You are a technical learning evaluator using the Feynman technique.
The user has attempted to explain a concept from memory, before doing any research.
Evaluate their explanation and respond with a JSON object with these exact fields:
- "accuracy": integer 0-100 representing how accurate their explanation is
- "review": string describing what they got right and what was incorrect or missing. Be specific and constructive.

Respond ONLY with valid JSON, no markdown or extra text.`;

function buildRefinementPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  return `You are a technical learning evaluator using the Feynman technique.
The user has researched a concept and is now explaining it with that knowledge.
Evaluate their explanation and respond with a JSON object with these exact fields:
- "accuracy": integer 0-100 representing accuracy of the explanation
- "review": string summarizing accuracy, what was correct, and any improvements
- "formattedNote": a compact physical notebook note — 1 short paragraph (2 max if absolutely required), precise definitions, no fluff, no long examples, optimized for fast rereading and recall
- "additionalNote": detailed digital reference notes in markdown format. Use **bold text** for section subheadings and prefix each bullet with "- ". Include a "**Date**: ${today}" line.

Respond ONLY with valid JSON, no markdown or extra text.`;
}

export async function evaluatePreRefinement(
  termName: string,
  userExplanation: string,
): Promise<PreRefinementEvaluation> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PRE_REFINEMENT_PROMPT },
      { role: 'user', content: `Concept: ${termName}\n\nUser explanation: ${userExplanation}` },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(raw) as Partial<PreRefinementEvaluation>;
  if (typeof parsed.accuracy !== 'number' || typeof parsed.review !== 'string') {
    throw new Error('Invalid response shape from OpenAI');
  }

  return {
    accuracy: Math.min(100, Math.max(0, Math.round(parsed.accuracy))),
    review: parsed.review,
  };
}

export async function evaluateRefinement(
  termName: string,
  userExplanation: string,
): Promise<RefinementEvaluation> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildRefinementPrompt() },
      { role: 'user', content: `Concept: ${termName}\n\nUser explanation: ${userExplanation}` },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(raw) as Partial<RefinementEvaluation>;
  if (
    typeof parsed.accuracy !== 'number' ||
    typeof parsed.review !== 'string' ||
    typeof parsed.formattedNote !== 'string' ||
    typeof parsed.additionalNote !== 'string'
  ) {
    throw new Error('Invalid response shape from OpenAI');
  }

  return {
    accuracy: Math.min(100, Math.max(0, Math.round(parsed.accuracy))),
    review: parsed.review,
    formattedNote: parsed.formattedNote,
    additionalNote: parsed.additionalNote,
  };
}

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
