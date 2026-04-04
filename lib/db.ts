import { createClient } from '@supabase/supabase-js';

export type Priority = 'High' | 'Medium' | 'Low';

export type Term = {
  id: number;
  name: string;
  content: string;
  categories: string[];
  created_at: string;
  notion_page_id: string | null;
  priority: Priority;
  explained: boolean;
};

export type Category = {
  id: number;
  name: string;
};

export type ConceptRefinement = {
  id: number;
  term_id: number;
  pre_refinement: string;
  pre_refinement_accuracy: number | null;
  pre_refinement_review: string | null;
  refinement: string | null;
  refinement_accuracy: number | null;
  refinement_review: string | null;
  refinement_formatted_note: string | null;
  refinement_additional_note: string | null;
  created_at: string;
};

type TermRow = Omit<Term, 'categories' | 'explained'>;

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

async function getCategoriesForTerm(termId: number): Promise<string[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('term_categories')
    .select('categories(name)')
    .eq('term_id', termId)
    .order('categories(name)');
  if (error) throw error;
  return (data as unknown as { categories: { name: string } | null }[])
    .map((r) => r.categories?.name)
    .filter((n): n is string => n != null);
}

async function upsertCategories(names: string[]): Promise<number[]> {
  if (names.length === 0) return [];
  const supabase = getClient();
  const { error } = await supabase
    .from('categories')
    .upsert(names.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: selectError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', names);
  if (selectError) throw selectError;
  return (data as Category[]).map((c) => c.id);
}

async function setTermCategories(termId: number, categoryIds: number[]): Promise<void> {
  const supabase = getClient();
  const { error: deleteError } = await supabase
    .from('term_categories')
    .delete()
    .eq('term_id', termId);
  if (deleteError) throw deleteError;
  if (categoryIds.length === 0) return;
  const { error } = await supabase
    .from('term_categories')
    .insert(categoryIds.map((category_id) => ({ term_id: termId, category_id })));
  if (error) throw error;
}

async function isTermExplained(termId: number): Promise<boolean> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('concept_refinements')
    .select('id')
    .eq('term_id', termId)
    .not('refinement_formatted_note', 'is', null)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function getAllCategories(): Promise<Category[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data as Category[];
}

export async function getTerm(name: string): Promise<Term | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as TermRow;
  const [categories, explained] = await Promise.all([
    getCategoriesForTerm(row.id),
    isTermExplained(row.id),
  ]);
  return { ...row, categories, explained };
}

export async function getAllTerms(): Promise<Term[]> {
  const supabase = getClient();
  const { data: rows, error } = await supabase
    .from('terms')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: catLinks, error: catError } = await supabase
    .from('term_categories')
    .select('term_id, categories(name)');
  if (catError) throw catError;

  const catMap = new Map<number, string[]>();
  for (const link of catLinks as unknown as { term_id: number; categories: { name: string } | null }[]) {
    if (!link.categories) continue;
    if (!catMap.has(link.term_id)) catMap.set(link.term_id, []);
    catMap.get(link.term_id)!.push(link.categories.name);
  }

  const { data: explained, error: explainedError } = await supabase
    .from('concept_refinements')
    .select('term_id')
    .not('refinement_formatted_note', 'is', null);
  if (explainedError) throw explainedError;
  const explainedIds = new Set((explained as { term_id: number }[]).map((r) => r.term_id));

  return (rows as TermRow[]).map((row) => ({
    ...row,
    categories: catMap.get(row.id) ?? [],
    explained: explainedIds.has(row.id),
  }));
}

export async function insertTerm(term: Omit<Term, 'id' | 'created_at' | 'explained'>): Promise<Term> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('terms')
    .insert({
      name: term.name,
      content: term.content,
      notion_page_id: term.notion_page_id ?? null,
      priority: term.priority ?? 'Medium',
    })
    .select()
    .single();
  if (error) throw error;
  const row = data as TermRow;
  const categoryIds = await upsertCategories(term.categories);
  await setTermCategories(row.id, categoryIds);
  return { ...row, categories: term.categories, explained: false };
}

export async function updateTerm(
  id: number,
  updates: Partial<Omit<Term, 'id' | 'created_at' | 'explained'>>,
): Promise<Term | null> {
  const supabase = getClient();
  const fields: Partial<TermRow> = {};
  if (updates.name !== undefined) fields.name = updates.name;
  if (updates.content !== undefined) fields.content = updates.content;
  if (updates.notion_page_id !== undefined) fields.notion_page_id = updates.notion_page_id;
  if (updates.priority !== undefined) fields.priority = updates.priority;

  let row: TermRow;
  if (Object.keys(fields).length > 0) {
    const { data, error } = await supabase
      .from('terms')
      .update(fields)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    row = data as TermRow;
  } else {
    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    row = data as TermRow;
  }

  if (updates.categories !== undefined) {
    const categoryIds = await upsertCategories(updates.categories);
    await setTermCategories(row.id, categoryIds);
  }

  const [categories, explained] = await Promise.all([
    getCategoriesForTerm(row.id),
    isTermExplained(row.id),
  ]);
  return { ...row, categories, explained };
}

export async function deleteTerm(id: number): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('terms').delete().eq('id', id);
  if (error) throw error;
}

export async function insertCategory(name: string): Promise<Category> {
  const supabase = getClient();
  const { error } = await supabase
    .from('categories')
    .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: selectError } = await supabase
    .from('categories')
    .select('*')
    .eq('name', name)
    .single();
  if (selectError) throw selectError;
  return data as Category;
}

export async function deleteCategory(id: number): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTermCategories(termId: number, categories: string[]): Promise<Term | null> {
  return updateTerm(termId, { categories });
}

export async function getTermById(id: number): Promise<Term | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as TermRow;
  const [categories, explained] = await Promise.all([
    getCategoriesForTerm(row.id),
    isTermExplained(row.id),
  ]);
  return { ...row, categories, explained };
}

export async function getRefinementsByTermId(termId: number): Promise<ConceptRefinement[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('concept_refinements')
    .select('*')
    .eq('term_id', termId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ConceptRefinement[];
}

export async function getRefinementById(id: number): Promise<ConceptRefinement | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('concept_refinements')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ConceptRefinement | null) ?? null;
}

export async function createRefinement(termId: number, preRefinement: string): Promise<ConceptRefinement> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('concept_refinements')
    .insert({ term_id: termId, pre_refinement: preRefinement })
    .select()
    .single();
  if (error) throw error;
  return data as ConceptRefinement;
}

export async function updatePreRefinementResult(
  id: number,
  accuracy: number,
  review: string,
): Promise<ConceptRefinement> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('concept_refinements')
    .update({ pre_refinement_accuracy: accuracy, pre_refinement_review: review })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ConceptRefinement;
}

export async function updateRefinementData(
  id: number,
  data: {
    refinement: string;
    refinement_accuracy: number;
    refinement_review: string;
    refinement_formatted_note: string;
    refinement_additional_note: string;
  },
): Promise<ConceptRefinement> {
  const supabase = getClient();
  const { data: updated, error } = await supabase
    .from('concept_refinements')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return updated as ConceptRefinement;
}

export async function deleteConceptRefinement(id: number): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('concept_refinements').delete().eq('id', id);
  if (error) throw error;
}
