# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — grouped by date, newest first. Entries use **Added** (new features), **Changed** (behavior changes), **Fixed** (bug fixes), **Removed** (deleted features).

## [2026-07-25b] — `exact` on nav entries; first three consumers mounted

### Added
- **`exact?: boolean` on `NavLinkItem` and on group children**, plus the exported type `NavChildItem` (previously an inline anonymous type). The active check matches whole path *segments*, so a row stays lit on its descendants — right for `/admin/orders` → `/admin/orders/abc`, wrong for a row that is an ancestor of the entire rest of the nav. `checkout-engine`'s Dashboard points at `/admin`, so without this it would render active on `/admin/orders`, `/admin/settings` and every other admin page at once. `/` was already special-cased for exactly this reason; `exact` generalises it. Purely additive — omitted, behaviour is identical to before.

### Changed
- `NavLinkRow` is now given its props explicitly rather than by spreading the nav item, so a new field on the item type cannot silently leak through as an unknown DOM-bound prop.

### Consumers
First three mounts, all at `src/app-ui` (each repo's `@/*` maps to `./src/*`):
- **`barttech-next-template`** — `src/components/LeftNav.tsx` became a shim; no call site changed.
- **`checkout-engine`** — `/admin` had no nav at all. Added via a client `AdminShell` wrapper inside the existing `admin/layout.tsx`, which keeps that layout's forced `colorScheme: light` (the admin must not follow the visitor's OS dark mode).
- **`ownerfoundry-website`** — `/admin` had no nav at all. Same pattern, keeping the layout's fonts and `noindex` metadata.

Both new consumers pass `changelogHref={null}` / `helpHref={null}` (no such pages) and hide the nav on their login page — a sign-in screen must not advertise the app's route map, and the nav's sign-out row is meaningless there.

## [2026-07-25] — repo created: shared app-shell UI

### Added
- **`LeftNav.tsx`** — the estate's left-hand navigation sidebar, promoted from
  `barttech-next-template/src/components/LeftNav.tsx`. Exports `LeftNav` plus the types
  `NavItem`, `NavLinkItem`, `NavGroupItem`, `LeftNavProps`. The original seven props
  (`appName`, `appInitial`, `navItems`, `userEmail`, `onSignOut`, `changelogHref`,
  `helpHref`) are unchanged, so the template needs only a re-export shim.
- Six optional additive props so the real consumers fit without forking:
  `homeHref` (apps rooted at `/admin/*`), `widthClassName` (command-center `w-60` vs
  barton-lms `w-56`), `className` + `style` (barton-lms themes with inline style objects
  and CSS custom properties), `footer` (a slot, instead of a prop per app), and
  `changelogHref`/`helpHref` now accept `null` to hide a row (checkout-engine and
  ownerfoundry-website admin have no such pages, and a pinned row that 404s is worse than
  no row). All documented in `README.md`.
- Repo baseline: `package.json` (source-only, no build, `lint` + `typecheck` scripts),
  `tsconfig.json` (`noEmit`, `strict`, `jsx: react-jsx`), `eslint.config.mjs`,
  `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitignore`, `README.md`,
  `CLAUDE.md`, this changelog.

### Changed (relative to the template's version, folded in from `command-center/src/components/nav.tsx`)
- The `isActive` and group-open-state rationale comments — command-center's copy carried
  the *why* (a plain `startsWith` marks `/cloud-plus/cost-rules` active while you are on
  `/cloud-plus-quotes`, because one string is a prefix of the other; group-open is derived
  from the route rather than seeded once, so the section you are in stays expanded after a
  client-side navigation). The template's copy had the code without the reasoning, which is
  exactly the comment a future edit deletes.
- The collapsed-group-with-active-child rationale, likewise from command-center.

### Fixed
- `toggleGroup` read the captured `overrides` inside a `setOverrides` functional updater
  rather than `prev`, so two toggles in one render pass could drop one another. It now
  reads `prev`.
- `aria-current="page"` on the active nav row. A background colour is not a signal a
  screen reader can use, so the active row was previously indistinguishable from every
  other row.
- Escape now closes the off-canvas mobile drawer. Dismissing it required pointing at the
  backdrop — a keyboard trap.
- `aria-expanded` on the mobile hamburger, and explicit `type="button"` on every
  `<button>`. A shared component has no control over where a consumer mounts it, and the
  HTML default is `type="submit"` — inside a `<form>`, toggling a nav group would submit
  it.
- The bottom block no longer renders an empty bordered `<div>` when an app passes neither
  `userEmail` nor `onSignOut`.

### Why a separate repo rather than `barttech-web-core`
`barttech-web-core` is deliberately pure TypeScript with no React and no Next, and it is
mounted in 12 repos including brand marketing sites that will never have an admin nav. A
`.tsx` importing `react`/`next` there is type-checked by every one of those consumers —
which already broke a build today (`chillingscreams-games`, whose `include: ["**/*.ts"]`
type-checked web-core's `audit.ts` and its `@supabase/supabase-js` import that repo does
not have). UI therefore gets its own repo, mounted only where it is used. Precedent:
`barton-lms-engine`.

### Why public
A generic nav shell has no secrets and no IP. Public means Vercel and `actions/checkout`
clone the submodule natively, with no `GITHUB_GIT_TOKEN` plumbing — plus free secret
scanning, push protection and Actions minutes. `barton-lms-engine` is private only because
it exposes the paid-content access-control model; that reasoning does not transfer.

### Dependency choices
`react`, `react-dom` and `next` are **peerDependencies** — the consuming app supplies
them, and a second copy of React resolved from this submodule's tree would be a real bug
(duplicate hook dispatchers). They are also devDependencies purely so `tsc` can resolve
`next/link` and the JSX runtime while this repo checks itself; consumers never install
this package's dependencies and `node_modules/` is gitignored, so the submodule checkout
stays source-only.

ESLint is plain `typescript-eslint`, deliberately **not** `eslint-config-next` — this is
not a Next app (no `app/`, no `next.config`, no build), so that plugin's rules have
nothing to check here and would only import its version constraints.
`eslint-plugin-react-hooks` **is** included and is the one plugin that earns its place: a
conditional or early-returned hook call is a runtime crash in every consumer at once and
`tsc` does not see it, and `exhaustive-deps` covers the stale-closure class of bug the
group-open state is directly exposed to. `eslint-plugin-react` itself is not included —
its value is mostly prop-types and JSX correctness that TypeScript already covers.
`@typescript-eslint/no-explicit-any` is an **error**: an implicit `any` here becomes an
untyped value in every consuming app.

Dependabot carries the estate's TypeScript/ESLint major holds, plus holds on the
`next`/`react`/`react-dom`/`@types/react*` majors — those exist here only to type-check
against what consumers actually run, so auto-bumping a major would have this repo lead the
estate rather than track it.
