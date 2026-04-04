'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
  type ExpandedState,
  type PaginationState,
} from '@tanstack/react-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { deleteTerm, updateTermPriority } from '@/actions/terms';
import { addToNotion } from '@/actions/notion';
import { updateTermCategories } from '@/actions/categories';
import type { Term, Category, Priority } from '@/lib/db';

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];

const columnHelper = createColumnHelper<Term>();

const globalFilterFn: FilterFn<Term> = (row, _columnId, filterValue: string) => {
  const search = filterValue.toLowerCase();
  const name = row.original.name.toLowerCase();
  const categories = row.original.categories.join(' ').toLowerCase();
  return name.includes(search) || categories.includes(search);
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function CategoryEditor({ term, allCategories, onSaved }: {
  term: Term;
  allCategories: Category[];
  onSaved: (updated: Term) => void;
}) {
  const [selected, setSelected] = useState<string[]>(term.categories);

  const mutation = useMutation({
    mutationFn: () => updateTermCategories(term.id, selected),
    onSuccess: onSaved,
  });

  const toggle = (name: string) =>
    setSelected((prev) => prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]);

  return (
    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Categories</p>
      <div className="flex flex-wrap gap-2">
        {allCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => toggle(cat.name)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              selected.includes(cat.name)
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
      {mutation.error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to save'}
        </p>
      )}
      <Button size="xs" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save categories'}
      </Button>
    </div>
  );
}

function PriorityEditor({ term, onSaved }: { term: Term; onSaved: (updated: Term) => void }) {
  const [selected, setSelected] = useState<Priority>(term.priority);

  const mutation = useMutation({
    mutationFn: () => updateTermPriority(term.id, selected),
    onSuccess: onSaved,
  });

  return (
    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Priority</p>
      <div className="flex gap-4">
        {PRIORITIES.map((p) => (
          <label key={p} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`priority-${term.id}`}
              value={p}
              checked={selected === p}
              onChange={() => setSelected(p)}
              className="accent-primary"
            />
            <span className="text-xs text-zinc-700 dark:text-zinc-300">{p}</span>
          </label>
        ))}
      </div>
      {mutation.error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to save'}
        </p>
      )}
      <Button size="xs" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save priority'}
      </Button>
    </div>
  );
}

export function TermsTable({ initialData, initialCategories, initialCategory }: { initialData: Term[]; initialCategories: Category[]; initialCategory?: string }) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategory ? [initialCategory] : []);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [notionSuccessId, setNotionSuccessId] = useState<number | null>(null);
  const [notionFilter, setNotionFilter] = useState<'all' | 'pending' | 'added'>('pending');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const { data = initialData } = useQuery({
    queryKey: queryKeys.terms.all(),
    queryFn: async () => initialData,
    initialData,
  });

  const { data: allCategories = initialCategories } = useQuery({
    queryKey: queryKeys.categories.all(),
    queryFn: async () => initialCategories,
    initialData: initialCategories,
  });

  const filterCategoryNames = useMemo(() => {
    const set = new Set<string>();
    data.forEach((term) => term.categories.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((term) => {
      if (notionFilter === 'pending' && term.notion_page_id !== null) return false;
      if (notionFilter === 'added' && term.notion_page_id === null) return false;
      if (selectedCategories.length > 0 && !selectedCategories.every((cat) => term.categories.includes(cat))) return false;
      return true;
    });
  }, [data, selectedCategories, notionFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTerm(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Term[]>(queryKeys.terms.all(), (prev = []) =>
        prev.filter((t) => t.id !== id)
      );
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    },
  });

  const addToNotionMutation = useMutation({
    mutationFn: (term: Term) =>
      addToNotion(term.id, { name: term.name, content: term.content, categories: term.categories, priority: term.priority }),
    onSuccess: (updatedTerm, term) => {
      queryClient.setQueryData<Term[]>(queryKeys.terms.all(), (prev = []) =>
        prev.map((t) => (t.id === term.id ? updatedTerm : t))
      );
      setNotionSuccessId(term.id);
      setTimeout(() => setNotionSuccessId(null), 3000);
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'expand',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={row.getToggleExpandedHandler()}
            aria-label={row.getIsExpanded() ? 'Collapse' : 'Expand'}
          >
            {row.getIsExpanded() ? '▾' : '▸'}
          </Button>
        ),
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        enableSorting: true,
        cell: (info) => (
          <span className="font-medium text-zinc-900 dark:text-zinc-50">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('categories', {
        header: 'Categories',
        enableSorting: false,
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((cat) => (
              <Badge key={cat} variant="secondary">{cat}</Badge>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Created',
        enableSorting: true,
        cell: (info) =>
          new Date(info.getValue()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
      }),
      columnHelper.accessor('priority', {
        header: 'Priority',
        enableSorting: true,
        cell: (info) => {
          const val = info.getValue();
          const color =
            val === 'High'
              ? 'text-red-600 dark:text-red-400'
              : val === 'Low'
                ? 'text-zinc-400 dark:text-zinc-500'
                : 'text-yellow-600 dark:text-yellow-400';
          return <span className={`text-xs font-medium ${color}`}>{val}</span>;
        },
      }),
      columnHelper.accessor('explained', {
        header: 'Explained',
        enableSorting: true,
        cell: (info) => (
          <span className={info.getValue() ? 'text-green-600' : 'text-zinc-400'}>
            {info.getValue() ? '✓' : '—'}
          </span>
        ),
      }),
      columnHelper.accessor('notion_page_id', {
        header: 'Notion',
        enableSorting: false,
        cell: (info) => (
          <span className={info.getValue() ? 'text-green-600' : 'text-zinc-400'}>
            {info.getValue() ? '✓' : '—'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const term = row.original;
          const isDeleting = deleteMutation.isPending && deleteMutation.variables === term.id;
          const isAddingToNotion =
            addToNotionMutation.isPending && addToNotionMutation.variables?.id === term.id;
          const isNotionSuccess = notionSuccessId === term.id;
          const isConfirmingDelete = confirmingDeleteId === term.id;

          return (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Link
                  href={`/terms/${term.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(buttonVariants({ variant: 'secondary', size: 'xs' }))}
                >
                  Open
                </Link>
                {isConfirmingDelete ? (
                  <>
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => { deleteMutation.mutate(term.id); setConfirmingDeleteId(null); }}
                      disabled={isDeleting}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => setConfirmingDeleteId(term.id)}
                    disabled={isDeleting}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => addToNotionMutation.mutate(term)}
                  disabled={term.notion_page_id !== null || isAddingToNotion}
                >
                  {isAddingToNotion ? 'Adding…' : 'Add to Notion'}
                </Button>
              </div>
              {isNotionSuccess && (
                <p className="text-xs text-green-600 dark:text-green-400">Added to Notion.</p>
              )}
            </div>
          );
        },
      }),
    ],
    [deleteMutation, addToNotionMutation, notionSuccessId, confirmingDeleteId, setConfirmingDeleteId]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter, columnFilters, expanded, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: (val) => {
      setPagination((p) => ({ ...p, pageIndex: 0 }));
      setGlobalFilter(val);
    },
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: () => true,
  });

  const toggleCategory = (cat: string) => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const totalFiltered = table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-4">
      {deleteSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400">Term deleted successfully.</p>
      )}
      <div className="flex flex-wrap gap-4 items-start">
        <Input
          type="text"
          placeholder="Search terms…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          {(['pending', 'all', 'added'] as const).map((val) => (
            <button
              key={val}
              onClick={() => { setNotionFilter(val); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                notionFilter === val
                  ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {val === 'pending' ? 'Not on Notion' : val === 'added' ? 'On Notion' : 'All'}
            </button>
          ))}
        </div>
        {filterCategoryNames.length > 0 && (
          <Popover>
            <PopoverTrigger className="flex items-center gap-2 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <span>Categories</span>
              {selectedCategories.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {selectedCategories.length}
                </Badge>
              )}
              <span className="text-zinc-400 text-xs">▾</span>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search categories…" />
                <CommandList>
                  <CommandEmpty>No categories found.</CommandEmpty>
                  <CommandGroup>
                    {filterCategoryNames.map((cat) => (
                      <CommandItem
                        key={cat}
                        onSelect={() => toggleCategory(cat)}
                        data-checked={selectedCategories.includes(cat)}
                      >
                        {cat}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                {selectedCategories.length > 0 && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => { setSelectedCategories([]); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Mobile card view */}
      <div className="block sm:hidden rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-black">
        {table.getRowModel().rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-600">No terms found.</p>
        ) : (
          table.getRowModel().rows.map((row) => {
            const term = row.original;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === term.id;
            const isAddingToNotion = addToNotionMutation.isPending && addToNotionMutation.variables?.id === term.id;
            const isNotionSuccess = notionSuccessId === term.id;
            const isConfirmingDelete = confirmingDeleteId === term.id;
            const priorityColor =
              term.priority === 'High'
                ? 'text-red-600 dark:text-red-400'
                : term.priority === 'Low'
                  ? 'text-zinc-400 dark:text-zinc-500'
                  : 'text-yellow-600 dark:text-yellow-400';

            return (
              <div key={row.id}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  onClick={row.getToggleExpandedHandler()}
                >
                  <button
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors w-4 text-center flex-shrink-0"
                    aria-label={row.getIsExpanded() ? 'Collapse' : 'Expand'}
                  >
                    {row.getIsExpanded() ? '▾' : '▸'}
                  </button>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50 flex-1 min-w-0 truncate">{term.name}</span>
                  <span className={`text-xs font-medium flex-shrink-0 ${priorityColor}`}>{term.priority}</span>
                </div>

                {term.categories.length > 0 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                    {term.categories.map((cat) => (
                      <Badge key={cat} variant="secondary">{cat}</Badge>
                    ))}
                  </div>
                )}

                <div className="px-4 pb-3 flex flex-wrap gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/terms/${term.id}`}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'xs' }))}
                  >
                    Open
                  </Link>
                  {isConfirmingDelete ? (
                    <>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => { deleteMutation.mutate(term.id); setConfirmingDeleteId(null); }}
                        disabled={isDeleting}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => setConfirmingDeleteId(term.id)}
                      disabled={isDeleting}
                    >
                      Delete
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => addToNotionMutation.mutate(term)}
                    disabled={term.notion_page_id !== null || isAddingToNotion}
                  >
                    {isAddingToNotion ? 'Adding…' : 'Add to Notion'}
                  </Button>
                  {isNotionSuccess && <p className="text-xs text-green-600 dark:text-green-400">Added to Notion.</p>}
                </div>

                {row.getIsExpanded() && (
                  <div className="px-4 py-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{term.content}</p>
                    <CategoryEditor
                      term={term}
                      allCategories={allCategories}
                      onSaved={(updated) =>
                        queryClient.setQueryData<Term[]>(queryKeys.terms.all(), (prev = []) =>
                          prev.map((t) => (t.id === updated.id ? updated : t))
                        )
                      }
                    />
                    <PriorityEditor
                      term={term}
                      onSaved={(updated) =>
                        queryClient.setQueryData<Term[]>(queryKeys.terms.all(), (prev = []) =>
                          prev.map((t) => (t.id === updated.id ? updated : t))
                        )
                      }
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
                  >
                    {header.column.getCanSort() ? (
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-zinc-300 dark:text-zinc-600">
                          {header.column.getIsSorted() === 'asc'
                            ? '↑'
                            : header.column.getIsSorted() === 'desc'
                              ? '↓'
                              : '↕'}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-black">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-600"
                >
                  No terms found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    onClick={row.getToggleExpandedHandler()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 text-zinc-700 dark:text-zinc-300"
                        onClick={
                          cell.column.id === 'actions'
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr className="bg-zinc-50 dark:bg-zinc-950">
                      <td colSpan={columns.length} className="px-6 py-4">
                        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                          {row.original.content}
                        </p>
                        <CategoryEditor
                          term={row.original}
                          allCategories={allCategories}
                          onSaved={(updated) =>
                            queryClient.setQueryData<Term[]>(queryKeys.terms.all(), (prev = []) =>
                              prev.map((t) => (t.id === updated.id ? updated : t))
                            )
                          }
                        />
                        <PriorityEditor
                          term={row.original}
                          onSaved={(updated) =>
                            queryClient.setQueryData<Term[]>(queryKeys.terms.all(), (prev = []) =>
                              prev.map((t) => (t.id === updated.id ? updated : t))
                            )
                          }
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          {totalFiltered === data.length
            ? `${data.length} term${data.length !== 1 ? 's' : ''}`
            : `${totalFiltered} of ${data.length} term${data.length !== 1 ? 's' : ''}`}
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">Per page</label>
            <select
              value={pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
                table.setPageIndex(0);
              }}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ‹
            </Button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 px-2">
              {pageCount === 0 ? '0 / 0' : `${pageIndex + 1} / ${pageCount}`}
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              ›
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
            >
              »
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
