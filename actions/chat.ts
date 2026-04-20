'use server';

import { getChatsByRefinementId, getRefinementById, getTermById, insertChatMessages, type ChatMessage } from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { chatAboutTerm } from '@/lib/openai';

export async function askQuestion(
  refinementId: number,
  question: string,
): Promise<ChatMessage[]> {
  const supabase = await createSupabaseServerClient();

  const refinement = await getRefinementById(supabase, refinementId);
  if (!refinement) throw new Error('Refinement not found');

  const term = await getTermById(supabase, refinement.term_id);
  if (!term) throw new Error('Term not found');

  const history = await getChatsByRefinementId(supabase, refinementId);

  const answer = await chatAboutTerm(
    term.name,
    term.content,
    history.map(({ role, content }) => ({ role, content })),
    question,
  );

  await insertChatMessages(supabase, [
    { refinement_id: refinementId, role: 'user', content: question },
    { refinement_id: refinementId, role: 'assistant', content: answer },
  ]);

  return getChatsByRefinementId(supabase, refinementId);
}
