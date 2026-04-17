'use client';

import { useState, useTransition } from 'react';
import { saveTimezone } from '@/actions/settings';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export function TimezoneSelect({ currentTimezone }: { currentTimezone: string }) {
  const [value, setValue] = useState(currentTimezone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (tz: string) => {
    setValue(tz);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await saveTimezone(tz);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save timezone');
      }
    });
  };

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 disabled:opacity-50"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      {saved && <p className="text-xs text-green-600 dark:text-green-400">Timezone saved.</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
