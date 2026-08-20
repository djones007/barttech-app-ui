# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — grouped by date, newest first. Entries use **Added** (new features), **Changed** (behavior changes), **Fixed** (bug fixes), **Removed** (deleted features).
## [2026-08-20] — `LeftNav` gains `signOutHref`

### Added

- **`LeftNav` prop `signOutHref?: string`** — renders Sign out as a plain `<a href>` GET navigation rather than a button bound to a server action. Takes precedence over `onSignOut` when both are passed.

### Why

A framework that content-hashes server-action IDs per build assigns a new ID on every deployment. A user who had the app open *before* a deploy and then clicks Sign out sends the old ID to the new deployment, which has never heard of it — the request fails with *"Failed to find Server Action"*. One consumer shipped that pattern and it surfaced as recurring Sentry errors on its highest-traffic route.

It is invisible in local development and in review: a local session never spans a deployment, so the bug only exists in the gap between two builds. A plain anchor carries no action ID and therefore has no deployment boundary to fall off.

`onSignOut` is unchanged and still supported — golden rule 4, and it remains the right choice where sign-out must do work a GET should not.

## [2026-08-16]

### Changed

- Bumped transitive `nanoid` to 3.3.18 (GHSA high: infinite loop on zero-size custom generator). Lockfile only; reached via postcss, unreachable code path in this app.

## [2026-08-12c] — `softPair`, and Pill defaults to a soft tone

### Added
- **`softPair(colour)`** — a pale tint of the colour behind dark, saturated text of the same hue. Guarantees AA like `accessiblePair`, but *aims* for AAA (7:1) rather than stopping at the floor.
- **`Pill` gains `tone?: "soft" | "solid"`, defaulting to `soft`.** `solid` keeps the old behaviour for the cases where a block of colour is the point.

### Why
The solid treatment shipped, met AA, and was **still reported as hard to read**. That is the useful part: near-black on saturated red is 4.50:1 and on saturated orange 6.33:1 — both compliant, neither comfortable across a list of ninety chips. **Meeting AA is a floor, not evidence that something is pleasant to read.**

The first attempt at `softPair` repeated the same mistake in new clothing: it stopped darkening at the first shade clearing AA and landed red at 4.58:1. Its own test caught that, which is why the test now asserts a *margin* above the minimum rather than a pass. Measured on the real palette:

| Colour | Solid (black text) | Soft |
|---|--:|--:|
| Saturated red `#ff0000` | 4.50 | **7.22** |
| Saturated orange `#f97316` | 6.33 | **7.09** |
| Saturated yellow `#ffea00` | 14.38 | 7.44 |
| Mid green `#008000` | 5.14 | 7.49 |
| Pure blue `#0000ff` | 8.59 | 7.02 |

Hue is untouched — a red chip is dark red on pale pink, still unmistakably red. `PillDot` is unchanged: a swatch must show the stored colour.


## [2026-08-12b] — Patch js-yaml advisory (dev-only)

### Fixed
- `overrides.js-yaml` pinned to `^4.3.1`, clearing a high-severity Dependabot alert (quadratic CPU consumption in `!!omap` resolution). It reached this repo as a **dev-only** transitive of `eslint` → `@eslint/eslintrc`, and this repo is source-only so nothing here is ever shipped or executed in a consumer — but a permanently red alert on the default branch is noise that trains people to ignore the next one.


## [2026-08-12] — Readable chips: `contrast.ts` + `Pill`

### Added
- **`contrast.ts`** — WCAG 2.1 contrast maths (`relativeLuminance`, `contrastRatio`, `parseColor`, `toHex`) plus `accessiblePair(colour)`, which returns a background/foreground pair guaranteed to meet a minimum ratio (AA by default). Pure TypeScript, no React, no dependencies.
- **`Pill.tsx`** — `Pill` and `PillDot`. `Pill` is a coloured chip whose foreground is derived from its background rather than hard-coded. `PillDot` is a plain swatch and deliberately does *not* adjust the colour — it carries no text, so the AA rule does not apply, and a swatch presented as "your colour" must be the stored value rather than an adjusted neighbour of it. Both are server-safe: no hooks, no `'use client'`.
- **`contrast.test.ts` + `npm test`, wired into CI** — sweeps 4,096 colours across the sRGB cube and fails if any produces a sub-AA pair, independently re-measuring each returned pair instead of trusting the reported ratio.
- `@types/node` devDependency and `.testbuild/` ignores, for the `node --test` runner (same arrangement as the estate's other shared module).

### Why
A chip that takes its background from data and writes `text-white` in the markup is readable against the colour it was built with and invisible against the next one someone picks — white on `#ffea00` is 1.23:1. Nothing in a normal pipeline catches it: not `tsc`, not lint, not the build. Deriving the foreground makes the unreadable combination unrepresentable.

Notably, picking the better of black-or-white is **not** enough — pure red fails against both (4.00:1 and 4.44:1), so `accessiblePair` nudges background lightness in HSL, preserving hue and saturation, for the 6% of colours that need it.


## [2026-08-11] — Security hardening: CI persist-credentials (Aikido audit)

### Fixed
- Added `persist-credentials: false` to all `actions/checkout` steps in GitHub Actions workflows. Prevents the GitHub Actions token from persisting in the git credential helper after checkout, reducing blast radius if a subsequent workflow step is compromised (Aikido issue 11).


## [2026-08-01b] — accent prop on LeftNav

### Added
- **`accent?: string` prop on `LeftNav`** — hex colour applied to the app logo square and the active nav row background. Defaults to `#0f172a` (slate-900, existing behaviour). Must have ≥ 4.5:1 contrast against white. Uses inline `backgroundColor` style to avoid Tailwind safelisting constraints.

## [2026-08-01 — later] — Public-hygiene CI gate

### Added
- **`.github/workflows/public-hygiene.yml`** — on every push to main, scans the whole tree
  against a denylist of terms that must never appear in this public repo. The list itself
  lives in a repo secret (committing it would republish the strings it polices); the job
  fails closed if the secret is unset, and reports offending files by term number only.

## [2026-08-01a] — Clarified the public-repo scope rule

### Fixed
- **Resolved an inconsistency between this repo's public-scope warning and other documentation in it that had drifted into naming specific consumer applications and brands.** The rule is unchanged and strict: no secrets, keys, tokens, `.env` values, customer data, brand names, internal repo names, live domains, or estate-architecture detail belong in this repo. Consumer-specific detail (which apps mount this, at what path, and any per-consumer notes) has been moved out of this repo entirely and is now maintained privately, alongside the tooling that reads it.

## [2026-08-01] — Selection keys can no longer collapse; legacy `onDelete` confirms

### Fixed
- **`DataTable`'s default row identity no longer gives every id-less row the same key.** It was
  `String(row.id ?? "")`, so a row set whose objects have no `id` field collapsed onto the single
  key `""`. The user ticks one checkbox, the bar reports "1 selected" (correctly — it is tracking
  one distinct *key*), and `run(selectedRows)` is handed **every row on the page**. In front of a
  bulk delete that is data loss from one click, and it is silent: nothing in the UI shows it.
  Found in the 2026-08-01 security audit. No consumer was affected by the bug at the time it was
  found — every consumer using it already passed `getRowId` explicitly — which is precisely what
  made it a landmine for the next consumer to render a table of rows with no natural `id`.

  The default is now `createRowIdFallback()`, which keys those rows by **row object identity** via
  a `WeakMap`. Unique per row by construction, stable across sorting, filtering and paging (same
  objects, reordered), and when the parent refetches and produces new objects the old keys stop
  matching — `useBulkSelection` already drops ids that are no longer visible, so the selection
  *clears*. Losing a selection is a safe failure; acting on rows the user never ticked is not.

  **Index-keying was deliberately not used as the fallback.** It is unique-per-render, but it is
  also the exact bug the 2026-07-31 promotion removed: indices move under a re-sort, a re-filter
  or a server revalidation, so the action lands on whichever rows now sit in those slots. The
  file's own header documents that; re-introducing it to fix this would have traded one silent
  wrong-rows bug for another.

- **`useBulkSelection` now flags a duplicate-key `getId` in dev.** The fallback only covers callers
  who supply nothing; a caller-supplied `getId` that collapses rows (`getId={(r) => r.type}`) has
  the same failure and cannot be repaired from inside the hook. It now `console.error`s whenever
  the key set is smaller than the row set, naming both counts. Cheap — the `Set` was already being
  built — and it is the check that would have caught this class of bug on day one.

### Changed
- **The legacy `onDelete` prop now confirms before it runs.** It mapped to `confirm: false`, with a
  comment asserting that legacy `onDelete` callers ran their own confirmation. Checked across every
  known consumer on 2026-08-01: **nothing used the prop that way** — every real `onDelete` caller
  either declared its own `actions` entries with an explicit `confirm`, or was unrelated to this
  path entirely. So the flag protected no caller and only pre-armed an unconfirmed bulk delete for
  the next consumer to use the shorthand. `danger: true` now supplies the standard confirmation.
  Behaviour change on paper, no-op in practice; opt out by declaring the action through `actions`
  with `confirm: false`.

### Added
- **`createRowIdFallback(context?)` exported from `BulkActions.tsx`** — additive, per golden rule 4.
  Direct hook callers (a card list, e.g. a queue rendered as cards rather than table rows) get the
  same safe default as `DataTable`. Call it once per list from a `useState` initialiser: the
  generated keys live in its closure, so rebuilding it every render would re-key every row and
  nothing would stay selected. It throws on non-object rows, where there is genuinely no identity
  to key on.
- **`.env` patterns in `.gitignore`** (`.env`, `.env.*`, `.env.local`, `.env.*.local`). This repo is
  public and holds no runtime config, so there should never be an env file here at all — ignored
  anyway, because the cost is one line and the cost of the other outcome is a secret in a public
  repo. Brings it in line with the estate repo baseline.

### Security
- **Dependabot alerts and automated security fixes enabled** on the GitHub repo. The
  `.github/dependabot.yml` *version-update* config was already correct, but the alert toggles were
  off — meaning the monthly PRs flowed while an actual advisory against the pinned toolchain would
  have raised nothing. `npm audit` is clean today; the point is what happens when it is not.

Verified with a throwaway jsdom + `react-dom/client` harness (not committed — this repo has no test
runner and adding one for a single case was not worth the devDependency): render five rows with no
`id` and no `getRowId`, tick one checkbox → one row checked, badge reads "1 selected", the action
receives exactly one row, and that row is the one ticked; selection follows its row through two
re-sorts; select-all still yields five. Re-run against the pre-fix build, the same harness reports
the action receiving all five rows from one tick. `npm run lint` and `npm run typecheck` green.

## [2026-07-31z] — Dependency security: brace-expansion DoS patched

### Fixed
- **`brace-expansion` bumped to the patched 1.1.18 / 5.0.9 lines** (GHSA-mh99-v99m-4gvg,
  GHSA-3jxr-9vmj-r5cp — DoS via unbounded/exponential expansion). Reached transitively through the
  ESLint and build toolchain, so not reachable from a web request, but it was one of the estate's
  largest sources of `npm audit` highs.
- **Lockfile-only change — `package.json` is untouched.** The declared ranges (`^1.1.7`, `^5.0.5`)
  already permitted the patched versions, so no override, no dependency bump, and no ESLint major
  was needed. Both patches were published 2026-07-30; Socket and the npm advisory DB still reported
  "no patch available" because their data predates them.
- Rejected during triage: `npm audit fix` (would have pulled unrelated majors into consuming repos)
  and an ESLint v10 / eslint-config-next v12 upgrade (the latter a four-major *downgrade* against
  Next 16, and ESLint majors are on deliberate estate-wide hold).

Found in the 2026-07-31 estate security sweep. This repo now reports 0 critical and 0 high.

## [2026-07-31d] — `external` nav rows

### Added
- **`external?: boolean` on `NavLinkItem` and `NavChildItem`.** Purely additive — every existing
  prop and export is unchanged, so no consumer has to move.

  A row marked `external` points at a *different application* rather than a route in this one.
  At least one consumer needed several such rows, and they were being rendered through `next/link`
  as ordinary same-tab navigations: the user was dumped out of the app with no way back, and
  nothing in the row warned them beforehand. An external row now renders as a plain
  `<a target="_blank" rel="noopener noreferrer">` — not `next/link`, because there is no
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
  not a table feature. At least one consumer renders a queue as cards (a body preview does not
  survive a table cell) and needs identical select / select-all / act-on-many behaviour — it calls
  the hook directly. `DataTable` is simply the most common consumer of the same primitive.
- **`DataTable.tsx` + `DateRangePicker.tsx`** promoted out of an earlier shared template. All
  known consumer copies at the time were **byte-identical** 597-line copies — verified by md5
  before moving. Promoted at the point where nothing had diverged, which is the only cheap moment
  to do it; after drift it is a merge, not a move. `DateRangePicker` came along because `DataTable`
  imports it.
- **Generic `actions: BulkAction[]` prop on `DataTable`**, so a queue can offer real domain actions
  ("Release", "Denylist", "Set priority") instead of only Edit/Archive/Delete.
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

## [2026-07-25e] — Tab-based consumer converted to routes

### Changed
- Docs only. A consumer whose admin area used to be tab-based (a single page switching
  several components on client state) is now mounted like every other consumer — the
  "deliberately out of scope" carve-out for it is gone. It was correct that a tab
  switcher is not a `variant` of this component; what it was not is a reason to leave one
  app on a different shell. That consumer converted its tabs into real routes and then
  mounted this component unchanged — no new prop, no fork. Its home route carries `exact`
  on the row that points at it, matching the pattern used by other root-mounted consumers.
- The lesson worth keeping: **the answer to a consumer with a different navigation model is to change the consumer's model, not to add a flag here.** Every known consumer now shares the same shell, which is the point.

## [2026-07-25d] — Three more consumers mounted

### Changed
- Docs only. Three more apps that already had their own left nav are now mounted, moving them out of "intended consumers" and into active use.
- **Recorded the one thing this component cannot express**, found while mounting a dark-themed consumer: `style` covers the `<aside>` but explicitly not the rows, so passing its dark surface would have put `text-slate-600` labels on a dark background. It mounted **without** `style`, taking the standard light shell. `style` must stop being offered as the answer for a dark consumer — the answer is a themed variant, designed properly, not a third half-working prop.

## [2026-07-25c] — Name every border colour explicitly

### Fixed
- **`border-r`, `border-b` (×2) and `border-t` on the shell now name `border-slate-200`.** Tailwind v4's default border colour is `currentColor`, not v3's `gray-200`, so an unqualified `border-*` took its colour from whatever text colour the *consumer's* `body` happened to set. The sidebar therefore rendered differently in every app: near-black 1px borders in one consumer, effectively invisible ones in another, and correct gray-200 only in a third — which looked right purely by accident, because it happened to carry a Tailwind v3 border-colour compat shim in its `globals.css` while the others did not.

  Found while mounting the second and third consumers. Nothing catches it: `tsc`, lint and the production build are all green either way, and the class names are unchanged — only the resolved colour differs. Same category as the `@source` requirement, and the reason a shared UI component must never rely on a framework *default* that a consumer can silently redefine.

  Visible change for the third consumer above is gray-200 (`#e5e7eb`) → slate-200 (`#e2e8f0`) — imperceptible, and it matches the `border-slate-200` this component already used on group children.

## [2026-07-25b] — `exact` on nav entries; first three consumers mounted

### Added
- **`exact?: boolean` on `NavLinkItem` and on group children**, plus the exported type `NavChildItem` (previously an inline anonymous type). The active check matches whole path *segments*, so a row stays lit on its descendants — right for an orders route staying lit on its sub-pages, wrong for a row that is an ancestor of the entire rest of the nav. One consumer's Dashboard row points at its own admin root, so without this it would render active on every other admin page at once. `/` was already special-cased for exactly this reason; `exact` generalises it. Purely additive — omitted, behaviour is identical to before.

### Changed
- `NavLinkRow` is now given its props explicitly rather than by spreading the nav item, so a new field on the item type cannot silently leak through as an unknown DOM-bound prop.

### Consumers
First three mounts, all at `src/app-ui` (each repo's `@/*` maps to `./src/*`):
- The first consumer's existing nav component became a shim; no call site changed.
- Two more consumers had no admin nav at all previously. Added via a client `AdminShell` wrapper inside the existing admin layout, which keeps that layout's forced `colorScheme: light` (the admin must not follow the visitor's OS dark mode) and its existing fonts/metadata.

Both new consumers pass `changelogHref={null}` / `helpHref={null}` (no such pages) and hide the nav on their login page — a sign-in screen must not advertise the app's route map, and the nav's sign-out row is meaningless there.

## [2026-07-25] — repo created: shared app-shell UI

### Added
- **`LeftNav.tsx`** — the estate's left-hand navigation sidebar, promoted from an earlier
  shared template's own component. Exports `LeftNav` plus the types
  `NavItem`, `NavLinkItem`, `NavGroupItem`, `LeftNavProps`. The original seven props
  (`appName`, `appInitial`, `navItems`, `userEmail`, `onSignOut`, `changelogHref`,
  `helpHref`) are unchanged, so the source template needs only a re-export shim.
- Six optional additive props so real consumers fit without forking:
  `homeHref` (apps rooted under a nested admin path), `widthClassName` (different
  consumers need different sidebar widths), `className` + `style` (a consumer that themes
  with inline style objects and CSS custom properties), `footer` (a slot, instead of a
  prop per app), and `changelogHref`/`helpHref` now accept `null` to hide a row (some
  consumers' admin areas have no such pages, and a pinned row that 404s is worse than
  no row). All documented in `README.md`.
- Repo baseline: `package.json` (source-only, no build, `lint` + `typecheck` scripts),
  `tsconfig.json` (`noEmit`, `strict`, `jsx: react-jsx`), `eslint.config.mjs`,
  `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitignore`, `README.md`,
  `CLAUDE.md`, this changelog.

### Changed (relative to the source template's version, folded in from an internal dashboard's own nav component)
- The `isActive` and group-open-state rationale comments — the internal dashboard's copy carried
  the *why* (a plain `startsWith` marks one route active while you are on a similarly-prefixed
  sibling route, because one string is a prefix of the other; group-open is derived
  from the route rather than seeded once, so the section you are in stays expanded after a
  client-side navigation). The template's copy had the code without the reasoning, which is
  exactly the comment a future edit deletes.
- The collapsed-group-with-active-child rationale, likewise folded in from that dashboard's own component.

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

### Why a separate repo rather than the estate's shared core module
That module is deliberately pure TypeScript with no React and no Next, and it is
mounted in a dozen repos including brand marketing sites that will never have an admin nav. A
`.tsx` importing `react`/`next` there is type-checked by every one of those consumers —
which already broke a build the same day this repo was created, when one consumer's
overly broad TypeScript `include` pattern type-checked a core-module file whose external
dependency import that consumer did not have. UI therefore gets its own repo, mounted
only where it is used.

### Why public
A generic nav shell has no secrets and no IP. Public means Vercel and `actions/checkout`
clone the submodule natively, with no extra token plumbing — plus free secret
scanning, push protection and Actions minutes. The estate's other private shared submodules
are private only where they expose an access-control or entitlement model; that reasoning
does not transfer to a nav shell.

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
