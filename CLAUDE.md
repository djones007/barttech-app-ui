# barttech-app-ui — shared app-shell UI submodule (`@barttech/app-ui`)

The estate's single source of truth for **brand-neutral admin/app-shell UI**. Source-only,
no build — mounted as a **git submodule** in each app that has a dashboard or admin shell
and transpiled by that app's Next.js build, the same pattern used for other shared
source-only submodules in this estate. **Not a deployable app — no Vercel project. Never
create one.**

## ⚠️ THIS REPO IS PUBLIC

`barttech-app-ui` is a **public** GitHub repo. **NEVER commit a secret, key, token, DSN,
`.env` value, customer PII, customer-facing copy, brand name, internal repo name, live
domain, or any other estate-architecture detail here.** This is a strict rule, not a
judgement call — if a component, comment, or doc line only makes sense with a specific
consumer app or brand named, it does not belong in this repo.

The consumer map (which repos mount this and how) is deliberately NOT documented here — it
lives in the private barttech-os root repo (`memory/`), co-located with the propagate
tooling.

**Why public:** a generic navigation shell has no secrets and no IP — it is layout and
`aria` attributes. Public means Vercel and `actions/checkout` clone the submodule
natively, with no extra token plumbing and no private-submodule fetch workaround (the
private-submodule route is the source of real stale-cache bugs that a private consumer
submodule elsewhere in the estate still carries guards for). Public repos also get free
secret scanning + push protection and free Actions minutes — both auto-enabled; do not
disable them.

Some shared submodules in this estate stay **private** — specifically ones that expose an
access-control or entitlement model. That reasoning does not transfer to a nav bar. Rule of
thumb: public only for generic, secret-free, no-IP mechanisms.

## Why this is not in the shared framework-free core module

The estate's other shared submodule for non-UI logic is deliberately pure TypeScript with
**no React and no Next**, and it is mounted in many repos, including brand marketing sites
that will never have an admin nav. A `.tsx` file importing `react`/`next` there would be
type-checked by every consumer — which already broke a build once, because a consumer's
overly broad TypeScript `include` pattern type-checked a core module file that imported a
dependency that consumer did not have. So UI gets its own repo, mounted **only where it is
used**.

## Golden rules

1. **Brand-neutral app shell only.** Anything with a brand's name, palette, voice or
   legal obligation in it stays in the consuming repo. **The cookie banner is the
   standing example** — its *mechanism* lives in the shared core module (`consent.ts`,
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
   an API contract already shipped by an early consumer — they do not change.
5. **Accommodate consumers with props, do not let them fork.** Every real consumer looks
   slightly different (different width, admin root path, inline CSS-variable theming, no
   changelog page). Each of those is one optional additive prop, documented in
   `README.md`. But do not invent props for hypothetical needs, and do not paper over a
   genuinely different shell with a `variant` flag: one consumer's admin used to be
   **tab-based**, and the fix was to give it real routes, not to teach this component
   to render tabs.
6. **Fix once → propagate.** After committing and pushing here, bump each consumer's
   submodule pointer and push (Vercel auto-deploys). Never `vercel --prod` a consumer to
   pick up a bump — a CLI deploy ships a source snapshot with no `.git`.

## What lives here

| File | Exports |
|------|---------|
| `LeftNav.tsx` | `LeftNav` + types `NavItem`, `NavLinkItem`, `NavChildItem`, `NavGroupItem`, `LeftNavProps`. Client component. Full prop table in `README.md`. |

**Nav rows can point out of the app.** `NavLinkItem` and `NavChildItem` both take an
optional `external?: boolean`, for a consumer that needs a row linking to a separate
external application. An external row renders as a plain
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

No barrel `index.ts` — import the file directly (`@/app-ui/LeftNav`, `@/app-ui/SaveButton`),
matching the estate's other shared source-only submodule.

## Bulk selection is a primitive, not a table feature

`useBulkSelection` + `BulkActionBar` live in `BulkActions.tsx` **separately from `DataTable`**,
and that separation is the point. At least one consumer renders a queue as cards, not rows —
the body preview that makes a suppressed item reviewable does not survive a table cell —
but it needs identical select / select-all / act-on-many behaviour. A card list gets it by
calling the hook directly. `DataTable` is just the most common consumer of the same primitive.

**Selection is keyed by a caller-supplied stable id, never an array index.** An earlier
version keyed on index, which silently acts on the wrong rows the moment the list is
re-sorted, re-filtered or revalidated between selecting and clicking. `DataTable` defaults
`getRowId` to `row.id`; pass the prop explicitly when rows have no `id`. Destructive
actions (`danger: true`) confirm by default — pass `confirm: false` to opt out.

**Two rows must never share a selection key either** (fixed 2026-08-01). The `getRowId`
default used to be `String(row.id ?? "")`, so a row set with no `id` gave *every* row the
key `""`: one tick selected the whole page, the bar still read "1 selected" (one distinct
key), and `run(selectedRows)` was handed the lot — in front of a delete. No consumer was
hitting it at the time, which is exactly what made it a landmine for the next one. The
default is now `createRowIdFallback()` from `BulkActions.tsx`, which keys id-less rows by
**row object identity**: unique by construction, survives sorting/filtering/paging (same
objects, reordered), and when the parent refetches and produces new objects the keys stop
matching, so the selection *clears* instead of acting on the wrong rows. Losing a
selection is a safe failure; acting on unticked rows is not. Dev builds log once when the
fallback engages, and `useBulkSelection` separately `console.error`s whenever a caller's own
`getId` returns fewer distinct keys than rows — the same failure via a consumer-supplied
function, which the fallback cannot fix. **Index-keying was not re-introduced** as the
fallback; it is the bug the 2026-07-31 change removed.

**`onDelete` (the legacy prop) now confirms.** It used to map to `confirm: false` on the
stated assumption that legacy callers ran their own dialog — checked across consumers
2026-08-01 and *nothing* used the prop that way, so all it did was arm an unconfirmed bulk
delete for the next consumer. `danger: true` now supplies the default confirmation. To opt
out, declare the action via `actions` with `confirm: false` — the generic array is the
full-control path, `onDelete` is the shorthand.

## `DataTable` was promoted here on 2026-07-31

Several consumer repos each carried a **byte-identical** 597-line copy (verified by md5
before the move). Promoted at the point where nothing had diverged yet, which is the only
cheap moment — after drift it becomes a merge, not a move. Each consumer now shims its own
data-table component path to re-export from `@/app-ui/DataTable`, so no call site changed.
`DateRangePicker.tsx` came with it because `DataTable` imports it.

The legacy `onEdit`/`onArchive`/`onDelete` props still work exactly as before (icon button per row
plus an entry in the bulk bar) — they are mapped internally onto the new generic `actions` array so
there is one code path. Golden rule 4 applies: add, do not break.

## Consumers

The full consumer table (which repos mount this, at what path, on what branch, and any
per-consumer quirks) is not maintained in this public repo. It lives in the private
barttech-os root repo's memory, alongside the propagate tooling that reads it.

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
7. Record the new consumer in the private consumer map in the barttech-os root repo — not in this repo.

## Its own CI

`npm ci` → `npm run lint` → `npm run typecheck` (the second with `if: always()`, so a lint
failure never hides a type error). Same rationale as the estate's other shared submodule: a
shared module linted only as a side effect of being vendored into many repos means one
error here reddens every build at once, against files none of them may edit — a fix in a
consumer's copy is discarded on the next pointer bump. The gate belongs where the source
lives.

**Never add the estate's shared-modules CI gate to this repo.** It is the canonical source,
not a consumer.

## Keeping This Skill Current

If you find anything in this file out of date during a run — a path, consumer, or step
that changed — fix it here before finishing. Verify against the live system rather than
trusting stale text.
