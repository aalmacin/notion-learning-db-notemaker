'use server';

import { APIResponseError } from '@notionhq/client';
import { revalidatePath } from 'next/cache';
import { type Term, getAllTerms, insertTerm, updateTerm, getUserSettings } from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createNotionPage,
  getAllNotionPages,
  getNotionPageContent,
  updateNotionPageMetadata,
} from '@/lib/notion';

const STALE_NOTION_CODES = new Set(['object_not_found', 'validation_error']);

export async function addToNotion(
  termId: number,
  term: { name: string; content: string; categories: string[]; priority: string },
): Promise<Term> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const settings = await getUserSettings(supabase, user.id);
  if (!settings?.notion_api_key || !settings?.notion_database_id) {
    throw new Error('Notion credentials not configured. Go to Settings to add your Notion API key and database ID.');
  }

  const pageId = await createNotionPage(
    { apiKey: settings.notion_api_key, databaseId: settings.notion_database_id },
    term,
  );
  const updated = await updateTerm(supabase, termId, { notion_page_id: pageId });

  if (!updated) {
    throw new Error(`Term ${termId} not found`);
  }

  revalidatePath('/terms');
  return updated;
}

const NOTION_UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function isValidNotionId(id: string): boolean {
  return NOTION_UUID_RE.test(id.trim());
}

export async function syncWithNotion(): Promise<{ synced: number; imported: number; stale: string[]; dbError?: string }> {
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

  const [terms, notionPagesResult] = await Promise.all([
    getAllTerms(supabase),
    getAllNotionPages(credentials).catch((err: unknown) => err),
  ]);

  const notionPages = notionPagesResult instanceof Error ? [] : (notionPagesResult as Awaited<ReturnType<typeof getAllNotionPages>>);
  const dbError = notionPagesResult instanceof Error ? (notionPagesResult as Error).message : undefined;

  const linkedIds = new Set(terms.map((t) => t.notion_page_id).filter(Boolean));
  const linked = terms.filter((t) => t.notion_page_id && isValidNotionId(t.notion_page_id));
  const notionOnly = notionPages.filter((p) => !linkedIds.has(p.id));
  const stale: string[] = [];

  await Promise.allSettled([
    // Update existing linked terms
    ...linked.map(async (term) => {
      const pageId = term.notion_page_id!;
      try {
        const [notionContent] = await Promise.all([
          getNotionPageContent(credentials, pageId),
          updateNotionPageMetadata(credentials, pageId, term.categories, term.priority),
        ]);
        if (notionContent && notionContent !== term.content) {
          await updateTerm(supabase, term.id, { content: notionContent });
        }
      } catch (err) {
        if (err instanceof APIResponseError && STALE_NOTION_CODES.has(err.code)) {
          stale.push(term.name);
          await updateTerm(supabase, term.id, { notion_page_id: null });
        }
      }
    }),
    // Import Notion pages that have no local DB entry
    ...notionOnly.map(async (page) => {
      const content = await getNotionPageContent(credentials, page.id);
      await insertTerm(supabase, {
        name: page.name,
        content,
        categories: page.categories,
        priority: page.priority,
        notion_page_id: page.id,
      });
    }),
  ]);

  revalidatePath('/terms');
  return { synced: linked.length - stale.length, imported: notionOnly.length, stale, dbError };
}
