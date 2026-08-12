/**
 * WCAG contrast maths, and a guaranteed-readable pairing for a caller-supplied
 * colour.
 *
 * WHY THIS EXISTS
 * The recurring bug this prevents is a coloured chip — a label, tag or status
 * badge — painted with a colour that comes from *data* (a per-tenant accent, a
 * category colour, anything a user can pick), with a text colour hard-coded in
 * the markup. `text-white` looks fine against the mid-blue everyone tested
 * with, and is invisible against a saturated yellow: white on `#ffea00` is
 * 1.23:1, where AA wants 4.5:1. Nothing catches it — not `tsc`, not lint, not a
 * build, and not a reviewer who never saw that particular row.
 *
 * The fix is to stop hard-coding the foreground and derive it, which is what
 * `accessiblePair` does.
 *
 * WHY PICKING BLACK-OR-WHITE IS NOT ENOUGH
 * The obvious implementation — "use whichever of black or white contrasts
 * better" — has a real gap, and it is not exotic. Pure red `#ff0000` scores
 * 4.00:1 against white and 4.44:1 against near-black: BOTH fail AA, and the
 * better-of-the-two is still a fail. A band of saturated mid-tones behaves the
 * same way. So when neither foreground can reach the threshold, this module
 * nudges the BACKGROUND's lightness — in HSL, so hue and saturation survive and
 * the colour still reads as the one that was chosen — by the smallest step that
 * clears the bar. For `#ff0000` that is a barely-perceptible lightening; the
 * chip still reads as red.
 *
 * Deriving the pair also means a colour picked in future can never reintroduce
 * the bug: an unreadable combination is not representable as an output of this
 * function.
 *
 * SCOPE: sRGB, WCAG 2.1 relative luminance (1.4.3). No dependencies, no React —
 * safe to import anywhere, including a plain Node script or a test.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** WCAG 2.1 AA minimum for normal-size text. */
export const AA_NORMAL = 4.5;
/** WCAG 2.1 AA minimum for large text (>=24px, or >=18.66px bold). */
export const AA_LARGE = 3;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Parse `#rgb`, `#rrggbb`, `rgb(...)` or `rgba(...)`. Returns null on anything
 * else — callers decide the fallback rather than getting a silent black.
 *
 * Alpha is deliberately IGNORED rather than approximated: a translucent chip
 * colour composites against whatever is behind it, which this module cannot
 * see. Treating `rgba(x,y,z,0.2)` as opaque would produce a confident, wrong
 * ratio; the honest answer is to measure the solid colour the caller asked for.
 */
export function parseColor(input: string | null | undefined): Rgb | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();

  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  const fn = s.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[,/\s]+/).filter(Boolean).map((v) => parseFloat(v));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return {
        r: clamp(Math.round(parts[0]), 0, 255),
        g: clamp(Math.round(parts[1]), 0, 255),
        b: clamp(Math.round(parts[2]), 0, 255),
      };
    }
  }

  return null;
}

export function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const f = [r, g, b].map((v) => {
    const c = clamp(v, 0, 255) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

/** WCAG contrast ratio between two opaque colours. Range 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// --- HSL, used only to move lightness while holding hue and saturation ------

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  };
}

export interface AccessiblePairOptions {
  /** Minimum acceptable ratio. Defaults to AA for normal text. */
  minRatio?: number;
  /** Light foreground candidate. */
  light?: string;
  /** Dark foreground candidate. Defaults to a near-black that reads softer than #000. */
  dark?: string;
  /** Used when `color` cannot be parsed. */
  fallback?: string;
}

export interface AccessiblePair {
  /** The background to paint — the caller's colour, unless it had to be nudged. */
  background: string;
  /** A foreground guaranteed to meet `minRatio` against `background`. */
  foreground: string;
  /** Achieved contrast ratio, rounded to 2dp. */
  ratio: number;
  /** True when the background lightness had to move to make the pair legible. */
  adjusted: boolean;
}

/**
 * Given any colour, return a background/foreground pair that meets `minRatio`.
 *
 * The caller's colour is preserved untouched whenever a readable foreground
 * exists for it, which is the overwhelmingly common case. Only genuinely
 * unreadable colours are adjusted, and then by the smallest lightness step that
 * clears the threshold.
 */
export function accessiblePair(
  color: string | null | undefined,
  options: AccessiblePairOptions = {}
): AccessiblePair {
  const {
    minRatio = AA_NORMAL,
    light = "#ffffff",
    dark = "#111827",
    fallback = "#6366f1",
  } = options;

  const lightRgb = parseColor(light) ?? { r: 255, g: 255, b: 255 };
  const darkRgb = parseColor(dark) ?? { r: 17, g: 24, b: 39 };
  const bg = parseColor(color) ?? parseColor(fallback) ?? { r: 99, g: 102, b: 241 };

  const lightRatio = contrastRatio(lightRgb, bg);
  const darkRatio = contrastRatio(darkRgb, bg);
  const useLight = lightRatio >= darkRatio;
  const fg = useLight ? lightRgb : darkRgb;
  const best = useLight ? lightRatio : darkRatio;

  if (best >= minRatio) {
    return {
      background: toHex(bg),
      foreground: useLight ? toHex(lightRgb) : toHex(darkRgb),
      ratio: Math.round(best * 100) / 100,
      adjusted: false,
    };
  }

  // Neither candidate clears the bar. Move the background away from the
  // foreground we've chosen — darker under light text, lighter under dark text
  // — one percent of lightness at a time, and stop at the first step that
  // passes. Hue and saturation are untouched, so the chip keeps its identity.
  const hsl = rgbToHsl(bg);
  const step = useLight ? -0.01 : 0.01;
  for (let i = 1; i <= 100; i++) {
    const l = clamp(hsl.l + step * i, 0, 1);
    const candidate = hslToRgb({ ...hsl, l });
    const r = contrastRatio(fg, candidate);
    if (r >= minRatio) {
      return {
        background: toHex(candidate),
        foreground: toHex(fg),
        ratio: Math.round(r * 100) / 100,
        adjusted: true,
      };
    }
    if (l === 0 || l === 1) break;
  }

  // Unreachable for any sRGB input — pure black and pure white both exceed AA
  // against one of the two candidates — but a silent sub-AA return would be the
  // exact failure this module exists to prevent, so fall back to the extreme
  // rather than to the caller's colour.
  const extreme = useLight ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  return {
    background: toHex(extreme),
    foreground: toHex(fg),
    ratio: Math.round(contrastRatio(fg, extreme) * 100) / 100,
    adjusted: true,
  };
}

/**
 * Just the foreground, for callers painting their own background.
 */
export function readableOn(color: string | null | undefined, options: AccessiblePairOptions = {}): string {
  return accessiblePair(color, options).foreground;
}

/** Mix `color` toward white. `weight` is how much of the ORIGINAL colour survives. */
function tintTowardWhite(rgb: Rgb, weight: number): Rgb {
  return {
    r: Math.round(255 - (255 - rgb.r) * weight),
    g: Math.round(255 - (255 - rgb.g) * weight),
    b: Math.round(255 - (255 - rgb.b) * weight),
  };
}

/**
 * A SOFT chip: a pale tint of the colour behind a dark, saturated version of the
 * same colour.
 *
 * WHY THIS EXISTS ALONGSIDE `accessiblePair`
 * `accessiblePair` keeps the caller's colour as the background and finds a
 * foreground that clears AA. That is correct, and it is still not comfortable to
 * read: near-black on saturated red scores 4.50:1 — a pass, but a pass sitting
 * exactly on the floor — and near-black on saturated orange, at 6.33:1, is
 * legitimately tiring across a list of ninety chips. Reported by the user twice,
 * the second time after the ratios were already compliant, which is the useful
 * signal: **meeting AA is a floor, not evidence that something is pleasant to
 * read.**
 *
 * Tinting inverts where the saturation goes. The chip still reads unmistakably
 * as "red" or "orange" — hue is untouched — but the strong colour moves into the
 * text, where it aids legibility, and the background becomes a wash. Ratios land
 * far above the minimum rather than on it.
 *
 * The foreground is darkened until it clears `minRatio` against the tint, so the
 * guarantee is identical to `accessiblePair`'s: an unreadable pair is not
 * representable as an output.
 */
export function softPair(
  color: string | null | undefined,
  options: AccessiblePairOptions & { tintWeight?: number; comfortRatio?: number } = {}
): AccessiblePair {
  const {
    minRatio = AA_NORMAL,
    dark = "#111827",
    fallback = "#6366f1",
    // 12% of the colour, 88% white. Enough to name the hue, pale enough to read on.
    tintWeight = 0.12,
    // The target, not the floor. AAA for body text — reached for every colour in
    // the estate palette; a hue that cannot get there falls back to minRatio.
    comfortRatio = 7,
  } = options;

  const base = parseColor(color) ?? parseColor(fallback) ?? { r: 99, g: 102, b: 241 };
  const bg = tintTowardWhite(base, tintWeight);

  // Walk the colour's own lightness down until it is legible on its own tint.
  // Starting from the colour rather than from black is what keeps the text
  // recognisably the brand hue instead of a generic dark grey.
  //
  // AIM FOR `comfortRatio` (AAA), NOT `minRatio`. Stopping at the first shade
  // that clears AA reproduces the original complaint in a new form: red settled
  // at 4.58:1, which is compliant and still unpleasant. The floor is where a
  // pair becomes permissible, not where it becomes readable — and the caller is
  // asking for a *soft* chip precisely because the compliant version was not
  // good enough. Keep darkening past the floor.
  const hsl = rgbToHsl(base);
  let acceptable: { rgb: Rgb; ratio: number; steps: number } | null = null;

  for (let i = 0; i <= 100; i++) {
    const candidate = hslToRgb({ ...hsl, l: Math.max(0, hsl.l - i * 0.01) });
    const r = contrastRatio(candidate, bg);
    if (r >= comfortRatio) {
      return {
        background: toHex(bg),
        foreground: toHex(candidate),
        ratio: Math.round(r * 100) / 100,
        adjusted: i > 0,
      };
    }
    // Remember the first merely-compliant shade, in case this hue cannot reach
    // comfort against its own tint before running out of lightness.
    if (!acceptable && r >= minRatio) acceptable = { rgb: candidate, ratio: r, steps: i };
    if (hsl.l - i * 0.01 <= 0) break;
  }

  if (acceptable) {
    return {
      background: toHex(bg),
      foreground: toHex(acceptable.rgb),
      ratio: Math.round(acceptable.ratio * 100) / 100,
      adjusted: acceptable.steps > 0,
    };
  }

  // A colour so pale that even black-of-its-own-hue cannot clear the bar against
  // its tint (a near-white input). Fall back to the neutral dark, which always can.
  const darkRgb = parseColor(dark) ?? { r: 17, g: 24, b: 39 };
  return {
    background: toHex(bg),
    foreground: toHex(darkRgb),
    ratio: Math.round(contrastRatio(darkRgb, bg) * 100) / 100,
    adjusted: true,
  };
}
