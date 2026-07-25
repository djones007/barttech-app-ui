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
   genuinely different shell: `cloud-plus-v2`'s admin is **tab-based**, which is a
   different component, not a `variant` flag on this one.
6. **Fix once → propagate.** After committing and pushing here, bump each consumer's
   submodule pointer and push (Vercel auto-deploys). Never `vercel --prod` a consumer to
   pick up a bump — a CLI deploy ships a source snapshot with no `.git`.

## What lives here

| File | Exports |
|------|---------|
| `LeftNav.tsx` | `LeftNav` + types `NavItem`, `NavLinkItem`, `NavChildItem`, `NavGroupItem`, `LeftNavProps`. Client component. Full prop table in `README.md`. |

No barrel `index.ts` — import the file directly (`@/app-ui/LeftNav`), matching web-core.

## Consumers

Keep this table current as consumers are added — it is what a propagate script would drive
off.

| App | Mount path | Branch | Consumed as | Notes |
|-----|-----------|--------|-------------|-------|
| `barttech-next-template` | `src/app-ui` | `main` | `src/components/LeftNav.tsx` shim | No Vercel project — nothing to deploy-verify. |
| `checkout-engine` | `src/app-ui` | `main` | `src/components/AdminShell.tsx` (client) | `homeHref="/admin"`, Dashboard row uses `exact`, `changelogHref`/`helpHref` `null`. Nav suppressed on `/admin/login`. |
| `ownerfoundry-website` | `src/app-ui` | `main` | `src/components/AdminShell.tsx` (client) | `homeHref="/admin/dashboard"`, `changelogHref`/`helpHref` `null`. Nav suppressed on `/admin/login`. Also mounts the private LMS submodule — see the stale-cache note below. |

**Both greenfield mounts hide the nav on their login page**, via a client wrapper that
checks `usePathname()`. A `layout.tsx` is a server component and cannot read the pathname,
and route groups would have meant moving every admin directory. A sign-in screen must not
advertise the app's route map, and the nav's sign-out row is meaningless on it.

**OF/BMB stale-cache gotcha (applies to `ownerfoundry-website`):** it uses
`scripts/fetch-submodules.sh` for the private LMS submodule, and Vercel can restore a build
cache predating a pointer bump, leaving a submodule worktree EMPTY — CI green, Vercel
failing. The script carries an empty-worktree guard that purges `.git/modules/<sub>` and
re-inits with `--force`; **any new submodule must be added to that guard's list**, or the
first stale-cache build after a bump breaks with no local symptom.

Remaining intended consumers:

- **`command-center`** — `src/components/nav.tsx` hardcodes its `NAV_ITEMS`, "Command
  Centre", the `B` initial and its own `signOut`; those become props. Its default branch
  is **`master`**, not `main`, and its bottom block today has no Changelog/Help rows (it
  has a `/help` entry inside `NAV_ITEMS` instead).
- **`barton-lms`** — `AdminNav.tsx` / `AdminShell.tsx`. Themed with inline `style={{}}`
  and CSS custom properties, `w-56`/220px, rooted at `/admin/dashboard`. Needs
  `homeHref`, `widthClassName`, `style`; a full CSS-variable theme for the *rows* is not
  solved and would need real design work, not another prop.
- **`cloud-plus-v2`** — admin is tab-based. **Out of scope**, deliberately.

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
