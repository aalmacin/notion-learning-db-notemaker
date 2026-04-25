'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import type { ReviewItem } from '@/lib/db';
import { getReviewData } from '@/actions/review';

type MonthOption = { year: number; month: number };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

function monthLabel(m: MonthOption): string {
  return `${MONTH_NAMES[m.month - 1]} ${m.year}`;
}

function groupByDate(items: ReviewItem[]): { date: string; items: ReviewItem[] }[] {
  const map = new Map<string, ReviewItem[]>();
  for (const item of items) {
    if (!map.has(item.notion_date)) map.set(item.notion_date, []);
    map.get(item.notion_date)!.push(item);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

export function ReviewPage({
  availableMonths,
  initialData,
  initialYear,
  initialMonth,
}: {
  availableMonths: MonthOption[];
  initialData: ReviewItem[];
  initialYear: number;
  initialMonth: number;
}) {
  const [data, setData] = useState(initialData);
  const [selectedKey, setSelectedKey] = useState(`${initialYear}-${initialMonth}`);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  function handleMonthChange(key: string) {
    setSelectedKey(key);
    setOpenDays(new Set());
    const [y, m] = key.split('-').map(Number);
    startTransition(async () => {
      const result = await getReviewData(y, m);
      setData(result);
    });
  }

  const filtered = search
    ? data.filter(
        (item) =>
          item.term_name.toLowerCase().includes(search.toLowerCase()) ||
          (item.notion_content?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : data;

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  function toggleDay(date: string) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={selectedKey}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
        >
          {availableMonths.map((m) => (
            <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search concepts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 flex-1"
        />
      </div>

      {isPending && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Loading...</p>
      )}

      {!isPending && filtered.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No explained concepts found for this month.</p>
      )}

      <div className="space-y-3">
        {grouped.map(({ date, items }) => (
          <div key={date} className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleDay(date)}
              className="w-full flex items-start gap-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-left"
            >
              <span className="text-zinc-400 dark:text-zinc-500 text-sm mt-0.5 flex-shrink-0">
                {openDays.has(date) ? '▼' : '▶'}
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatDate(date)}
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {items.map((item) => (
                    <span key={item.term_id} className="flex items-center gap-1">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.term_name}</span>
                      {item.categories.map((cat) => (
                        <span key={cat} className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded px-1.5 py-0.5">
                          {cat}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            </button>

            {openDays.has(date) && (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((item) => (
                  <div key={item.term_id} className="px-4 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{item.term_name}</h3>
                      <Link
                        href={`/terms/${item.term_id}`}
                        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                      >
                        View →
                      </Link>
                    </div>
                    {item.notion_content ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
                        <Markdown>{item.notion_content}</Markdown>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">Content not synced yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
