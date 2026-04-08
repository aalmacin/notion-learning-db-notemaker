import Link from 'next/link';
import { signOut } from '@/actions/auth';
import { getNotionSettings } from '@/actions/settings';
import { getNotionDatabases } from '@/lib/notion';
import { NotionConnect } from '@/components/NotionConnect';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const settings = await getNotionSettings();

  const isConnected = !!settings?.notion_api_key;
  let databases: { id: string; title: string }[] = [];

  if (isConnected) {
    try {
      databases = await getNotionDatabases(settings.notion_api_key!);
    } catch {
      // Token may be invalid; treat as disconnected
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              ← Home
            </Link>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              {error === 'notion_auth_failed'
                ? 'Notion authorization was denied or failed. Please try again.'
                : 'Failed to get a Notion access token. Please try again.'}
            </p>
          </div>
        )}
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Notion</h2>
          <NotionConnect
            isConnected={isConnected}
            databases={databases}
            currentDatabaseId={settings?.notion_database_id ?? null}
          />
        </section>
      </main>
    </div>
  );
}
