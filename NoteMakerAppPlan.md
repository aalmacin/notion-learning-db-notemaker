# NoteMaker App Plan

## Overview

A Next.js app for saving technical learning notes, powered by OpenAI for concept explanations, SQLite for local caching, and Notion for permanent storage.

## Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite via `better-sqlite3`
- **AI**: OpenAI API
- **Notion**: `@notionhq/client`
- **Styling**: Tailwind CSS v4
- **TanStack Query**: server state, mutations, caching
- **TanStack Form**: form state and validation
- **TanStack Table**: terms table with filtering/sorting
- **TanStack Store**: client-side UI state

---

## Patterns

- Use **Server Actions** (`"use server"`) for all mutations (explain, delete, add to Notion)
- Use **Server Components** for initial data fetching (pass as `initialData` to TanStack Query)
- Use **Client Components** (`"use client"`) for all interactive UI
- Wire server actions to TanStack Query `useMutation` for loading/error states
- No API routes unless a webhook or external callback is required

---

## Phases

### Phase 1 — Database & Query Layer

**Goal**: Set up the local SQLite database and typed query helpers.

**Tasks**:
1. Install `better-sqlite3` and `@types/better-sqlite3`
2. Create `lib/db.ts` — initialize DB, define schema, export typed query helpers
3. Schema:
   - `terms` table: `id`, `name`, `content`, `categories` (JSON text), `created_at`, `notion_page_id` (nullable)
4. Export typed functions: `getTerm`, `getAllTerms`, `insertTerm`, `updateTerm`, `deleteTerm`

**Parallelizable**: Yes — independent of UI.

---

### Phase 2 — OpenAI Integration (Server Action)

**Goal**: Implement the prompt pipeline as a server action.

**Tasks**:
1. Install `openai`
2. Create `lib/openai.ts` — build prompt, call OpenAI, parse and validate JSON response
3. Create `actions/explain.ts` (server action):
   - Normalize term name
   - Check DB cache first; return cached result if found
   - Otherwise call OpenAI, store in DB, return result
4. Create `actions/terms.ts`: `deleteTerm`, `regenerateTerm` server actions
5. Add `.env.local`: `OPENAI_API_KEY`

**Parallelizable**: Depends on Phase 1 DB helpers.

---

### Phase 3 — TanStack Setup & Providers

**Goal**: Install and configure TanStack libraries; set up shared providers.

**Tasks**:
1. Install:
   - `@tanstack/react-query`
   - `@tanstack/react-form`
   - `@tanstack/react-table`
   - `@tanstack/store`
2. Create `components/Providers.tsx` — wrap app with `QueryClientProvider`
3. Update `app/layout.tsx` to include `<Providers>`
4. Create `lib/queryKeys.ts` — centralized query key factory
5. Create `store/termStore.ts` — TanStack Store for current result state (active term, result card visibility)

**Parallelizable**: Yes — can be done alongside Phase 1.

---

### Phase 4 — Main Page UI

**Goal**: Home page where users submit a term and see the result.

**Tasks**:
1. `app/page.tsx` — Server Component shell; fetches nothing, renders `<TermForm />`
2. `components/TermForm.tsx` — Client Component using **TanStack Form**:
   - Single text field with validation (required, min length)
   - On submit: calls `explainTerm` server action via TanStack Query `useMutation`
   - Loading/error states from mutation
3. `components/TermResult.tsx` — Client Component reading from TanStack Store:
   - Term name, categories (tags), content paragraph
   - Action buttons each wired to their own `useMutation`:
     - **Regenerate** → `regenerateTerm` action
     - **Delete from DB** → `deleteTerm` action (clears store on success)
     - **Add to Notion** → `addToNotion` action (stubbed if Phase 5 not done)
   - "Add to Notion" disabled if `notion_page_id` set

**Parallelizable**: Depends on Phases 2 and 3.

---

### Phase 5 — Notion Integration (Server Action)

**Goal**: Push a term as a new page into a Notion database.

**Tasks**:
1. Install `@notionhq/client`
2. Add `.env.local`: `NOTION_API_KEY`, `NOTION_DATABASE_ID`
3. Create `lib/notion.ts` — typed helper to create a Notion page
4. Notion page fields:
   - `Name` (title)
   - `Content` (rich text)
   - `Categories` (multi-select)
5. Create `actions/notion.ts` — `addToNotion` server action:
   - Creates Notion page
   - Updates `notion_page_id` in local DB
   - Invalidates relevant TanStack Query keys via `revalidatePath`

**Parallelizable**: Depends on Phase 1 schema only.

---

### Phase 6 — Terms Page

**Goal**: `/terms` page to browse, search, filter, and manage all saved terms.

**Tasks**:
1. `app/terms/page.tsx` — Server Component; calls `getAllTerms` directly, passes result as `initialData`
2. `components/TermsTable.tsx` — Client Component:
   - **TanStack Query** `useQuery` with `initialData` from server
   - **TanStack Table** with:
     - Global fuzzy filter (using `fuse.js` as filter function)
     - Category column filter (multi-select from known category list)
     - Sorting on name and date columns
3. Table row actions (each a `useMutation`):
   - **Delete** → `deleteTerm` action, invalidates query on success
   - **Add to Notion** → `addToNotion` action, disabled if already added
4. Navigation link between home and terms pages

**Parallelizable**: Depends on Phases 1 and 3.

---

## Dependency Map

```
Phase 1 (DB helpers)
  └── Phase 2 (OpenAI + term actions)

Phase 3 (TanStack setup)
  ├── Phase 4 (Home UI) — needs Phases 2 + 3
  ├── Phase 5 (Notion action) — needs Phase 1
  └── Phase 6 (Terms page) — needs Phases 1 + 3
```

## Parallel Execution Strategy

| Instance | Phase | Prerequisite |
|----------|-------|--------------|
| A | Phase 1 — DB layer | none |
| B | Phase 2 — OpenAI + actions | Phase 1 done |
| C | Phase 3 — TanStack setup | none (parallel with A) |
| D | Phase 4 — Home UI | Phases 2 + 3 done |
| E | Phase 5 — Notion action | Phase 1 done |
| F | Phase 6 — Terms page | Phases 1 + 3 done |

---

## Environment Variables

```
OPENAI_API_KEY=
NOTION_API_KEY=
NOTION_DATABASE_ID=
```

## Notes

- Notion database fields must be confirmed before starting Phase 5.
- Term names are normalized (trimmed, lowercased) for cache lookup.
- `categories` stored as JSON string in SQLite, typed as `string[]` in app code.
- TanStack Query keys are invalidated (not just revalidated) after mutations so the terms list stays fresh.
- TanStack Store holds ephemeral UI state (current result); TanStack Query owns server state.
