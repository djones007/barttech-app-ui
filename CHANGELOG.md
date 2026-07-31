# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — grouped by date, newest first. Entries use **Added** (new features), **Changed** (behavior changes), **Fixed** (bug fixes), **Removed** (deleted features).

## [2026-07-31zb] — security-review: stop flagging first-party submodule pointer bumps

### Changed
- **Submodule paths are now excluded from the diff the weekly security review reads.** A pointer
  bump shows up in `git diff` as a one-line gitlink change, which the reviewer consistently read as
  an "unreviewed third-party dependency change" and opened a critical issue for. Every one of those
  was a false positive: the submodules are first-party private repos in the same account
  (`barttech-web-core`, `barttech-app-ui`, `barton-lms-engine`), and their code is reviewed in its
  own repo, not here — the gitlink carries no reviewable code at all.
- This was the single largest source of noise in the backlog: **all five** open security issues on
  `ownerfoundry-website` were this one false positive firing on `src/lms` bumps, and several flagged
  commits actually *tightened* access control. Real findings were getting buried under it.

Found in the 2026-07-31 estate security sweep.

## [2026-07-31z] — Dependency security: brace-expansion DoS patched

### Fixed
- **`brace-expansion` bumped to the patched 1.1.18 / 5.0.9 lines** (GHSA-mh99-v99m-4gvg,
  GHSA-3jxr-9vmj-r5cp — DoS via unbounded/exponential expansion). Reached transitively through the
  ESLint and build toolchain, so not reachable from a web request, but it was the estate's single
  largest source of `npm audit` highs.
- **Lockfile-only change — `package.json` is untouched.** The declared ranges (`^1.1.7`, `^5.0.5`)
  already permitted the patched versions, so no override, no dependency bump, and no ESLint major
  was needed. Both patches were published 2026-07-30; Socket and the npm advisory DB still reported
  "no patch available" because their data predates them.
- Rejected during triage: `npm audit fix` (would have pulled unrelated majors — Stripe 18→22 in
  checkout-engine) and an ESLint v10 / eslint-config-next v12 upgrade (the latter a four-major
  *downgrade* against Next 16, and ESLint majors are on deliberate estate-wide hold).

Found in the 2026-07-31 estate security sweep. This repo now reports 0 critical and 0 high.

## [2026-07-31d] — `external` nav rows

### Added
- **`external?: boolean` on `NavLinkItem` and `NavChildItem`.** Purely additive — every existing
  prop and export is unchanged, so no consumer has to move.

  A row marked `external` points at a *different application* rather than a route in this one.
  `command-center` has three (the Support Engine, the Lead Engine, BartMail) and they were being
  rendered through `next/link` as ordinary same-tab navigations: the user was dumped out of the app
  with no way back, and nothing in the row warned them beforehand. An external row now renders as a
  plain `<a target="_blank" rel="noopener noreferrer">` — not `next/link`, because there is no
  client-side route to push and nothing cross-origin for the router to prefetch — with a small
  external-link glyph (a new inline SVG; this repo still has no icon library and must not gain one)
  and an `sr-only` "(opens in a new tab)", since a glyph on its own tells a screen-reader user
  nothing.

### Changed
- **Active-state checks go through a new `isRowActive(pathname, item)` helper**, which
  short-circuits `external` rows to `false` before consulting the existing `isActive` string check.
  Both are internal; the export surface is untouched.

  Skipping the check matters more than "an external row should not look active". `usePathname()`
  returns a path and can never equal an absolute URL, so the comparison is structurally always
  false — but it also feeds `hasActiveChild`, which decides whether a collapsed group highlights
  and whether a group auto-expands for the current route. Left in, it was dead work re-run on every
  route change over URLs it could never match. The pinned Changelog and Help rows still call
  `isActive` directly, since those hrefs are internal by definition.

## [2026-07-31c] — `SaveButton`

### Added
- **`SaveButton.tsx`** — submit button for a server-action form that reports in-flight ("Saving…",
  disabled) and just-finished ("Saved", briefly) state, with a `role="status"` announcement so the
  confirmation is not purely visual.

  The default shape for a server-action form is a plain `<button type="submit">Save</button>`, and on
  a fast save that is indistinguishable from a broken button: the action runs, the route revalidates,
  and the page re-renders with the values it already had. Nothing moves. Users respond by clicking
  again or reloading to check — and a double submit on a non-idempotent form is a real bug, not just
  an annoyance. Promoted here rather than kept per-repo because it is a generic mechanism with no
  brand surface, which is exactly this repo's remit.

  It has to be a client component: `useFormStatus()` only reports a form's status when read from a
  component rendered *inside* that `<form>`, so the page owning the form cannot read it — a
  constraint of the hook, not a styling preference.

## [2026-07-31b] — Bulk selection primitive; `DataTable` promoted here

### Added
- **`BulkActions.tsx`** — `useBulkSelection` (hook), `BulkActionBar`, `BulkCheckbox`, and the
  `BulkAction`/`BulkSelection` types. Deliberately **separate from `DataTable`**: bulk selection is
  not a table feature. `support-engine`'s spam queue renders as cards (a body preview does not
  survive a table cell) and needs identical select / select-all / act-on-many behaviour — it calls
  the hook directly. `DataTable` is simply the most common consumer of the same primitive.
- **`DataTable.tsx` + `DateRangePicker.tsx`** promoted from `barttech-next-template`. All four repos
  carrying it (`barttech-next-template`, `competition-engine`, `lead-engine`, `support-engine`) had
  **byte-identical** 597-line copies — verified by md5 before moving. Promoted at the point where
  nothing had diverged, which is the only cheap moment to do it; after drift it is a merge, not a
  move. `DateRangePicker` came along because `DataTable` imports it.
- **Generic `actions: BulkAction[]` prop on `DataTable`**, so a queue can offer real domain actions
  ("Release to ticket", "Denylist sender", "Set priority") instead of only Edit/Archive/Delete.
  Actions are bulk-bar-only unless they set `row: true`; a queue with six bulk actions does not want
  six buttons on every row. Destructive actions (`danger: true`) confirm by default.
- **Select-style actions** — an action declaring `options: {value,label}[]` renders a `<select>` in
  the bar and passes the chosen value to `run` as its second argument. This is the shape "Set
  status" / "Set priority" / "Assign to" actually have: a fixed verb with a variable object.
  Without it each value needs its own button, and a real queue (three statuses × four priorities ×
  N agents) produces a bar nobody can use. Fires on change with no separate Apply, and resets to the
  placeholder so the same value can be applied twice in a row.

### Fixed
- **Selection is now keyed by a stable row id, not an array index.** The pre-promotion copies stored
  selected *indices* into the unsorted source array, so re-sorting, re-filtering, or a server
  revalidation between selecting and clicking would apply the action to whichever rows now sat at
  those positions. Silent, and the failure mode is "bulk action hit the wrong records" — not
  cosmetic. `getRowId` defaults to `row.id`; pass it explicitly when rows have no `id`.
- **Selected ids that leave the visible set are dropped**, so the "N selected" count can never claim
  more than is actually actionable after a delete or a revalidate.
- **The bulk bar disables itself while an action runs.** Double-clicking "Delete" previously fired
  two server actions against the same rows.

### Changed
- `onEdit` / `onArchive` / `onDelete` are unchanged for callers — they are mapped internally onto the
  new `actions` array so there is one code path rather than two. Golden rule 4: add, do not break.

## [2026-07-31] — Dependency updates (Dependabot #1, #2)

### Changed
- `actions/checkout` v5 → v7 and `actions/setup-node` v5 → v7 in `.github/workflows/ci.yml` (#1).
- `globals` 16.5.0 → 17.7.0 (#2) — a dev-only major, in the ESLint ecosystem but **not** one of the three estate-wide holds (`typescript`, `eslint`, `@eslint/*`). This repo's CI runs a real `npm run lint` plus `npm run typecheck`, both green on the PR, so it was merged rather than held: the documented reason for the holds is that a lint-less repo can merge a breaking ESLint major on a green tick, which does not apply here.
- Recorded retrospectively during the 2026-07-31 wrap. Both PRs were merged on 2026-07-30 without an entry — a squash-merge of a Dependabot PR touches only `package.json`/`package-lock.json`/workflow files, so nothing forces the changelog the way an ordinary commit does. A merge to `main` is still a change to this repo and gets an entry like any other.

## [2026-07-25e] — Consumer table: `cloud-plus-v2` (the tab-based one)

### Changed
- Docs only. **`cloud-plus-v2` is now the seventh consumer**, so the "deliberately out of scope — tab-based admin" carve-out is gone. It was correct that a tab switcher is not a `variant` of this component; what it was not is a reason to leave one app on a different shell. That repo converted its eight tabs into eight `/admin/*` routes and mounted this component unchanged — no new prop, no fork. Its `homeHref` is `/admin` and the row pointing there carries `exact`, exactly like `checkout-engine`.
- The lesson worth keeping: **the answer to a consumer with a different navigation model is to change the consumer's model, not to add a flag here.** Every one of the seven now shares the same shell, which is the point.

## [2026-07-25d] — Consumer table: `command-center`, `bartmail`, `barton-lms`

### Changed
- Docs only. The three apps that already had their own left nav are now mounted, so they move out of "intended consumers" and into the table: `command-center` (branch `master`), `bartmail`, `barton-lms`. Six consumers total; `cloud-plus-v2` remains deliberately out of scope (tab-based admin).
- **Recorded the one thing this component cannot express**, found mounting `barton-lms`: it is dark-themed, and `style` covers the `<aside>` but explicitly not the rows, so passing its dark surface would have put `text-slate-600` labels on `#1a1a2e`. It mounted **without** `style`, taking the standard light shell. `style` must stop being offered as the answer for a dark consumer — the answer is a themed variant, designed properly, not a third half-working prop.

## [2026-07-25c] — Name every border colour explicitly

### Fixed
- **`border-r`, `border-b` (×2) and `border-t` on the shell now name `border-slate-200`.** Tailwind v4's default border colour is `currentColor`, not v3's `gray-200`, so an unqualified `border-*` took its colour from whatever text colour the *consumer's* `body` happened to set. The sidebar therefore rendered differently in every app: near-black 1px borders in `bartmail` (`body { color: #171717 }`), effectively invisible ones in `barton-lms` (`body { color: #e2e2f0 }`), and correct gray-200 only in `command-center` — which looked right purely by accident, because it carries the Tailwind v3 border-colour compat shim in its `globals.css` and the other two do not.

  Found while mounting the second and third consumers. Nothing catches it: `tsc`, lint and the production build are all green either way, and the class names are unchanged — only the resolved colour differs. Same category as the `@source` requirement, and the reason a shared UI component must never rely on a framework *default* that a consumer can silently redefine.

  Visible change for `command-center` is gray-200 (`#e5e7eb`) → slate-200 (`#e2e8f0`) — imperceptible, and it matches the `border-slate-200` this component already used on group children.

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
