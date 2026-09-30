"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

/**
 * SwipeRow — a phone list row that slides sideways to reveal action buttons
 * (the Dext-style "swipe to publish / delete" pattern). Brand-neutral and
 * presentation-only: it decides how a row moves and what the buttons look like,
 * never what an action DOES. Each action's `onAction` is the caller's existing
 * server action / handler.
 *
 * Behaviour (all of it is the contract — do not re-implement locally):
 * - Touch and pen only. A mouse never drags; desktop gets hover buttons via
 *   `<SwipeHoverActions>` instead.
 * - Vertical scroll stays with the browser (`touch-action: pan-y`); the drag
 *   only starts once the finger has moved further sideways than up/down.
 * - A drag never counts as a tap: the click that follows it is swallowed, and a
 *   tap on an open row just closes it.
 * - Only one row is open at a time: `openSide` is owned by the parent, see
 *   `useSwipeOpen()`.
 * - Every revealed button is at least 44px wide (default 76) and the full row
 *   height. Movement honours `prefers-reduced-motion` (no slide animation; the
 *   row still snaps open/closed).
 * - An action with `confirm` asks `window.confirm(confirm)` first. Use it for
 *   anything destructive or that moves money — see README "SwipeRow".
 * - Choosing an action closes the row, then runs `onAction`.
 *
 * Swipe LEFT reveals `rightActions` (they sit at the right edge); swipe RIGHT
 * reveals `leftActions` (left edge). The usual split is: right-swipe = the one
 * positive shortcut (approve/publish), left-swipe = the full set.
 */
export type SwipeSide = "left" | "right" | null;

/** Colour meaning. approve = green, reject = amber, danger = red, restore = slate. */
export type SwipeTone = "approve" | "reject" | "danger" | "restore" | "neutral";

export type SwipeAction = {
  /** Stable key within the row. */
  key: string;
  /** Visible label AND accessible name. */
  label: string;
  /** Optional icon element (the package ships no icon library) — size it h-5 w-5. */
  icon?: ReactNode;
  tone: SwipeTone;
  /** If set, `window.confirm(confirm)` must be accepted before `onAction` runs. */
  confirm?: string;
  onAction: () => void;
};

/** Panel-button (revealed by the swipe) classes per tone. */
const TONE_PANEL: Record<SwipeTone, string> = {
  approve: "bg-emerald-600",
  reject: "bg-amber-500",
  danger: "bg-red-600",
  restore: "bg-slate-500",
  neutral: "bg-slate-700",
};

/** Desktop hover-button classes per tone. */
const TONE_HOVER: Record<SwipeTone, string> = {
  approve: "text-emerald-700 hover:bg-emerald-50",
  reject: "text-amber-700 hover:bg-amber-50",
  danger: "text-red-700 hover:bg-red-50",
  restore: "text-slate-600 hover:bg-muted",
  neutral: "text-slate-700 hover:bg-muted",
};

export const SWIPE_ACTION_WIDTH = 76;

/**
 * One-open-at-a-time state for a list of SwipeRows. `sideOf(id)` feeds each
 * row's `openSide`; `setFor(id)` feeds its `onOpenSide`; `closeAll()` for
 * list-level events (scroll, opening a sheet, a refetch).
 */
export function useSwipeOpen() {
  const [open, setOpen] = useState<{ id: string; side: Exclude<SwipeSide, null> } | null>(null);
  const sideOf = useCallback((id: string): SwipeSide => (open?.id === id ? open.side : null), [open]);
  const setFor = useCallback((id: string) => (side: SwipeSide) => setOpen(side ? { id, side } : null), []);
  const closeAll = useCallback(() => setOpen(null), []);
  return { sideOf, setFor, closeAll };
}

function runAction(a: SwipeAction, close: () => void) {
  if (a.confirm && !window.confirm(a.confirm)) return;
  close();
  a.onAction();
}

export function SwipeRow({
  children,
  leftActions,
  rightActions,
  openSide,
  onOpenSide,
  actionWidth = SWIPE_ACTION_WIDTH,
  contentClassName = "bg-card",
}: {
  children: ReactNode;
  /** Revealed by swiping RIGHT (sits at the left edge). Usually one approve action. */
  leftActions?: SwipeAction[];
  /** Revealed by swiping LEFT (sits at the right edge). Order = left to right. */
  rightActions?: SwipeAction[];
  openSide: SwipeSide;
  onOpenSide: (side: SwipeSide) => void;
  /** Width of each revealed button in px. Never below 44. */
  actionWidth?: number;
  /** Background of the sliding layer — must be opaque or the buttons show through. */
  contentClassName?: string;
}) {
  const w = Math.max(44, actionWidth);
  const leftWidth = (leftActions?.length ?? 0) * w;
  const rightWidth = (rightActions?.length ?? 0) * w;

  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ x: number; y: number; base: number; mode: "idle" | "h" | "v" } | null>(null);
  const moved = useRef(false);
  // Mirrors `dx` so a release in the same frame as the last move still sees the final offset.
  const dxRef = useRef(0);

  const base = openSide === "right" ? -rightWidth : openSide === "left" ? leftWidth : 0;
  const offset = dragging ? dx : base;

  function clamp(v: number) {
    return Math.min(leftWidth, Math.max(-rightWidth, v));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    if (leftWidth === 0 && rightWidth === 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, base, mode: "idle" };
    moved.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const ddx = e.clientX - g.x;
    const ddy = e.clientY - g.y;
    if (g.mode === "idle") {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      g.mode = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
      if (g.mode === "h") {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Capture can be refused for a synthetic pointer — the drag still works without it.
        }
        setDragging(true);
      }
    }
    if (g.mode === "h") {
      moved.current = true;
      dxRef.current = clamp(g.base + ddx);
      setDx(dxRef.current);
    }
  }

  function finish() {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.mode !== "h") return;
    setDragging(false);
    const final = dxRef.current;
    if (rightWidth > 0 && final < -rightWidth / 2) onOpenSide("right");
    else if (leftWidth > 0 && final > leftWidth / 2) onOpenSide("left");
    else onOpenSide(null);
  }

  const close = () => onOpenSide(null);

  function panel(actions: SwipeAction[] | undefined, side: "left" | "right", width: number) {
    if (width === 0 || !actions) return null;
    const isOpen = openSide === side;
    return (
      <div
        className={`absolute inset-y-0 flex md:hidden ${side === "left" ? "left-0" : "right-0"}`}
        style={{ width }}
        aria-hidden={!isOpen}
      >
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            tabIndex={isOpen ? 0 : -1}
            aria-label={a.label}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-white ${TONE_PANEL[a.tone]}`}
            style={{ minWidth: 44 }}
            onClick={() => runAction(a, close)}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {panel(leftActions, "left", leftWidth)}
      {panel(rightActions, "right", rightWidth)}
      <div
        className={`relative ${contentClassName} ${dragging ? "transition-none" : "transition-transform duration-[180ms] ease-out motion-reduce:transition-none"}`}
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation();
            e.preventDefault();
            moved.current = false;
            return;
          }
          if (openSide) {
            e.stopPropagation();
            e.preventDefault();
            onOpenSide(null);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The desktop fallback: the same actions as round icon buttons that appear on
 * row hover or keyboard focus. Place it INSIDE the row content, and make an
 * ancestor of the row `group/row` (e.g. the wrapper around `<SwipeRow>`).
 * Hidden below `md`, where the swipe takes over. Buttons are 44px.
 */
export function SwipeHoverActions({ actions, onBeforeAction }: { actions: SwipeAction[]; onBeforeAction?: () => void }) {
  if (actions.length === 0) return null;
  return (
    <div className="hidden items-center gap-1 md:group-hover/row:flex md:group-focus-within/row:flex">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          className={`flex h-11 w-11 items-center justify-center rounded-full ${TONE_HOVER[a.tone]}`}
          aria-label={a.label}
          title={a.label}
          onClick={() => runAction(a, onBeforeAction ?? (() => undefined))}
        >
          {a.icon}
        </button>
      ))}
    </div>
  );
}
