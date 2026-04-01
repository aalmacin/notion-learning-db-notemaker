# Feynman Method Implementation Plan

## Overview

Add a Term detail page at `/terms/[id]` that supports the Feynman technique:
1. User explains concept from memory (pre-refinement)
2. User researches (done offline)
3. User explains again with research (refinement)
4. AI evaluates accuracy and generates formatted notes
5. User stores to Notion when satisfied

---

## 1. Database Changes (`lib/db.ts`)

Add `concept_refinements` table. Each row is one complete attempt — pre-refinement through refinement. Starting a new attempt inserts a new row; old rows are kept as history.

```sql
CREATE TABLE IF NOT EXISTS concept_refinements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  pre_refinement TEXT NOT NULL,
  pre_refinement_accuracy INTEGER,
  pre_refinement_review TEXT,
  refinement TEXT,
  refinement_accuracy INTEGER,
  refinement_review TEXT,
  refinement_formatted_note TEXT,
  refinement_additional_note TEXT,
  created_at TEXT NOT NULL
)
```

`pre_refinement` is `NOT NULL` — a row cannot exist without it.

New TypeScript types:
```typescript
type ConceptRefinement = {
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
```

New DB functions:
- `getRefinementsByTermId(termId)` → `ConceptRefinement[]` (ordered newest first)
- `getLatestRefinementByTermId(termId)` → `ConceptRefinement | undefined`
- `createRefinement(termId, preRefinement)` → `ConceptRefinement` — inserts a new attempt row
- `updatePreRefinementResult(id, data)` — sets pre_refinement_accuracy, pre_refinement_review
- `updateRefinement(id, data)` — sets refinement fields
- `deleteRefinement(id)`

---

## 2. AI Integration (`lib/openai.ts`)

Two new functions using the existing OpenAI client:

**`evaluatePreRefinement(termName, userExplanation)`**
- System prompt: evaluate the user's cold explanation for accuracy
- Returns: `{ accuracy: number, review: string, refinedExplanation: string }`

**`evaluateRefinement(termName, userExplanation)`**
- System prompt: evaluate post-research explanation, generate formatted notes
- Returns:
  ```typescript
  {
    accuracy: number;
    review: string;
    formattedNote: string;   // compact paragraph for physical notebook
    additionalNote: string;  // detailed digital-only notes
  }
  ```

Formatted note constraints (enforced in system prompt):
- 1 short paragraph (2 max if absolutely required)
- Precise definitions, no fluff, no long examples
- Optimized for fast rereading and recall

---

## 3. Server Actions (`actions/refinements.ts`)

```typescript
submitPreRefinement(termId, userExplanation)
// inserts a new ConceptRefinement row with the pre_refinement text,
// calls evaluatePreRefinement, saves accuracy + review, returns the row

submitRefinement(refinementId, userExplanation)
// updates the existing row's refinement fields,
// calls evaluateRefinement, saves result, returns updated ConceptRefinement

startNewAttempt(termId, userExplanation)
// inserts a fresh row (same as submitPreRefinement) — the previous row is preserved as history

addRefinementToNotion(termId, refinementId)
// 1. Fetches term; if notion_page_id is null, calls createNotionPage first
// 2. Calls appendRefinementToNotionPage — appends blocks, sets Daily Learning Done, Date, Priority
// 3. updates notion_page_id on the term if it was just created

deleteRefinement(id)
```

---

## 4. Notion Integration Update (`lib/notion.ts`)

Add a new function `appendRefinementToNotionPage(pageId, refinement, termName, date)`.

**Do not touch `createNotionPage`** — it handles the initial term creation and must not be changed.

### Page property updates (on the existing page)

When refinement is added to Notion, update the page's properties:
- `Daily Learning Done` (checkbox) → `true`
- `Date` (date) → today's ISO date (`YYYY-MM-DD`)
- `Priority` (select) → `"High"`

Use `client.pages.update({ page_id, properties: { ... } })`.

### Block structure to append

Call `client.blocks.children.append({ block_id: pageId, children: [...] })` with the following blocks in order:

```
H1: "{Term Name} ({Month Day, Year})"       e.g. "Kafka Partitions (Apr 1, 2026)"

H2: "Own Words"
Paragraph: {refinement text — user's post-research explanation}

H2: "Formatted"
Paragraph(s): {refinement_formatted_note}

H2: "Additional Notes (digital reference)"
{parse refinement_additional_note into paragraphs and bullet lists}
```

The "Additional Notes" section contains mixed content (bold headings, bullet lists). The AI will be instructed to return `additionalNote` as structured markdown so it can be parsed into Notion blocks:
- Lines starting with `- ` → bulleted list items
- Lines that are bold (`**text**`) → paragraph with bold annotation
- Other lines → plain paragraphs

### Guard: ensure page exists first

Before appending, check that `term.notion_page_id` is set. If it is not, call `createNotionPage` first to create it, then append. This prevents orphaned refinements from failing silently.

---

## 5. New Route: Term Detail Page

**File:** `app/terms/[id]/page.tsx`

Server component that:
1. Fetches term by id (new `getTermById(id)` DB function needed)
2. Fetches existing refinement if any
3. Renders `TermDetailPage` client component

**File:** `components/TermDetailPage.tsx`

Client component layout:

```
[ ← Back to Terms ]

Term: {name}
Categories: {list}  Priority: {badge}
─────────────────────────────────────
{content}   [ Add to Notion ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feynman Method                Attempt #3 ▾  (history dropdown)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── Step 1: Pre-Refinement ──────────
[textarea: Explain the concept without looking anything up]
[ Submit ]

  → Accuracy: 74%
  → Review: {text}

── Step 2: Research ────────────────
  Do your research now (offline), then come back for Step 3.

── Step 3: Refinement ──────────────
[textarea: Explain again after researching]
[ Submit ]

  → Accuracy: 94%
  → Review: {text}
  → Formatted Note: {text}
  → Additional Notes: {text}
  [ Add to Notion ]   [ Start New Attempt ]
```

State progression:
- No attempts → show pre-refinement form only (Step 1)
- Pre-refinement submitted, awaiting refinement → show Step 1 result + Step 2 prompt + Step 3 form
- Refinement submitted → show full results + Notion button + "Start New Attempt" button
- "Start New Attempt" shows a new pre-refinement form; previous attempt is kept in history
- History dropdown lets the user browse past attempts (read-only)

---

## 6. TermsTable Update (`components/TermsTable.tsx`)

Add a link/button in each row to open `/terms/[id]`. Options:
- Clickable row or an icon button in the actions column
- "Open" button alongside existing Delete/Notion buttons

---

## 7. DB Function Addition (`lib/db.ts`)

Add `getTermById(id: number): Term | undefined` — currently only `getTerm(name)` exists.

---

## Implementation Order

1. `lib/db.ts` — add table DDL, `getTermById`, `ConceptRefinement` type, and CRUD functions
2. `lib/openai.ts` — add `evaluatePreRefinement` and `evaluateRefinement`
3. `actions/refinements.ts` — server actions wrapping AI + DB
4. `lib/notion.ts` — extend for refinement content
5. `app/terms/[id]/page.tsx` — server page
6. `components/TermDetailPage.tsx` — full client component with state machine
7. `components/TermsTable.tsx` — add "Open" link to each row

---

## Key Design Decisions

- **Multiple attempts, history preserved** — each attempt is a new row. Starting over never deletes previous rows; they are accessible via the history dropdown.
- **Pre-refinement is required** — `pre_refinement` is `NOT NULL` in the schema. Every attempt begins with the cold explanation before research. `createRefinement` takes the pre-refinement text as a required argument.
- **`submitPreRefinement` and `startNewAttempt` are the same operation** — both insert a new row. The distinction is only in the UI label (first vs. subsequent attempts).
- **Notion append, never overwrite** — `appendRefinementToNotionPage` only appends blocks and updates properties; it never replaces existing page content. The original term content added by `createNotionPage` stays intact.
- **Auto-create Notion page if missing** — `addRefinementToNotion` calls `createNotionPage` first if the term has no `notion_page_id`, then appends. This means the Notion button on the refinement always works regardless of whether the term was previously added.
- **Properties set on refinement submit** — `Daily Learning Done = true`, `Date = today`, `Priority = High` are set via `pages.update` when the refinement is pushed to Notion, not on initial page creation.
- **Notion button appears on the Term page too** — so users can add the original AI content to Notion from the detail page, not just the table.
- **No streaming** — accuracy evaluations are short; a single awaited response is fine.
- **Server actions with `revalidatePath`** — consistent with existing patterns; no new API routes needed.
