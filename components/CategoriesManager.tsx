'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { addCategory, removeCategory } from '@/actions/categories';
import type { Category } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CategoriesManager({ initialData }: { initialData: Category[] }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState(false);

  const { data: categories = initialData } = useQuery({
    queryKey: queryKeys.categories.all(),
    queryFn: async () => initialData,
    initialData,
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => addCategory(name),
    onSuccess: (category) => {
      queryClient.setQueryData<Category[]>(queryKeys.categories.all(), (prev = []) =>
        [...prev, category].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewName('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeCategory(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Category[]>(queryKeys.categories.all(), (prev = []) =>
        prev.filter((c) => c.id !== id)
      );
      setRemoveSuccess(true);
      setTimeout(() => setRemoveSuccess(false), 3000);
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addMutation.mutate(newName.trim());
  };

  return (
    <div className="space-y-6">
      {removeSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400">Category removed successfully.</p>
      )}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name…"
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={addMutation.isPending || !newName.trim()}
        >
          {addMutation.isPending ? 'Adding…' : 'Add'}
        </Button>
      </form>

      {addMutation.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {addMutation.error instanceof Error ? addMutation.error.message : 'Failed to add category'}
        </p>
      )}

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {categories.length === 0 ? (
          <li className="px-4 py-6 text-sm text-center text-zinc-400 dark:text-zinc-600">
            No categories yet.
          </li>
        ) : (
          categories.map((cat) => {
            const isRemoving = removeMutation.isPending && removeMutation.variables === cat.id;
            const isConfirming = confirmingId === cat.id;
            return (
              <li key={cat.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{cat.name}</span>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/terms?category=${encodeURIComponent(cat.name)}`}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    View Terms
                  </Link>
                  {isConfirming ? (
                    <>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => { removeMutation.mutate(cat.id); setConfirmingId(null); }}
                        disabled={isRemoving}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => setConfirmingId(cat.id)}
                      disabled={isRemoving}
                    >
                      {isRemoving ? 'Removing…' : 'Remove'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
