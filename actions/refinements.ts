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
  type ConceptRefinement,
} from '@/lib/db';
import { evaluatePreRefinement, evaluateRefinement } from '@/lib/openai';
import { createNotionPage, appendRefinementToNotionPage } from '@/lib/notion';

export async function submitPreRefinement(
  termId: number,
  userExplanation: string,
): Promise<ConceptRefinement> {
  const term = await getTermById(termId);
  if (!term) throw new Error('Term not found');

  const refinement = await createRefinement(termId, userExplanation);
  const result = await evaluatePreRefinement(term.name, userExplanation);
  const updated = await updatePreRefinementResult(refinement.id, result.accuracy, result.review);

  revalidatePath(`/terms/${termId}`);
  return updated;
}

export async function submitRefinement(
  refinementId: number,
  termId: number,
  userExplanation: string,
): Promise<ConceptRefinement> {
  const term = await getTermById(termId);
  if (!term) throw new Error('Term not found');

  const result = await evaluateRefinement(term.name, userExplanation);
  const updated = await updateRefinementData(refinementId, {
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
  const term = await getTermById(termId);
  if (!term) throw new Error('Term not found');

  const refinement = await getRefinementById(refinementId);
  if (
    !refinement?.refinement ||
    !refinement.refinement_formatted_note ||
    !refinement.refinement_additional_note
  ) {
    throw new Error('Refinement not complete');
  }

  let pageId = term.notion_page_id;
  if (!pageId) {
    pageId = await createNotionPage({
      name: term.name,
      content: term.content,
      categories: term.categories,
      priority: term.priority,
    });
    await updateTerm(termId, { notion_page_id: pageId });
  }

  await appendRefinementToNotionPage(
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

export async function removeRefinement(id: number, termId: number): Promise<void> {
  await deleteConceptRefinement(id);
  revalidatePath(`/terms/${termId}`);
  revalidatePath('/terms');
}
