"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Bulk selection primitive — layout-agnostic on purpose.
//
// DataTable owns its own table markup, but bulk selection is NOT a table
// feature: a spam queue rendered as cards needs exactly the same select /
// select-all / act-on-many behaviour. Putting the state machine in a hook and
// the bar in a standalone component means a card list gets it without being
// forced into a <table>, which is what would otherwise happen (and the body
// preview that makes a spam queue reviewable does not survive a table cell).
//
// Selection is keyed by a caller-supplied STABLE id, never an array index.
// Index-keyed selection silently acts on the wrong rows the moment the list is
// sorted, filtered, or revalidated underneath it — and a bulk action on the
// wrong rows is not a cosmetic bug.
// ---------------------------------------------------------------------------

export type BulkAction<T> = {
  /** Stable key — also used as the React key. */
  key: string;
  label: string;
  /** Optional icon component; no icon library is a dependency here. */
  icon?: React.ElementType;
  /** Renders in red and, unless `confirm` is set, gets a default confirmation. */
  danger?: boolean;
  /**
   * Confirmation prompt. `true` uses a sensible default message. A string is
   * used verbatim. Destructive actions get a confirmation whether or not this
   * is set — pass `false` to explicitly opt out.
   */
  confirm?: boolean | string | ((rows: T[]) => string);
  /** Hide the action for a particular selection (e.g. mixed brands). */
  available?: (rows: T[]) => boolean;
  /**
   * Also render this action as a per-row button in DataTable's actions column.
   * Off by default — a queue with six bulk actions does not want six buttons on
   * every row.
   */
  row?: boolean;
  run: (rows: T[]) => void | Promise<void>;
};

export type BulkSelection<T> = {
  selectedIds: Set<string>;
  selectedRows: T[];
  count: number;
  isSelected: (row: T) => boolean;
  toggle: (row: T) => void;
  clear: () => void;
  /** Select-all state for the CURRENT visible page/subset. */
  allSelected: boolean;
  someSelected: boolean;
  toggleAll: () => void;
  /** Ref for the header checkbox so `indeterminate` can be set imperatively. */
  headerRef: React.RefObject<HTMLInputElement | null>;
};

/**
 * Selection state over `rows`, keyed by `getId`.
 *
 * `resetKey` clears the selection when it changes — pass whatever identifies
 * the current filter/search so a bulk action can never apply to rows the user
 * can no longer see.
 */
export function useBulkSelection<T>(
  rows: T[],
  getId: (row: T) => string,
  resetKey?: string,
): BulkSelection<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const headerRef = useRef<HTMLInputElement | null>(null);

  // Clear on filter change during render rather than in an effect — setState in
  // an effect body costs a second render pass and trips
  // react-hooks/set-state-in-effect. React re-runs this component immediately,
  // before anything commits.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    if (selectedIds.size) setSelectedIds(new Set());
  }

  // Drop ids that have left the list (deleted, filtered out, revalidated away)
  // so `count` never claims more than is actually actionable.
  const visibleIds = useMemo(() => new Set(rows.map(getId)), [rows, getId]);
  const effectiveIds = useMemo(() => {
    const next = new Set<string>();
    selectedIds.forEach((id) => { if (visibleIds.has(id)) next.add(id); });
    return next;
  }, [selectedIds, visibleIds]);

  const selectedRows = useMemo(
    () => rows.filter((r) => effectiveIds.has(getId(r))),
    [rows, effectiveIds, getId],
  );

  const allSelected = rows.length > 0 && rows.every((r) => effectiveIds.has(getId(r)));
  const someSelected = !allSelected && rows.some((r) => effectiveIds.has(getId(r)));

  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return {
    selectedIds: effectiveIds,
    selectedRows,
    count: effectiveIds.size,
    isSelected: (row) => effectiveIds.has(getId(row)),
    toggle: (row) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const id = getId(row);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    clear: () => setSelectedIds(new Set()),
    allSelected,
    someSelected,
    toggleAll: () =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (allSelected) rows.forEach((r) => next.delete(getId(r)));
        else rows.forEach((r) => next.add(getId(r)));
        return next;
      }),
    headerRef,
  };
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function resolveConfirm<T>(action: BulkAction<T>, rows: T[]): string | null {
  const n = rows.length;
  const noun = n === 1 ? "item" : "items";
  if (typeof action.confirm === "function") return action.confirm(rows);
  if (typeof action.confirm === "string") return action.confirm;
  if (action.confirm === true) return `${action.label} ${n} ${noun}?`;
  if (action.confirm === false) return null;
  // Destructive actions confirm by default — an unconfirmed bulk delete is the
  // single easiest way to lose a queue.
  if (action.danger) return `${action.label} ${n} ${noun}? This cannot be undone.`;
  return null;
}

/** Checkbox styled consistently for row and header use. */
export function BulkCheckbox({
  checked,
  onChange,
  label,
  inputRef,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900"
    />
  );
}

/**
 * The dark bar that appears once anything is selected. Renders nothing at zero
 * selection, so it can be mounted unconditionally.
 *
 * Actions run one at a time with the bar disabled — a double-click on "Delete"
 * firing two server actions against the same rows is a real hazard, not a
 * theoretical one.
 */
export function BulkActionBar<T>({
  selection,
  actions,
  className,
}: {
  selection: BulkSelection<T>;
  actions: BulkAction<T>[];
  className?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const { count, selectedRows, clear } = selection;

  if (count === 0) return null;

  const visible = actions.filter((a) => !a.available || a.available(selectedRows));

  async function run(action: BulkAction<T>) {
    if (busy) return;
    const message = resolveConfirm(action, selectedRows);
    if (message && !window.confirm(message)) return;
    setBusy(action.key);
    try {
      await action.run(selectedRows);
      clear();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      role="region"
      aria-label={`${count} selected`}
      className={
        className ??
        "sticky top-2 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-slate-900 px-4 py-2.5 text-white shadow-lg"
      }
    >
      <span className="text-sm font-medium">
        {count} selected
      </span>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {visible.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              disabled={!!busy}
              onClick={() => run(a)}
              className={[
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50",
                a.danger ? "bg-red-600/80 hover:bg-red-600" : "bg-white/10 hover:bg-white/20",
              ].join(" ")}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {busy === a.key ? "Working…" : a.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={clear}
          disabled={!!busy}
          aria-label="Clear selection"
          className="ml-1 rounded p-1 text-white/60 transition-colors hover:text-white disabled:opacity-50"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
