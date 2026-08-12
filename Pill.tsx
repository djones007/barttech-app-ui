import type { CSSProperties, ReactNode } from "react";
import { accessiblePair, parseColor, toHex } from "./contrast";

/**
 * A small coloured chip — label, tag, category or status badge — whose
 * background comes from data and whose foreground is therefore DERIVED, never
 * hard-coded.
 *
 * Use this anywhere a colour arrives from a database row, a settings screen or
 * any other place a person can pick one. The moment a call site writes its own
 * `text-white` over a data-driven `backgroundColor`, it has taken on a bug that
 * only appears for whichever colour someone chooses next. See `contrast.ts` for
 * the maths and the failure it prevents.
 *
 * Deliberately NOT a client component: it renders no state and binds no
 * handlers, so it works in a server component and costs nothing extra when a
 * client component imports it.
 */
export interface PillProps {
  /** Background colour — any hex or rgb() string. Unparseable input uses `fallbackColor`. */
  color?: string | null;
  children: ReactNode;
  /** Replaces the default shape/typography classes wholesale. */
  className?: string;
  /** Used when `color` is missing or unparseable. */
  fallbackColor?: string;
  /** Minimum contrast ratio to guarantee. Defaults to WCAG AA for normal text. */
  minRatio?: number;
  title?: string;
  style?: CSSProperties;
}

const DEFAULT_CLASS = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function Pill({
  color,
  children,
  className = DEFAULT_CLASS,
  fallbackColor,
  minRatio,
  title,
  style,
}: PillProps) {
  const { background, foreground } = accessiblePair(color, {
    ...(fallbackColor ? { fallback: fallbackColor } : {}),
    ...(minRatio ? { minRatio } : {}),
  });

  return (
    <span
      className={className}
      title={title}
      // Inline styles, not classes: the colour is not known at build time, so
      // Tailwind cannot generate a utility for it.
      style={{ backgroundColor: background, color: foreground, ...style }}
    >
      {children}
    </span>
  );
}

/**
 * A coloured DOT — a swatch or status marker carrying no text of its own.
 *
 * Deliberately does NOT go through `accessiblePair`. There is no foreground to
 * derive, so the AA text rule does not apply, and nudging the lightness here
 * would misrepresent the stored value: a swatch shown next to "your colour is
 * #ff0000" must be that colour, not an adjusted neighbour of it. The only thing
 * this adds over an inline style is consistent handling of a missing or
 * unparseable value.
 *
 * (WCAG 1.4.11 asks 3:1 for meaningful non-text UI against what it sits on —
 * that is a different measurement against the page background, not the
 * foreground/background pairing this file solves, and it is not enforced here.)
 */
export function PillDot({
  color,
  className = "w-2.5 h-2.5 rounded-full",
  fallbackColor = "#6366f1",
  title,
}: {
  color?: string | null;
  className?: string;
  fallbackColor?: string;
  title?: string;
}) {
  const parsed = parseColor(color);
  const background = parsed ? toHex(parsed) : fallbackColor;
  return <span className={className} title={title} style={{ backgroundColor: background }} />;
}

export default Pill;
