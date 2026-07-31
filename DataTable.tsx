"use client";

import { useMemo, useState } from "react";
import { DateRangePicker, DateRange, presetToRange } from "./DateRangePicker";
import { BulkAction, BulkActionBar, BulkCheckbox, useBulkSelection } from "./BulkActions";

// ---------------------------------------------------------------------------
// Generic data table: sorting, global search, date-range filter, pagination,
// selection, and bulk/per-row actions.
//
// Promoted out of barttech-next-template on 2026-07-31. Four repos
// (barttech-next-template, competition-engine, lead-engine, support-engine)
// carried byte-identical copies — promoted before they diverged rather than
// after, which is the only cheap moment to do it.
//
// Selection lives in useBulkSelection (./BulkActions) rather than here, because
// bulk selection is not a table feature: a card list needs the same behaviour
// without being forced into a <table>.
//
// BREAKING-CHANGE NOTE: selection is now keyed by a stable row id, not an array
// index. The old index-keyed version acted on the wrong rows whenever the list
// was re-sorted or revalidated between selecting and acting. Supply `getRowId`
// if your rows have no `id` field.
// ---------------------------------------------------------------------------

export type Column<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
};

export type DataTableProps<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  data: T[];
  /** Fields to include in the global text search. Defaults to all columns. */
  searchKeys?: (keyof T & string)[];
  /** Field containing the row's date value (ISO string, Date, or unix ms). */
  dateKey?: keyof T & string;
  emptyMessage?: string;
  defaultPageSize?: number;
  defaultPreset?: DateRange["preset"];
  /**
   * Stable identity for a row. Defaults to `row.id`. Required (as an explicit
   * prop) when rows have no `id` — selection keyed by index is a correctness
   * bug, not a shortcut.
   */
  getRowId?: (row: T) => string;
  /**
   * Named bulk actions. Each appears in the bar shown once rows are selected;
   * set `row: true` on an action to also render it as a per-row button.
   * Destructive actions confirm by default.
   */
  actions?: BulkAction<T>[];
  /**
   * Legacy convenience props, kept working so existing call sites do not
   * change. Each becomes an action with `row: true`, matching the original
   * behaviour (icon button on every row + entry in the bulk bar).
   */
  onEdit?: (rows: T[]) => void;
  onArchive?: (rows: T[]) => void;
  onDelete?: (rows: T[]) => void;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

function cls(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

function toDateStr(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const da = a instanceof Date ? a : new Date(a as string);
  const db = b instanceof Date ? b : new Date(b as string);
  if (!isNaN(da.getTime()) && !isNaN(db.getTime())) return da.getTime() - db.getTime();
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

// --- SVG icons (no external dependency) ---

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
export function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
export function IconArchive({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}
export function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function RowActionBtn({
  label,
  icon: Icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cls(
        "rounded p-1.5 text-xs transition-colors",
        danger
          ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
      )}
    >
      {Icon ? <Icon className="h-4 w-4" /> : label}
    </button>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchKeys,
  dateKey,
  emptyMessage = "No results.",
  defaultPageSize = 25,
  defaultPreset = "all",
  getRowId,
  actions,
  onEdit,
  onArchive,
  onDelete,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    preset: defaultPreset,
    ...presetToRange(defaultPreset),
  }));

  // Legacy props become actions so there is one code path, not two.
  const allActions: BulkAction<T>[] = useMemo(() => {
    const legacy: BulkAction<T>[] = [];
    if (onEdit) legacy.push({ key: "edit", label: "Edit", icon: IconEdit, row: true, run: onEdit });
    if (onArchive) legacy.push({ key: "archive", label: "Archive", icon: IconArchive, row: true, run: onArchive });
    // confirm:false preserves the original behaviour — the legacy onDelete
    // callers already run their own confirmation.
    if (onDelete) legacy.push({ key: "delete", label: "Delete", icon: IconTrash, danger: true, row: true, confirm: false, run: onDelete });
    return [...(actions ?? []), ...legacy];
  }, [actions, onEdit, onArchive, onDelete]);

  const hasActions = allActions.length > 0;
  const rowActions = allActions.filter((a) => a.row);

  const rowId = useMemo(
    () => getRowId ?? ((row: T) => String((row as { id?: unknown }).id ?? "")),
    [getRowId],
  );

  const effectiveSearchKeys = useMemo(
    () => searchKeys ?? columns.map((c) => c.key),
    [searchKeys, columns],
  );

  const filtered = useMemo(() => {
    let rows = data;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) =>
        effectiveSearchKeys.some((k) => {
          const v = row[k];
          return v != null && String(v).toLowerCase().includes(q);
        }),
      );
    }
    if (dateKey && (dateRange.from || dateRange.to)) {
      rows = rows.filter((row) => {
        const d = toDateStr(row[dateKey]);
        if (!d) return false;
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > dateRange.to) return false;
        return true;
      });
    }
    return rows;
  }, [data, search, effectiveSearchKeys, dateKey, dateRange]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = compareValues(a[sort.key], b[sort.key]);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Select-all applies to the current page; the reset key is the filter set, so
  // changing search or dates can never leave a stale selection armed.
  const selection = useBulkSelection(
    pageItems,
    rowId,
    `${search}|${dateRange.from ?? ""}|${dateRange.to ?? ""}|${safePage}|${pageSize}`,
  );

  function toggleSort(key: string) {
    setPage(1);
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // third click = unsorted
    });
  }

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleDateRange(range: DateRange) { setDateRange(range); setPage(1); }

  const hasFilters = search.trim() || (dateKey && dateRange.preset !== "all");
  const totalCols = (hasActions ? 1 : 0) + columns.length + (rowActions.length ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-sm text-slate-700 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {search && (
              <button
                onClick={() => handleSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {dateKey && <DateRangePicker value={dateRange} onChange={handleDateRange} />}
        <span className="text-xs text-slate-500 sm:ml-auto whitespace-nowrap">
          {filtered.length === data.length
            ? `${data.length} rows`
            : `${filtered.length} of ${data.length} rows`}
        </span>
      </div>

      <BulkActionBar selection={selection} actions={allActions} />

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {hasActions && (
                <th scope="col" className="w-10 px-4 py-3">
                  <BulkCheckbox
                    inputRef={selection.headerRef}
                    checked={selection.allSelected}
                    onChange={selection.toggleAll}
                    label="Select all rows on this page"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cls(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500",
                    col.sortable && "cursor-pointer select-none hover:text-slate-900",
                  )}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="flex flex-col">
                        <ChevronUp
                          className={cls(
                            "h-2.5 w-2.5",
                            sort?.key === col.key && sort.dir === "asc" ? "text-slate-900" : "text-slate-300",
                          )}
                        />
                        <ChevronDown
                          className={cls(
                            "h-2.5 w-2.5 -mt-0.5",
                            sort?.key === col.key && sort.dir === "desc" ? "text-slate-900" : "text-slate-300",
                          )}
                        />
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {rowActions.length > 0 && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-12 text-center text-sm text-slate-500">
                  {hasFilters ? "No results match your filters." : emptyMessage}
                </td>
              </tr>
            ) : (
              pageItems.map((row, i) => (
                <tr
                  key={rowId(row) || i}
                  className={cls(
                    "transition-colors",
                    selection.isSelected(row) ? "bg-blue-50/40" : "hover:bg-slate-50",
                  )}
                >
                  {hasActions && (
                    <td className="w-10 px-4 py-3">
                      <BulkCheckbox
                        checked={selection.isSelected(row)}
                        onChange={() => selection.toggle(row)}
                        label={`Select row ${i + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-slate-700">
                      {col.render ? col.render(row, i) : ((row[col.key] as React.ReactNode) ?? "—")}
                    </td>
                  ))}
                  {rowActions.length > 0 && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {rowActions.map((a) => (
                          <RowActionBtn
                            key={a.key}
                            label={a.label}
                            icon={a.icon}
                            danger={a.danger}
                            onClick={() => { void a.run([row]); }}
                          />
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — always visible */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500">
          Page {safePage} of {totalPages}
          {selection.count > 0 && (
            <span className="ml-2 font-medium text-slate-700">· {selection.count} selected</span>
          )}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            className="rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            aria-label="First page"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Prev
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cls(
                    "min-w-[2rem] rounded px-2 py-1.5 text-xs font-medium",
                    p === safePage ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <span className="px-1 text-xs text-slate-500 sm:hidden">{safePage}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Next
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            aria-label="Last page"
          >
            »
          </button>
        </div>

        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="self-start rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-900 sm:self-auto"
          aria-label="Rows per page"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      </div>
    </div>
  );
}
