'use server';

import { revalidatePath } from 'next/cache';
import {
  createRefinement,
  updatePreRefinementResult,
  updateRefinementData,
  deleteConceptRefinement,
  getRefinementById,
  getTermById,
  updateTerm,
  getUserSettings,
  type ConceptRefinement,
} from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { evaluatePreRefinement, evaluateRefinement } from '@/lib/openai';
import { createNotionPage, appendRefinementToNotionPage } from '@/lib/notion';

export async function submitPreRefinement(
  termId: number,
  userExplanation: string,
): Promise<ConceptRefinement> {
  const supabase = await createSupabaseServerClient();
  const term = await getTermById(supabase, termId);
  if (!term) throw new Error('Term not found');

  const refinement = await createRefinement(supabase, termId, userExplanation);
  const result = await evaluatePreRefinement(term.name, userExplanation);
  const updated = await updatePreRefinementResult(supabase, refinement.id, result.accuracy, result.review);

  revalidatePath(`/terms/${termId}`);
  return updated;
}

export async function submitRefinement(
  refinementId: number,
  termId: number,
  userExplanation: string,
): Promise<ConceptRefinement> {
  const supabase = await createSupabaseServerClient();
  const term = await getTermById(supabase, termId);
  if (!term) throw new Error('Term not found');

  const result = await evaluateRefinement(term.name, userExplanation);
  const updated = await updateRefinementData(supabase, refinementId, {
    refinement: userExplanation,
    refinement_accuracy: result.accuracy,
    refinement_review: result.review,
    refinement_formatted_note: result.formattedNote,
    refinement_additional_note: result.additionalNote,
  });

  revalidatePath(`/terms/${termId}`);
  revalidatePath('/terms');
  return updated;
}

export async function addRefinementToNotion(termId: number, refinementId: number): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const settings = await getUserSettings(supabase, user.id);
  if (!settings?.notion_api_key || !settings?.notion_database_id) {
    throw new Error('Notion credentials not configured. Go to Settings to add your Notion API key and database ID.');
  }
  const credentials = { apiKey: settings.notion_api_key, databaseId: settings.notion_database_id };

  const term = await getTermById(supabase, termId);
  if (!term) throw new Error('Term not found');

  const refinement = await getRefinementById(supabase, refinementId);
  if (
    !refinement?.refinement ||
    !refinement.refinement_formatted_note ||
    !refinement.refinement_additional_note
  ) {
    throw new Error('Refinement not complete');
  }

  let pageId = term.notion_page_id;
  if (!pageId) {
    pageId = await createNotionPage(credentials, {
      name: term.name,
      content: term.content,
      categories: term.categories,
      priority: term.priority,
    });
    await updateTerm(supabase, termId, { notion_page_id: pageId });
  }

  await appendRefinementToNotionPage(
    credentials,
    pageId,
    {
      refinement: refinement.refinement,
      refinement_formatted_note: refinement.refinement_formatted_note,
      refinement_additional_note: refinement.refinement_additional_note,
    },
    term.name,
  );

  revalidatePath(`/terms/${termId}`);
  revalidatePath('/terms');
}

export async function submitRefinementOnly(
  termId: number,
  userExplanation: string,
): Promise<ConceptRefinement> {
  const supabase = await createSupabaseServerClient();
  const term = await getTermById(supabase, termId);
  if (!term) throw new Error('Term not found');

  // Empty pre_refinement signals this attempt skipped the cold start step
  const refinement = await createRefinement(supabase, termId, '');
  const result = await evaluateRefinement(term.name, userExplanation);
  const updated = await updateRefinementData(supabase, refinement.id, {
    refinement: userExplanation,
    refinement_accuracy: result.accuracy,
    refinement_review: result.review,
    refinement_formatted_note: result.formattedNote,
    refinement_additional_note: result.additionalNote,
  });

  revalidatePath(`/terms/${termId}`);
  revalidatePath('/terms');
  return updated;
}

export async function removeRefinement(id: number, termId: number): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await deleteConceptRefinement(supabase, id);
  revalidatePath(`/terms/${termId}`);
  revalidatePath('/terms');
}
