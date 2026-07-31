# barttech-app-ui — shared app-shell UI submodule (`@barttech/app-ui`)

The estate's single source of truth for **brand-neutral admin/app-shell UI**. Source-only,
no build — mounted as a **git submodule** in each app that has a dashboard or admin shell
and transpiled by that app's Next.js build, exactly like `barttech-web-core` and
`barton-lms-engine`. **Not a deployable app — no Vercel project. Never create one.**

## ⚠️ THIS REPO IS PUBLIC

`barttech-app-ui` is a **public** GitHub repo. **NEVER commit a secret, key, token, DSN,
`.env`, brand name, brand identifier, domain, or customer-facing copy here.**

**Why public:** a generic navigation shell has no secrets and no IP — it is layout and
`aria` attributes. Public means Vercel and `actions/checkout` clone the submodule
natively, with no `GITHUB_GIT_TOKEN` plumbing, no `SUBMODULE_TOKEN` in CI, and no
`fetch-submodules.sh` workaround (the private-submodule route is the source of the
empty-worktree/stale-cache bug that OF and BMB still carry guards for). Public repos also
get free secret scanning + push protection and free Actions minutes — both auto-enabled;
do not disable them.

Contrast `barton-lms-engine`, which stays **private**: it exposes the paid-content
access-control model. That reasoning does not transfer to a nav bar. Rule of thumb:
public only for generic, secret-free, no-IP mechanisms.

## Why this is not in `barttech-web-core`

`barttech-web-core` is deliberately pure TypeScript with **no React and no Next**, and it
is mounted in 12 repos including brand marketing sites that will never have an admin nav.
A `.tsx` file importing `react`/`next` there would be type-checked by every consumer —
which already broke a build on 2026-07-25 (`chillingscreams-games` failed because its
`include: ["**/*.ts"]` type-checked web-core's `audit.ts`, whose `@supabase/supabase-js`
import that repo does not have). So UI gets its own repo, mounted **only where it is
used**. Precedent: `barton-lms-engine`.

## Golden rules

1. **Brand-neutral app shell only.** Anything with a brand's name, palette, voice or
   legal obligation in it stays in the consuming repo. **The cookie banner is the
   standing example** — its *mechanism* lives in web-core (`consent.ts`,
   `adPlatforms.ts`) and its *component* stays per-repo, because brand styling differs
   and a restyle must never become a fork of the logic. Same test here: if a component
   can only be used by one brand, it does not belong in this repo.
2. **No `lucide-react`, and no icon library at all.** The built-in chrome icons are
   inline SVGs; consumers pass their own icon components in via the `icon` prop
   (`React.ElementType`). Adding an icon dependency would force it on every consumer
   including ones already using a different set.
3. **`react`, `react-dom` and `next` are peerDependencies, never dependencies.** The
   consuming app supplies them. A second copy of React resolved from this submodule's
   own tree is a real, hard-to-diagnose bug (duplicate hook dispatchers), not a
   duplication nit. They also appear in `devDependencies`, but only so `tsc` can resolve
   `next/link` and the JSX runtime while this repo checks itself — consumers never
   install this package's dependencies and `node_modules/` is gitignored, so the
   submodule checkout stays source-only.
4. **Keep the export surface backwards-compatible.** Consumers re-export these
   components; renaming or removing an export breaks every app at once. Add, do not
   break; deprecate before removing. `LeftNav`'s original seven props (`appName`,
   `appInitial`, `navItems`, `userEmail`, `onSignOut`, `changelogHref`, `helpHref`) are
   the API `barttech-next-template` already shipped — they do not change.
5. **Accommodate consumers with props, do not let them fork.** Every real consumer looks
   slightly different (different width, `/admin/*` root, inline CSS-variable theming, no
   changelog page). Each of those is one optional additive prop, documented in
   `README.md`. But do not invent props for hypothetical needs, and do not paper over a
   genuinely different shell with a `variant` flag: `cloud-plus-v2`'s admin was
   **tab-based**, and the fix was to give it real routes, not to teach this component
   to render tabs. See the note under the consumer table.
6. **Fix once → propagate.** After committing and pushing here, bump each consumer's
   submodule pointer and push (Vercel auto-deploys). Never `vercel --prod` a consumer to
   pick up a bump — a CLI deploy ships a source snapshot with no `.git`.

## What lives here

| File | Exports |
|------|---------|
| `LeftNav.tsx` | `LeftNav` + types `NavItem`, `NavLinkItem`, `NavChildItem`, `NavGroupItem`, `LeftNavProps`. Client component. Full prop table in `README.md`. |

**Nav rows can point out of the app.** `NavLinkItem` and `NavChildItem` both take an
optional `external?: boolean` (added 2026-07-31 for `command-center`, which links to the
Support Engine, Lead Engine and BartMail). An external row renders as a plain
`<a target="_blank" rel="noopener noreferrer">` with the built-in `IconExternal` glyph and
an `sr-only` "(opens in a new tab)" — not through `next/link`, because there is no
client-side route to push and nothing cross-origin for the router to prefetch.

External rows are **never active**, and the check is short-circuited rather than left to
fail: `usePathname()` returns a path and cannot equal an absolute URL, so the answer is
structurally always false, and the same comparison feeds `hasActiveChild` (which decides
group highlighting and auto-expansion). **Any new call site handling a nav entry must use
`isRowActive(pathname, item)`, not `isActive(pathname, href, exact)`** — `isActive` is the
lower-level string check and knows nothing about `external`.
| `BulkActions.tsx` | `useBulkSelection`, `BulkActionBar`, `BulkCheckbox` + types `BulkAction`, `BulkSelection`. Client component. |
| `DataTable.tsx` | `DataTable` + types `Column`, `DataTableProps`, and the `IconEdit`/`IconArchive`/`IconTrash` SVGs. Client component. |
| `DateRangePicker.tsx` | `DateRangePicker`, `presetToRange` + type `DateRange`. |
| `SaveButton.tsx` | `SaveButton`. Client component. Submit button for a server-action form; shows pending + saved state. Props: `children`, `className`, `savedLabel`, `pendingLabel`, `savedForMs`. |

No barrel `index.ts` — import the file directly (`@/app-ui/LeftNav`, `@/app-ui/SaveButton`), matching web-core.

## Bulk selection is a primitive, not a table feature

`useBulkSelection` + `BulkActionBar` live in `BulkActions.tsx` **separately from `DataTable`**,
and that separation is the point. `support-engine`'s spam queue renders as cards, not rows —
the body preview that makes a suppressed message reviewable does not survive a table cell —
but it needs identical select / select-all / act-on-many behaviour. A card list gets it by
calling the hook directly. `DataTable` is just the most common consumer of the same primitive.

**Selection is keyed by a caller-supplied stable id, never an array index.** The pre-promotion
copies keyed on index, which silently acts on the wrong rows the moment the list is re-sorted,
re-filtered or revalidated between selecting and clicking. `DataTable` defaults `getRowId` to
`row.id`; pass the prop explicitly when rows have no `id`. Destructive actions (`danger: true`)
confirm by default — pass `confirm: false` to opt out.

## `DataTable` was promoted here on 2026-07-31

`barttech-next-template`, `competition-engine`, `lead-engine` and `support-engine` each carried a
**byte-identical** 597-line copy (verified by md5 before the move). Promoted at the point where
nothing had diverged yet, which is the only cheap moment — after drift it becomes a merge, not a
move. Each consumer now shims `src/components/DataTable.tsx` → `export * from "@/app-ui/DataTable"`,
so no call site changed. `DateRangePicker.tsx` came with it because `DataTable` imports it.

The legacy `onEdit`/`onArchive`/`onDelete` props still work exactly as before (icon button per row
plus an entry in the bulk bar) — they are mapped internally onto the new generic `actions` array so
there is one code path. Golden rule 4 applies: add, do not break.

## Consumers

Keep this table current as consumers are added — it is what a propagate script would drive
off.

| App | Mount path | Branch | Consumed as | Notes |
|-----|-----------|--------|-------------|-------|
| `barttech-next-template` | `src/app-ui` | `main` | `src/components/LeftNav.tsx` shim | No Vercel project — nothing to deploy-verify. |
| `checkout-engine` | `src/app-ui` | `main` | `src/components/AdminShell.tsx` (client) | `homeHref="/admin"`, Dashboard row uses `exact`, `changelogHref`/`helpHref` `null`. Nav suppressed on `/admin/login`. |
| `ownerfoundry-website` | `src/app-ui` | `main` | `src/components/AdminShell.tsx` (client) | `homeHref="/admin/dashboard"`, `changelogHref`/`helpHref` `null`. Nav suppressed on `/admin/login`. Also mounts the private LMS submodule — see the stale-cache note below. |
| `command-center` | `src/app-ui` | **`master`** | `src/components/nav.tsx` (config wrapper, exports `Nav`) | Replaced the component this one was built from. `changelogHref`/`helpHref` `null` — no `/changelog`, and Help is already a top-level `NAV_ITEMS` entry. lucide icons on every row. |
| `bartmail` | `src/app-ui` | `main` | `src/app/(dashboard)/DashboardShell.tsx` | `helpHref="/help"`, `changelogHref={null}`. No icons, no `userEmail`/`onSignOut` (sign-out lives on its `/account` page, which is the last nav entry). Its sidebar was dark `#1e293b` and is now the standard light shell. |
| `barton-lms` | `src/app-ui` | `main` | `src/components/AdminShell.tsx` | `homeHref="/admin/dashboard"`, `widthClassName="w-56"`, `helpHref="/admin/help"`, `changelogHref={null}`. **`style` deliberately NOT passed** — see below. Its first-ever submodule, so `.gitmodules` and `submodules: recursive` were both new. |
| `cloud-plus-v2` | `src/app-ui` | `main` | `src/components/admin/AdminShell.tsx` (client) | `homeHref="/admin"`, Leads row uses `exact`, `changelogHref`/`helpHref` `null`. Nav suppressed on `/admin/login`. **Was tab-based** — its eight tabs became eight `/admin/*` routes first (see below). |

**Both greenfield mounts hide the nav on their login page**, via a client wrapper that
checks `usePathname()`. A `layout.tsx` is a server component and cannot read the pathname,
and route groups would have meant moving every admin directory. A sign-in screen must not
advertise the app's route map, and the nav's sign-out row is meaningless on it.

**OF/BMB stale-cache gotcha (applies to `ownerfoundry-website`):** it uses
`scripts/fetch-submodules.sh` for the private LMS submodule, and Vercel can restore a build
cache predating a pointer bump, leaving a submodule worktree EMPTY — CI green, Vercel
failing. The script carries an empty-worktree guard that purges `.git/modules/<sub>` and
re-inits with `--force`. **That guard enumerates `.gitmodules` at run time**
(`git config --file .gitmodules --get-regexp path`), so `src/app-ui` was covered the moment
it was added — verified in the script, not assumed. Nothing to edit when mounting here; do
re-check it if that loop is ever replaced with a hardcoded list, because the failure has no
local symptom (CI green, Vercel red, only on a cache-restored build after a pointer bump).

**`style` was NOT used by `barton-lms`, and the reason matters.** That app is dark-themed
(`body { color: #e2e2f0 }` on `--bg: #0f0f1a`), and `style` themes the `<aside>` **only**,
never the rows. Passing `background: var(--surface)` would therefore have put this
component's `text-slate-600` row labels on `#1a1a2e` — illegible. The mount ships the
standard light shell instead: a visible restyle, but readable. **This is the one thing the
component genuinely cannot express**, and the honest answer is a themed variant designed
properly, not a third half-working prop. Until then, do not offer `style` as the answer to
a dark-themed consumer.

**`cloud-plus-v2` was the tab-based one, and the resolution is the precedent worth
keeping.** Its admin was a single page switching eight components on client state.
Adding a `variant` flag here to render tabs would have been wrong — that really is a
different component. Adding nothing and leaving one app on a different shell was also
wrong. What actually happened: the consumer changed its navigation model — each tab
became its own `/admin/*` route — and then mounted this component with no new prop and
no fork. **When a consumer's shape does not fit, check whether the consumer's shape is
the thing to change before you reach for a flag.** The conversion needed care rather
than cleverness: every new route had to stay inside that app's existing `/admin*`
session-gate matcher, and its data had to keep coming from admin-gated API routes.

## Tailwind: the consumer must scan this directory

`LeftNav` is styled with Tailwind utility classes, so **every consumer's Tailwind build has
to see this submodule's source or the sidebar renders unstyled** — no width, no background,
no `fixed` positioning, and the "hidden" off-canvas drawer sits on top of the page. Tailwind
v4's automatic source detection does walk a submodule directory, but it is detection, not a
contract: add an explicit `@source "../app-ui";` (path relative to the CSS file) next to the
`@import "tailwindcss"` in the consumer's `globals.css`. It costs nothing and it is the one
failure here that a green `tsc`, a green lint and a green build all miss.

## Adding a new consumer

1. `cd repos/<app> && git submodule add https://github.com/djones007/barttech-app-ui.git <mount-path>` — inside `src/` if the app's `@/*` maps to `./src/*`, else the repo root.
2. Convert the app's existing nav component into a shim (`export * from "@/app-ui/LeftNav"`) so call sites do not change, or import `@/app-ui/LeftNav` directly.
3. **Exclude the vendored path from the app's own lint** (`src/app-ui/**` or `app-ui/**` — mount path differs per repo, read `.gitmodules`, do not assume). This repo gates itself; a second gate in a consumer only produces failures against files that repo may not edit.
4. Add `submodules: recursive` to the app's `actions/checkout` step in `.github/workflows/ci.yml`. Public submodule → no token. Vercel clones it natively.
5. Add `@source "../app-ui";` to the app's `globals.css` (see the Tailwind section above) — the one failure mode a green build does not catch.
6. If the app has a login page inside the same layout, suppress the nav on it with a client `usePathname()` wrapper.
7. Add the app to the consumer table above.

## Its own CI

`npm ci` → `npm run lint` → `npm run typecheck` (the second with `if: always()`, so a lint
failure never hides a type error). Same rationale as web-core's: a shared module linted
only as a side effect of being vendored into N repos means one error here reddens N builds
at once, against files none of them may edit — a fix in a consumer's copy is discarded on
the next pointer bump. The gate belongs where the source lives.

**Never add the estate's shared-modules gate to this repo.** It is the canonical source,
not a consumer — the same carve-out `barttech-web-core` carries.

## Keeping This Skill Current

If you find anything in this file out of date during a run — a path, consumer, or step
that changed — fix it here before finishing. Verify against the live system rather than
trusting stale text.
