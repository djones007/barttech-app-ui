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

There is no barrel `index.ts` — import the file directly (`@/app-ui/LeftNav`), matching
how the estate's other shared submodule is consumed.

## `LeftNav` props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `appName` | `string` | — | Sidebar header + mobile top bar. |
| `appInitial` | `string` | first char of `appName` | Letter in the logo square. |
| `navItems` | `NavItem[]` | — | Mix `{ kind: "link" }` and `{ kind: "group" }` entries. Each link (and each group child) takes an optional `exact` and `external` — see below. |
| `userEmail` | `string` | — | Shown above Sign out. |
| `onSignOut` | `() => void` | — | Pass a server action. Omit and the row is not rendered. |
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
- **`exact` on a nav entry** — the active check matches whole path *segments*, so a row is
  active on its descendants too (an orders route keeps its row lit on any sub-page under
  it). That breaks down for a row that is an ancestor of the whole rest of the nav: a
  Dashboard row pointing at an admin root would, without `exact: true`, render active on
  every other admin page. `/` is always treated as exact for the same reason.
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

At least one consumer's admin **was** tab-based, and it is now a consumer like the rest: its
tabs became real routes, then it mounted this component unchanged.
No `variant` prop was added, and none should be — rendering tabs is a different shell,
not a mode of this one.

### Icons

Pass any `React.ElementType` on a nav entry's `icon` field — lucide-react components work
directly (`icon: LayoutDashboard`). **This repo has no `lucide-react` dependency and must
not gain one**: the six pieces of built-in chrome (hamburger, close, chevron, changelog,
help, sign-out) are inline SVGs, so a consumer with a different icon set pays nothing.

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
