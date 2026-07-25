# @barttech/app-ui

Shared **app-shell UI** for the Barttech estate — the brand-neutral chrome that every
internal tool, admin portal and customer portal wraps itself in, so it is written once
here instead of copy-pasted and drifted across a dozen repos.

This is a **source-only** repo — nothing here is built or published. It is mounted into
each consuming app as a **git submodule** and transpiled by that app's Next.js build,
exactly like [`barttech-web-core`](https://github.com/djones007/barttech-web-core) and
`barton-lms-engine`. **Not a deployable app — no Vercel project.**

## Why this is a separate repo from `barttech-web-core`

`barttech-web-core` is deliberately **pure TypeScript with no React and no Next**, and
it is mounted in 12 repos — including brand marketing sites that will never have an
admin nav. A `.tsx` file importing `react`/`next` in that repo would be type-checked by
every one of those consumers, whether or not they have those packages resolvable. That
is not hypothetical: `chillingscreams-games` broke on 2026-07-25 because its
`include: ["**/*.ts"]` type-checked web-core's `audit.ts`, whose `@supabase/supabase-js`
import that repo does not have.

So UI gets its own repo, mounted **only where it is used**. Precedent:
`barton-lms-engine` is exactly this pattern.

## What lives here

| File | Exports |
|------|---------|
| `LeftNav.tsx` | `LeftNav`, and the types `NavItem`, `NavLinkItem`, `NavChildItem`, `NavGroupItem`, `LeftNavProps` — the left-hand sidebar shell: app header, link/group nav with accordions, off-canvas mobile drawer, and a pinned bottom block (Changelog · Help · signed-in email · Sign out). Client component (`"use client"`). |

There is no barrel `index.ts` — import the file directly (`@/app-ui/LeftNav`), matching
how web-core is consumed.

## `LeftNav` props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `appName` | `string` | — | Sidebar header + mobile top bar. |
| `appInitial` | `string` | first char of `appName` | Letter in the logo square. |
| `navItems` | `NavItem[]` | — | Mix `{ kind: "link" }` and `{ kind: "group" }` entries. Each link (and each group child) takes an optional `exact` — see below. |
| `userEmail` | `string` | — | Shown above Sign out. |
| `onSignOut` | `() => void` | — | Pass a server action. Omit and the row is not rendered. |
| `changelogHref` | `string \| null` | `"/changelog"` | `null` hides the row. |
| `helpHref` | `string \| null` | `"/help"` | `null` hides the row. |
| `homeHref` | `string` | `"/"` | Where the logo/app-name links. |
| `widthClassName` | `string` | `"w-60"` | **Replaces** the default width class. |
| `className` | `string` | — | Appended to the `<aside>` classes. |
| `style` | `React.CSSProperties` | — | Inline style on the `<aside>`. |
| `footer` | `React.ReactNode` | — | Rendered in the bottom block, above Changelog/Help. |

The first seven are the API this component already had in `barttech-next-template`, kept
unchanged so that repo needs only a re-export shim. The rest were added here to fit the
real consumers without any of them having to fork:

- **`homeHref`** — `barton-lms`, `checkout-engine` and `ownerfoundry-website` all mount
  their admin under `/admin/*`. Hardcoding `/` made the header link a route *out* of the
  app shell.
- **`widthClassName`** — `command-center` is `w-60`, `barton-lms` is `w-56`/220px. This
  **replaces** rather than appends because two competing Tailwind width classes in one
  string resolve by stylesheet order, not string order, and this repo carries no
  `tailwind-merge`. Keep the page layout's left padding in step (`md:pl-60` by default).
- **`className` / `style`** — for a consumer that themes with inline `style={{}}` objects and
  CSS custom properties (`background: "var(--surface)"`) rather than Tailwind colour classes.
  `style` covers the shell; **it does not restyle the individual rows** — a fully themed
  variant is not solved yet and should not be faked with a prop that half-works. In practice
  that limit bites: `barton-lms` is dark-themed and mounted **without** `style`, because
  styling only the `<aside>` dark would have left this component's `text-slate-600` row
  labels illegible on it. A dark consumer gets the light shell until a real themed variant
  is designed.
- **`footer`** — a slot for an environment badge / tenant switcher / version string,
  rather than growing a prop per app.
- **`exact` on a nav entry** — the active check matches whole path *segments*, so a row is
  active on its descendants too (`/admin/orders` keeps the Orders row lit on
  `/admin/orders/abc`). That breaks down for a row that is an ancestor of the whole rest
  of the nav: `checkout-engine`'s Dashboard points at `/admin`, and without `exact: true`
  it would render active on `/admin/orders`, `/admin/settings` and every other page. `/`
  is always treated as exact for the same reason.
- **`changelogHref: null` / `helpHref: null`** — `checkout-engine`'s and
  `ownerfoundry-website`'s admin areas have no `/changelog` or `/help` page, and a pinned
  nav row that 404s is worse than no row.

`cloud-plus-v2`'s admin is **tab-based**, not a sidebar. Deliberately not addressed —
that is a different shell, not a variant of this one.

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
and GitHub Actions clone it natively — no `GITHUB_GIT_TOKEN` plumbing.

Phase 1 (this commit) creates and publishes the repo only. Mounting it in consumers is a
later, separate pass — there are no consumers yet.

## Why it has its own CI

Same reason web-core does: a shared module vendored into N repos and linted only as a
side effect of being vendored means one error here reddens N builds at once, against
files none of those repos may edit — a fix made in a consumer's copy is discarded on the
next pointer bump. The gate belongs where the source lives.
