import type { SupabaseClient } from '@supabase/supabase-js';

export type Priority = 'High' | 'Medium' | 'Low';

export type UserSettings = {
  user_id: string;
  notion_api_key: string | null;
  notion_database_id: string | null;
  timezone: string;
  updated_at: string;
};

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

async function getCategoriesForTerm(supabase: SupabaseClient, termId: number): Promise<string[]> {
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

async function upsertCategories(supabase: SupabaseClient, names: string[]): Promise<number[]> {
  if (names.length === 0) return [];
  const { error } = await supabase
    .from('categories')
    .upsert(names.map((name) => ({ name })), { onConflict: 'name,user_id', ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: selectError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', names);
  if (selectError) throw selectError;
  return (data as Category[]).map((c) => c.id);
}

async function setTermCategories(
  supabase: SupabaseClient,
  termId: number,
  categoryIds: number[],
): Promise<void> {
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

async function isTermExplained(supabase: SupabaseClient, termId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('concept_refinements')
    .select('id')
    .eq('term_id', termId)
    .not('refinement_formatted_note', 'is', null)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function getAllCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data as Category[];
}

export async function getTerm(supabase: SupabaseClient, name: string): Promise<Term | null> {
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as TermRow;
  const [categories, explained] = await Promise.all([
    getCategoriesForTerm(supabase, row.id),
    isTermExplained(supabase, row.id),
  ]);
  return { ...row, categories, explained };
}

export async function getAllTerms(supabase: SupabaseClient): Promise<Term[]> {
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

export async function insertTerm(
  supabase: SupabaseClient,
  term: Omit<Term, 'id' | 'created_at' | 'explained'>,
): Promise<Term> {
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
  const categoryIds = await upsertCategories(supabase, term.categories);
  await setTermCategories(supabase, row.id, categoryIds);
  return { ...row, categories: term.categories, explained: false };
}

export async function updateTerm(
  supabase: SupabaseClient,
  id: number,
  updates: Partial<Omit<Term, 'id' | 'created_at' | 'explained'>>,
): Promise<Term | null> {
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
    const categoryIds = await upsertCategories(supabase, updates.categories);
    await setTermCategories(supabase, row.id, categoryIds);
  }

  const [categories, explained] = await Promise.all([
    getCategoriesForTerm(supabase, row.id),
    isTermExplained(supabase, row.id),
  ]);
  return { ...row, categories, explained };
}

export async function deleteTerm(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('terms').delete().eq('id', id);
  if (error) throw error;
}

export async function insertCategory(supabase: SupabaseClient, name: string): Promise<Category> {
  const { error } = await supabase
    .from('categories')
    .upsert({ name }, { onConflict: 'name,user_id', ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: selectError } = await supabase
    .from('categories')
    .select('*')
    .eq('name', name)
    .single();
  if (selectError) throw selectError;
  return data as Category;
}

export async function deleteCategory(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTermCategories(
  supabase: SupabaseClient,
  termId: number,
  categories: string[],
): Promise<Term | null> {
  return updateTerm(supabase, termId, { categories });
}

export async function getTermById(supabase: SupabaseClient, id: number): Promise<Term | null> {
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as TermRow;
  const [categories, explained] = await Promise.all([
    getCategoriesForTerm(supabase, row.id),
    isTermExplained(supabase, row.id),
  ]);
  return { ...row, categories, explained };
}

export async function getRefinementsByTermId(
  supabase: SupabaseClient,
  termId: number,
): Promise<ConceptRefinement[]> {
  const { data, error } = await supabase
    .from('concept_refinements')
    .select('*')
    .eq('term_id', termId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ConceptRefinement[];
}

export async function getRefinementById(
  supabase: SupabaseClient,
  id: number,
): Promise<ConceptRefinement | null> {
  const { data, error } = await supabase
    .from('concept_refinements')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ConceptRefinement | null) ?? null;
}

export async function createRefinement(
  supabase: SupabaseClient,
  termId: number,
  preRefinement: string,
): Promise<ConceptRefinement> {
  const { data, error } = await supabase
    .from('concept_refinements')
    .insert({ term_id: termId, pre_refinement: preRefinement })
    .select()
    .single();
  if (error) throw error;
  return data as ConceptRefinement;
}

export async function updatePreRefinementResult(
  supabase: SupabaseClient,
  id: number,
  accuracy: number,
  review: string,
): Promise<ConceptRefinement> {
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
  supabase: SupabaseClient,
  id: number,
  data: {
    refinement: string;
    refinement_accuracy: number;
    refinement_review: string;
    refinement_formatted_note: string;
    refinement_additional_note: string;
  },
): Promise<ConceptRefinement> {
  const { data: updated, error } = await supabase
    .from('concept_refinements')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return updated as ConceptRefinement;
}

export async function deleteConceptRefinement(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase.from('concept_refinements').delete().eq('id', id);
  if (error) throw error;
}

export async function getUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserSettings | null;
}

export async function upsertUserSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: { notion_api_key: string | null; notion_database_id: string | null },
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as UserSettings;
}

export async function updateNotionDatabaseId(
  supabase: SupabaseClient,
  userId: string,
  databaseId: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .update({ notion_database_id: databaseId, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateTimezone(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, timezone, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function clearNotionCredentials(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .update({ notion_api_key: null, notion_database_id: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}
