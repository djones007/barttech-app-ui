"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button for a form that posts to a server action, which reports what it
 * is doing instead of looking inert.
 *
 * ## Why this exists
 *
 * The default shape for a server-action form is a plain
 * `<button type="submit">Save</button>`. On a fast save that is
 * indistinguishable from a broken button: the action runs, the route
 * revalidates, and the page re-renders with exactly the same values it already
 * had. Nothing moves. Users respond by clicking again, or by reloading to check
 * whether it worked — and a double-submit on a form that isn't idempotent is a
 * real bug, not just an annoyance.
 *
 * Two states fix it: **in flight** (disabled, "Saving…") and **just finished**
 * ("Saved", briefly). That is the whole component.
 *
 * ## Why it is a client component
 *
 * `useFormStatus()` only reports the status of a form when it is read from a
 * component rendered INSIDE that `<form>`. It cannot be read by the page that
 * owns the form, and pages holding server-action forms are usually server
 * components anyway. So the button has to be its own client component — this is
 * a constraint of the hook, not a styling choice.
 *
 * ## Usage
 *
 * ```tsx
 * <form action={updateThing}>
 *   …fields…
 *   <SaveButton>Save settings</SaveButton>
 * </form>
 * ```
 *
 * Pass `className` to restyle; the default is a neutral dark button. Pass
 * `savedLabel` if "Saved" is the wrong word for the action (e.g. "Sent").
 */
export function SaveButton({
  children = "Save",
  className,
  savedLabel = "Saved",
  pendingLabel = "Saving…",
  savedForMs = 2500,
}: {
  children?: React.ReactNode;
  className?: string;
  savedLabel?: string;
  pendingLabel?: string;
  /** How long the confirmation stays on screen. */
  savedForMs?: number;
}) {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    // Only a pending -> idle transition means a submit just completed.
    // Reacting to `!pending` alone would show the confirmation on first mount,
    // before anything had been submitted at all.
    if (wasPending.current && !pending) {
      setSaved(true);
      wasPending.current = pending;
      const t = setTimeout(() => setSaved(false), savedForMs);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending, savedForMs]);

  return (
    <div className="flex items-center gap-3">
      {saved && (
        // role=status so screen readers announce the result; a purely visual
        // confirmation tells a screen-reader user nothing at all.
        <span role="status" className="text-sm font-medium text-green-700">
          {savedLabel}
        </span>
      )}
      <button
        type="submit"
        disabled={pending}
        className={
          className ??
          "rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        }
      >
        {pending ? pendingLabel : children}
      </button>
    </div>
  );
}
