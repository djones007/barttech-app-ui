# @barttech/app-ui

Shared **app-shell UI** for the Barttech estate — the brand-neutral chrome that every
internal tool, admin portal and customer portal wraps itself in, so it is written once
here instead of copy-pasted and drifted across a dozen repos.

This is a **source-only** repo — nothing here is built or published. It is mounted into
each consuming app as a **git submodule** and transpiled by that app's Next.js build,
the same pattern used for the estate's other shared source-only submodules. **Not a
deployable app — no Vercel project.**

## Why this is a separate repo from the estate's shared core module

The estate's shared framework-free core module is deliberately **pure TypeScript with no
React and no Next**, and it is mounted in a dozen repos — including brand marketing sites
that will never have an admin nav. A `.tsx` file importing `react`/`next` in that repo
would be type-checked by every one of those consumers, whether or not they have those
packages resolvable. That is not hypothetical: a consumer once broke because its overly
broad TypeScript `include` pattern type-checked a core-module file whose import that
consumer did not have installed.

So UI gets its own repo, mounted **only where it is used**.

## What lives here

| File | Exports |
|------|---------|
| `LeftNav.tsx` | `LeftNav`, and the types `NavItem`, `NavLinkItem`, `NavChildItem`, `NavGroupItem`, `LeftNavProps` — the left-hand sidebar shell: app header, link/group nav with accordions, off-canvas mobile drawer, and a pinned bottom block (Changelog · Help · signed-in email · Sign out). Client component (`"use client"`). |
| `contrast.ts` | `accessiblePair`, `readableOn`, `contrastRatio`, `relativeLuminance`, `parseColor`, `toHex`, `AA_NORMAL`, `AA_LARGE` — WCAG 2.1 colour maths. Pure TypeScript, no React. |
| `SwipeRow.tsx` | `SwipeRow`, `SwipeHoverActions`, `useSwipeOpen`, `SWIPE_ACTION_WIDTH` + types `SwipeAction`, `SwipeSide`, `SwipeTone`. Swipe-to-reveal row actions for phone lists. |
| `Pill.tsx` | `Pill`, `PillDot`, type `PillProps` — a coloured chip whose text colour is derived from its background. No hooks, so it works in a server component. |

There is no barrel `index.ts` — import the file directly (`@/app-ui/LeftNav`), matching
how the estate's other shared submodule is consumed.

## Coloured chips: `Pill` and `contrast.ts`

Any time a background colour comes from **data** — a per-tenant accent, a category colour,
anything picked in a settings screen — the text colour on top of it must be **derived, not
written**. Hard-coding `text-white` produces a chip that is readable against the colour it
was built with and unreadable against the next one someone chooses: white on `#ffea00` is
1.23:1, against AA's 4.5:1 floor. No build, type check or linter can see that.

```tsx
import { Pill, PillDot } from "@/app-ui/Pill";

<Pill color={category.colour}>{category.name}</Pill>
<PillDot color={category.colour} />
```

Painting the background yourself? Take just the foreground:

```tsx
import { readableOn, accessiblePair } from "@/app-ui/contrast";

<span style={{ backgroundColor: c, color: readableOn(c) }}>…</span>
const { background, foreground, ratio, adjusted } = accessiblePair(c, { minRatio: 7 });
```

### `Pill` props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `color` | `string \| null` | — | Any hex (`#abc`, `#aabbcc`) or `rgb()`/`rgba()` string. Alpha is ignored, not approximated. |
| `children` | `ReactNode` | — | Chip contents. |
| `className` | `string` | rounded-full chip classes | Replaces the default shape/typography wholesale. |
| `fallbackColor` | `string` | `#6366f1` | Used when `color` is missing or unparseable. |
| `minRatio` | `number` | `4.5` (AA) | Raise to `7` for AAA. |
| `title` / `style` | — | — | Passed through; `style` merges over the computed colours. |

### Two things to know before changing it

**Better-of-black-or-white is not sufficient.** Pure red `#ff0000` scores 4.00:1 against
white and 4.44:1 against near-black — both fail AA, and the better of the two still fails.
When no fixed foreground reaches the threshold, `accessiblePair` nudges the background's
**lightness** in HSL so hue and saturation survive; the chip still reads as red. Sampling the
sRGB cube every 17 steps (4,096 colours), 254 need that nudge and the rest come back
untouched — the caller's colour is preserved wherever it legitimately can be.

**The guarantee is asserted.** `npm test` sweeps those 4,096 colours, fails on any sub-AA
pair, and independently re-measures every returned pair rather than trusting the ratio the
function reports about itself. It runs in CI.

## `LeftNav` props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `appName` | `string` | — | Sidebar header + mobile top bar. |
| `appInitial` | `string` | first char of `appName` | Letter in the logo square. |
| `navItems` | `NavItem[]` | — | Mix `{ kind: "link" }` and `{ kind: "group" }` entries. Each link (and each group child) takes an optional `exact` and `external` — see below. |
| `userEmail` | `string` | — | Shown above Sign out. |
| `onSignOut` | `() => void` | — | Pass a server action. Omit and the row is not rendered. **Prefer `signOutHref`** — see below. |
| `signOutHref` | `string` | — | Sign-out as a plain `<a href>` GET navigation. Survives deployments, unlike a server action. Takes precedence over `onSignOut`. |
| `changelogHref` | `string \| null` | `"/changelog"` | `null` hides the row. |
| `helpHref` | `string \| null` | `"/help"` | `null` hides the row. |
| `homeHref` | `string` | `"/"` | Where the logo/app-name links. |
| `widthClassName` | `string` | `"w-60"` | **Replaces** the default width class. |
| `className` | `string` | — | Appended to the `<aside>` classes. |
| `style` | `React.CSSProperties` | — | Inline style on the `<aside>`. |
| `footer` | `React.ReactNode` | — | Rendered in the bottom block, above Changelog/Help. |

The first seven are the API this component already shipped with in an early consumer,
kept unchanged so that repo needs only a re-export shim. The rest were added here to fit
real consumers without any of them having to fork:

- **`homeHref`** — several consumers mount their admin under a nested root path (e.g.
  `/admin/*`) rather than `/`. Hardcoding `/` made the header link a route *out* of the
  app shell.
- **`widthClassName`** — different consumers need different sidebar widths. This
  **replaces** rather than appends because two competing Tailwind width classes in one
  string resolve by stylesheet order, not string order, and this repo carries no
  `tailwind-merge`. Keep the page layout's left padding in step (`md:pl-60` by default).
- **`className` / `style`** — for a consumer that themes with inline `style={{}}` objects and
  CSS custom properties (`background: "var(--surface)"`) rather than Tailwind colour classes.
  `style` covers the shell; **it does not restyle the individual rows** — a fully themed
  variant is not solved yet and should not be faked with a prop that half-works. In practice
  that limit bites for any dark-themed consumer: styling only the `<aside>` dark would leave
  this component's `text-slate-600` row labels illegible against it. A dark consumer gets the
  light shell until a real themed variant is designed.
- **`footer`** — a slot for an environment badge / tenant switcher / version string,
  rather than growing a prop per app.
- **Active row: longest match wins.** The active check matches whole path *segments*, so a
  row is active on its descendants too (an orders route keeps its row lit on any sub-page
  under it). Of every row that matches the current path, only the one with the **longest
  href** is lit — so `/campaigns` stays active on `/campaigns/<id>` (not a row) and yields to
  `/campaigns/settings` (a row) without any flag. Before 2026-09-07 each row decided its own
  state and a parent/child pair lit both rows; that was patched six times with `exact: true`
  and recurred with every new pair. `/` is always exact, since every path descends from it.
- **`exact` on a nav entry** — still honoured: turns off descendant matching for that row.
  Nothing new should need it now that the longest match wins.
- **`external` on a nav entry** — the row points at a *different application*, not a route
  in this one. Without it, such rows rendered through `next/link` as same-tab
  navigations that dumped the user out of the app with no way back, and no indication before
  clicking that the row would do that. With it the row is a plain `<a target="_blank"
  rel="noopener noreferrer">` with a small external-link glyph and an `sr-only` "(opens in a new
  tab)", since a glyph alone tells a screen-reader user nothing.

  It also **skips the active check**, which matters more than it looks. `usePathname()` returns a
  path and can never equal an absolute URL, so an external row is structurally always inactive —
  but the same comparison also feeds `hasActiveChild`, which decides whether a collapsed group
  highlights and whether a group auto-expands on the current route. Running it over absolute URLs
  is dead work on every route change for an answer that cannot change. Use `isRowActive`, not
  `isActive`, at any new call site handling a nav entry.
- **`changelogHref: null` / `helpHref: null`** — some consumers' admin areas have no
  `/changelog` or `/help` page, and a pinned nav row that 404s is worse than no row.
- **`signOutHref` over `onSignOut` — prefer it in new code.** A framework that content-hashes
  server-action IDs per build gives every deployment a new ID, so a user holding the app open
  across a deploy clicks Sign out and hits an action the running deployment has never heard of.
  One consumer shipped that for weeks and it surfaced as a stream of *"Failed to find Server
  Action"* errors in Sentry — never reproducible locally, because a local session never spans a
  deployment. `signOutHref` renders a plain `<a href>` to a route handler instead: no ID, nothing
  to go stale. `onSignOut` is unchanged and still supported (golden rule 4), and remains correct
  where sign-out must do work a GET should not. When both are passed, `signOutHref` wins.

At least one consumer's admin **was** tab-based, and it is now a consumer like the rest: its
tabs became real routes, then it mounted this component unchanged.
No `variant` prop was added, and none should be — rendering tabs is a different shell,
not a mode of this one.

### Icons

Pass any `React.ElementType` on a nav entry's `icon` field — lucide-react components work
directly (`icon: LayoutDashboard`). **This repo has no `lucide-react` dependency and must
not gain one**: the six pieces of built-in chrome (hamburger, close, chevron, changelog,
help, sign-out) are inline SVGs, so a consumer with a different icon set pays nothing.

## `BugReportButton`

The staff "Report a bug" icon. Mount it once in the signed-in layout:

```tsx
import { toBlob } from "html-to-image";
import * as Sentry from "@sentry/nextjs";
import { BugReportButton } from "@/app-ui/BugReportButton";

<BugReportButton endpoint="/api/bug-report" capture={toBlob} getSentryEventId={() => Sentry.lastEventId()} />
```

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `endpoint` | `string` | — | The app's own POST route. It must check the session, then clean and forward with the shared core module's `bugReport.ts`. |
| `capture` | `BugCaptureFn` | none | html-to-image's `toBlob` (the consumer installs it). Without it there is no automatic picture. |
| `getSentryEventId` | `() => string \| null \| undefined` | none | Attaches the last Sentry event id. |
| `className` | `string` | `fixed right-3 top-14 z-30 md:right-6 md:top-16` | Positioning; the default sits under a top-right bell. |
| `label` | `string` | `Report a bug` | Tooltip, aria-label and form title. |

Posts `multipart/form-data`: `report` (JSON), optional `page` (WebP of the visible page) and up to two `upload` files, all downscaled to WebP in the browser so the body stays under the serverless 4.5 MB cap. The route answers `{ ok: true, id?, href? }`; `href` is shown as "View the issue". Its own UI carries `data-bug-report-ui` so it is never in the picture or the click trail.

## `SwipeRow` — swipe-to-reveal row actions (estate standard for phone lists)

A list row that slides sideways to reveal action buttons: swipe LEFT reveals `rightActions`
(at the right edge), swipe RIGHT reveals `leftActions` (at the left edge). Presentation only —
each action's `onAction` is the caller's existing server action. Desktop (mouse) never drags;
`SwipeHoverActions` shows the same actions as icon buttons on row hover / keyboard focus.

```tsx
import { SwipeRow, SwipeHoverActions, useSwipeOpen, type SwipeAction } from "@/app-ui/SwipeRow";

const swipe = useSwipeOpen();                       // one row open at a time

const publish: SwipeAction = { key: "publish", label: "Publish", icon: <Send className="h-5 w-5" />, tone: "approve",
  confirm: `Publish ${name} (${amount})?`, onAction: () => publishItem(id) };
const remove: SwipeAction = { key: "delete", label: "Delete", icon: <Trash2 className="h-5 w-5" />, tone: "danger",
  confirm: `Delete ${name}?`, onAction: () => deleteItem(id) };

<div className="group/row">                         {/* needed by SwipeHoverActions */}
  <SwipeRow openSide={swipe.sideOf(id)} onOpenSide={swipe.setFor(id)}
            leftActions={[publish]} rightActions={[publish, remove]}>
    <div className="flex items-center gap-2 px-4">
      <button className="min-h-[72px] flex-1 text-left" onClick={open}>...</button>
      <SwipeHoverActions actions={[publish, remove]} onBeforeAction={swipe.closeAll} />
    </div>
  </SwipeRow>
</div>
```

| Prop (`SwipeRow`) | Type | Default | Notes |
|------|------|---------|-------|
| `children` | `ReactNode` | — | The row content. Its background is `contentClassName` (must be opaque). |
| `rightActions` | `SwipeAction[]` | none | Revealed by swiping LEFT. Left to right. Usual place for the full set. |
| `leftActions` | `SwipeAction[]` | none | Revealed by swiping RIGHT. One positive shortcut (approve/publish) only. |
| `openSide` / `onOpenSide` | `"left" \| "right" \| null` / setter | — | Owned by the parent — use `useSwipeOpen()` so only one row is open. |
| `actionWidth` | `number` | `76` | Px per button; clamped to a 44 minimum. |
| `contentClassName` | `string` | `bg-card` | Sliding layer background. |

`SwipeAction`: `key`, `label` (visible and accessible name), `icon?` (an element; no icon library
ships here), `tone` (`approve` green, `reject` amber, `danger` red, `restore` slate, `neutral`),
`confirm?` (text for `window.confirm`; the action does not run unless accepted) and `onAction`.
Choosing an action closes the row first, then runs `onAction`. A drag never counts as a tap, and a
tap on an open row only closes it. `touch-action: pan-y` keeps vertical scrolling; the transition
is disabled under `prefers-reduced-motion`. The standard (when to use it, colours, confirm rules)
is in `CLAUDE.md` under "SwipeRow standard".

## Local dev

```bash
npm install
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit
```

There are no values to configure and therefore no `.env.example` — this repo reads no
environment variables and talks to no external system.

`react`, `react-dom` and `next` are **peerDependencies** (the consuming app supplies them
— a second copy of React in one tree is a real bug, not a duplication nit). They are
*also* devDependencies, purely so `tsc` here can resolve `next/link`, `react` and the JSX
runtime while the repo checks itself. Nothing in this repo's `node_modules` reaches a
consumer: it is gitignored, so the submodule checkout is source-only.

`npm audit` reports a high-severity `brace-expansion` advisory reaching this repo only
through `eslint` → `@eslint/config-array` → `minimatch`. The fix is ESLint 10, which the
estate currently holds at a major boundary (see `.github/dependabot.yml`). It is a
dev-only lint dependency that never runs against untrusted input and never ships.

## How it is consumed

Mounted inside the app so the existing `@/*` path alias resolves it:

```bash
git submodule add https://github.com/djones007/barttech-app-ui.git src/app-ui
```

Mount at `src/app-ui` when the app's `@/*` maps to `./src/*`, else `app-ui` at the repo
root. Then `import { LeftNav } from "@/app-ui/LeftNav"` — or keep the app's existing
component path as a one-line shim (`export * from "@/app-ui/LeftNav"`) so no call site
changes.

**Consumers must exclude the vendored path from their own lint and add
`submodules: recursive` to their `actions/checkout` step.** The repo is public, so Vercel
and GitHub Actions clone it natively — no extra token plumbing.

The list of which apps currently mount this repo, at what path and on what branch, is
kept privately rather than in this public repo — see the note under Consumers in
`CLAUDE.md`.

## Why it has its own CI

Same reason the estate's other shared submodule does: a shared module vendored into many
repos and linted only as a side effect of being vendored means one error here reddens
every consuming build at once, against files none of those repos may edit — a fix made in
a consumer's copy is discarded on the next pointer bump. The gate belongs where the source
lives.
