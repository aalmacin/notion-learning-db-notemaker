'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Term, ConceptRefinement } from '@/lib/db';
import {
  submitPreRefinement,
  submitRefinement,
  addRefinementToNotion,
} from '@/actions/refinements';

type Props = {
  term: Term;
  initialRefinements: ConceptRefinement[];
};

type ViewMode = { type: 'form' } | { type: 'attempt'; index: number };

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'text-green-600 dark:text-green-400';
  if (accuracy >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200">
        {n}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

export function TermDetailPage({ term, initialRefinements }: Props) {
  const router = useRouter();
  const [refinements, setRefinements] = useState(initialRefinements);
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialRefinements.length === 0 ? { type: 'form' } : { type: 'attempt', index: 0 },
  );
  const [preText, setPreText] = useState('');
  const [refinementText, setRefinementText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notionDone, setNotionDone] = useState(false);

  const [isPendingPre, startPre] = useTransition();
  const [isPendingRefinement, startRefinement] = useTransition();
  const [isPendingNotion, startNotion] = useTransition();

  const viewing = viewMode.type === 'attempt' ? (refinements[viewMode.index] ?? null) : null;
  const isLatest = viewMode.type === 'attempt' && viewMode.index === 0;
  const latest = refinements[0] ?? null;

  const isComplete = (r: ConceptRefinement) => r.refinement_formatted_note !== null;
  const isAwaitingRefinement = (r: ConceptRefinement) =>
    r.pre_refinement_accuracy !== null && r.refinement_formatted_note === null;

  const handleSubmitPre = () => {
    if (!preText.trim()) return;
    setError(null);
    startPre(async () => {
      try {
        const result = await submitPreRefinement(term.id, preText.trim());
        setRefinements((prev) => [result, ...prev]);
        setViewMode({ type: 'attempt', index: 0 });
        setPreText('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit');
      }
    });
  };

  const handleSubmitRefinement = () => {
    if (!refinementText.trim() || !latest) return;
    setError(null);
    startRefinement(async () => {
      try {
        const result = await submitRefinement(latest.id, term.id, refinementText.trim());
        setRefinements((prev) => [result, ...prev.slice(1)]);
        setRefinementText('');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit');
      }
    });
  };

  const handleAddToNotion = (refinementId: number) => {
    setError(null);
    setNotionDone(false);
    startNotion(async () => {
      try {
        await addRefinementToNotion(term.id, refinementId);
        setNotionDone(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add to Notion');
      }
    });
  };

  const handleStartNewAttempt = () => {
    setViewMode({ type: 'form' });
    setPreText('');
    setError(null);
    setNotionDone(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/terms"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Terms
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{term.name}</h1>
        </div>

        {/* Term card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {term.categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                {cat}
              </span>
            ))}
            <span
              className={`ml-auto text-xs font-medium ${
                term.priority === 'High'
                  ? 'text-red-600 dark:text-red-400'
                  : term.priority === 'Low'
                    ? 'text-zinc-400 dark:text-zinc-500'
                    : 'text-yellow-600 dark:text-yellow-400'
              }`}
            >
              {term.priority}
            </span>
          </div>
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{term.content}</p>
        </div>

        {/* Feynman Method */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-6">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Feynman Method
            </h2>
            {refinements.length > 0 && viewMode.type === 'attempt' && (
              <select
                value={viewMode.index}
                onChange={(e) => setViewMode({ type: 'attempt', index: Number(e.target.value) })}
                className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none"
              >
                {refinements.map((_, i) => (
                  <option key={i} value={i}>
                    {i === 0
                      ? `Attempt ${refinements.length} (latest)`
                      : `Attempt ${refinements.length - i}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 1 — Pre-refinement form */}
          {viewMode.type === 'form' && (
            <div className="space-y-3">
              <StepLabel n={1} label="Cold Explanation" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Explain <strong>{term.name}</strong> without looking anything up.
              </p>
              <textarea
                value={preText}
                onChange={(e) => setPreText(e.target.value)}
                rows={5}
                placeholder="Write everything you know about this concept…"
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 resize-none"
              />
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              )}
              <button
                onClick={handleSubmitPre}
                disabled={!preText.trim() || isPendingPre}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPendingPre ? 'Evaluating…' : 'Submit'}
              </button>
            </div>
          )}

          {/* Attempt view */}
          {viewMode.type === 'attempt' && viewing && (
            <div className="space-y-6">
              {/* Step 1 result */}
              <div className="space-y-3">
                <StepLabel n={1} label="Cold Explanation" />
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 space-y-3">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-6">
                    {viewing.pre_refinement}
                  </p>
                  {viewing.pre_refinement_accuracy !== null && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
                      <p className={`text-sm font-semibold ${accuracyColor(viewing.pre_refinement_accuracy)}`}>
                        Accuracy: {viewing.pre_refinement_accuracy}%
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-5">
                        {viewing.pre_refinement_review}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 — Research prompt (only shown when step 1 done but not step 3) */}
              {viewing.pre_refinement_accuracy !== null && !isComplete(viewing) && (
                <div className="space-y-2">
                  <StepLabel n={2} label="Research" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Do your research now, then come back to explain the concept again.
                  </p>
                </div>
              )}

              {/* Step 3 — Refinement */}
              {viewing.pre_refinement_accuracy !== null && (
                <div className="space-y-3">
                  <StepLabel n={3} label="Refined Explanation" />

                  {/* Form — only on latest incomplete attempt */}
                  {isLatest && isAwaitingRefinement(viewing) && (
                    <>
                      <textarea
                        value={refinementText}
                        onChange={(e) => setRefinementText(e.target.value)}
                        rows={5}
                        placeholder="Explain the concept again after researching…"
                        className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 resize-none"
                      />
                      {error && (
                        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                      )}
                      <button
                        onClick={handleSubmitRefinement}
                        disabled={!refinementText.trim() || isPendingRefinement}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isPendingRefinement ? 'Evaluating…' : 'Submit'}
                      </button>
                    </>
                  )}

                  {/* Results */}
                  {isComplete(viewing) && (
                    <div className="space-y-5">
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 space-y-3">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-6">
                          {viewing.refinement}
                        </p>
                        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
                          <p className={`text-sm font-semibold ${accuracyColor(viewing.refinement_accuracy!)}`}>
                            Accuracy: {viewing.refinement_accuracy}%
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-5">
                            {viewing.refinement_review}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Formatted Note
                        </p>
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-6 whitespace-pre-wrap">
                            {viewing.refinement_formatted_note}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Additional Notes
                        </p>
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-6 whitespace-pre-wrap">
                            {viewing.refinement_additional_note}
                          </p>
                        </div>
                      </div>

                      {/* Actions — only on latest */}
                      {isLatest && (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            onClick={() => handleAddToNotion(viewing.id)}
                            disabled={isPendingNotion || notionDone}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {isPendingNotion ? 'Adding…' : notionDone ? 'Added to Notion ✓' : 'Add to Notion'}
                          </button>
                          <button
                            onClick={handleStartNewAttempt}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            Start New Attempt
                          </button>
                          {error && (
                            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
