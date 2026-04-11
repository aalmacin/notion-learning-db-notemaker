'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveNotionDatabaseId, disconnectNotion, createNotionDataSource } from '@/actions/settings';

type Database = { id: string; title: string };

type Props = {
  isConnected: boolean;
  databases: Database[];
  currentDatabaseId: string | null;
};

export function NotionConnect({ isConnected, databases, currentDatabaseId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const currentDatabase = databases.find((db) => db.id === currentDatabaseId);

  function handleSelectDatabase(id: string) {
    startTransition(async () => {
      await saveNotionDatabaseId(id);
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectNotion();
    });
  }

  function handleCreateDataSource() {
    startTransition(async () => {
      await createNotionDataSource();
      router.refresh();
    });
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Connect your Notion workspace to export terms and refinements.
        </p>
        <a
          href="/api/notion/auth"
          className="inline-flex w-fit items-center gap-2 rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          Connect with Notion
        </a>
      </div>
    );
  }

  if (!currentDatabaseId) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-green-700 dark:text-green-400">✓ Connected</span>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Select a database to use:</p>
        <button
          onClick={handleCreateDataSource}
          disabled={isPending}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Creating...' : 'Create data source'}
        </button>
        {databases.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No databases found. Make sure you granted access to at least one database during the
            Notion authorization.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {databases.map((db) => (
              <li key={db.id}>
                <button
                  onClick={() => handleSelectDatabase(db.id)}
                  disabled={isPending}
                  className="w-full text-left rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors disabled:opacity-50"
                >
                  {db.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-green-700 dark:text-green-400">✓ Connected</span>
      </div>
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Database</p>
          <p className="text-sm text-zinc-900 dark:text-zinc-50">
            {currentDatabase?.title ?? 'Unknown database'}
          </p>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={isPending}
          className="shrink-0 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      <button
        onClick={handleCreateDataSource}
        disabled={isPending}
        className="inline-flex w-fit items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create data source'}
      </button>
    </div>
  );
}
