import type { CSSProperties, ReactNode } from "react";
import { accessiblePair } from "./contrast";

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
 * The same guarantee for a caller that needs a coloured DOT rather than a chip
 * — a status marker with no text of its own. There is no foreground to derive,
 * so this is only the background, but routing it through here keeps dot and
 * chip visually identical when both appear in one row.
 */
export function PillDot({
  color,
  className = "w-2.5 h-2.5 rounded-full",
  fallbackColor,
  title,
}: {
  color?: string | null;
  className?: string;
  fallbackColor?: string;
  title?: string;
}) {
  const { background } = accessiblePair(color, fallbackColor ? { fallback: fallbackColor } : {});
  return <span className={className} title={title} style={{ backgroundColor: background }} />;
}

export default Pill;
