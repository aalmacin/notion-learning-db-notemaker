import OpenAI from 'openai';

export type TermExplanation = {
  name: string;
  content: string;
  categories: string[];
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSystemPrompt(categories: string[]): string {
  return `You are a technical learning assistant. When given a technical term or concept, respond with a JSON object with exactly these fields:
- "name": the properly cased term name as it is conventionally written (string, e.g. "DKIM", "TCP/IP", "GraphQL", "OAuth 2.0")
- "content": a clear, concise explanation suitable for a technical notes database (string, 2-4 sentences)
- "categories": an array of categories chosen ONLY from this exact list (use the exact casing shown): ${categories.join(', ')}. Use "Uncategorized" ONLY if none of the other categories apply — never combine it with other categories.

Respond ONLY with valid JSON, no markdown or extra text.`;
}

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

function buildRefinementPrompt(conceptName: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `You are a technical learning evaluator using the Feynman technique.
The user has researched the concept "${conceptName}" and is now explaining it with that knowledge.
Evaluate their explanation and respond with a JSON object with these exact fields:
- "accuracy": integer 0-100 representing accuracy of the explanation
- "review": string summarizing accuracy, what was correct, and any improvements
- "formattedNote": a concise but complete plain-text explanation of "${conceptName}" — no markdown, no bold, no bullets. The core concept is strictly "${conceptName}" itself, not the broader domain it belongs to. Every sentence must directly describe what this concept is, how it specifically works, or why it specifically matters. If a sentence describes behavior or context that belongs to a broader system or a related concept, move it to additionalNote's Suggested Studies instead. Use 1-2 short paragraphs.
- "additionalNote": digital reference notes in markdown format. Use **bold text** for section subheadings and prefix each bullet with "- ". Include a "**Date**: ${today}" line. Must include a "**Suggested Studies**" section listing related concepts worth exploring separately (e.g. similar technologies, complementary concepts, common points of confusion). Every point in this note must directly support understanding the main concept.

Respond ONLY with valid JSON, no markdown or extra text.`;
}

export async function evaluatePreRefinement(
  termName: string,
  userExplanation: string,
): Promise<PreRefinementEvaluation> {
  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
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
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: buildRefinementPrompt(termName) },
      { role: 'user', content: `Concept: ${termName}\n\nUser explanation: ${userExplanation}` },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(raw) as Partial<RefinementEvaluation> & Record<string, unknown>;
  const formattedNote =
    typeof parsed.formattedNote === 'string'
      ? parsed.formattedNote
      : typeof parsed.formatted_note === 'string'
        ? parsed.formatted_note
        : undefined;
  const additionalNote =
    typeof parsed.additionalNote === 'string'
      ? parsed.additionalNote
      : typeof parsed.additional_note === 'string'
        ? parsed.additional_note
        : undefined;

  if (
    typeof parsed.accuracy !== 'number' ||
    typeof parsed.review !== 'string' ||
    typeof formattedNote !== 'string' ||
    typeof additionalNote !== 'string'
  ) {
    throw new Error('Invalid response shape from OpenAI');
  }

  return {
    accuracy: Math.min(100, Math.max(0, Math.round(parsed.accuracy))),
    review: parsed.review,
    formattedNote,
    additionalNote,
  };
}

export async function explainTermWithAI(term: string, allowedCategories: string[], context?: string): Promise<TermExplanation> {
  const userContent = context ? `Term: ${term}\nContext: ${context}` : term;
  const response = await client.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: buildSystemPrompt(allowedCategories) },
      { role: 'user', content: userContent },
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

  const categories = (parsed.categories as string[]).filter((c) => allowedCategories.includes(c));
  const specificCategories = categories.filter((c) => c !== 'Uncategorized');

  return {
    name: parsed.name,
    content: parsed.content,
    categories: specificCategories.length > 0 ? specificCategories : ['Uncategorized'],
  };
}
