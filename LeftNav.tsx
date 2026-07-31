"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// --- Types ---

export type NavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon?: React.ElementType;
  /**
   * Match this href EXACTLY — do not treat descendant routes as active.
   * Needed by any app whose index page is itself a nav row: an app rooted at
   * `/admin` with a Dashboard row pointing at `/admin` would otherwise show
   * Dashboard active on `/admin/orders`, `/admin/settings` and every other
   * page, because those are all descendants of it.
   */
  exact?: boolean;
  /**
   * This row points at a different application, not a route in this one
   * (`https://assistlynow.com`). Renders a plain `<a target="_blank"
   * rel="noopener noreferrer">` with a visible external-link affordance, and
   * is never marked active.
   *
   * The active check is skipped rather than merely failing: `isActive`
   * compares against `usePathname()`, which is a path (`/tickets`) and can
   * never equal an absolute URL. Left in, an external row is permanently
   * inactive AND — worse — it drags its parent group's `hasActiveChild` to
   * false, so a group of nothing but external links never highlights at all.
   */
  external?: boolean;
};

export type NavChildItem = {
  href: string;
  label: string;
  icon?: React.ElementType;
  /** See `NavLinkItem.exact`. */
  exact?: boolean;
  /** See `NavLinkItem.external`. */
  external?: boolean;
};

export type NavGroupItem = {
  kind: "group";
  label: string;
  icon?: React.ElementType;
  children: NavChildItem[];
};

export type NavItem = NavLinkItem | NavGroupItem;

export type LeftNavProps = {
  /** Shown in the sidebar header and the mobile top bar. */
  appName: string;
  /** Letter in the logo square. Defaults to the first character of `appName`. */
  appInitial?: string;
  /** Main navigation. Mix `link` and `group` entries. */
  navItems: NavItem[];
  /** Shown above the sign-out button. Omit if the app has no auth. */
  userEmail?: string;
  /** Pass a server action. Omit and the sign-out row is not rendered. */
  onSignOut?: () => void;
  /** Pinned bottom link. Pass `null` to hide it (an app with no `/changelog` page). */
  changelogHref?: string | null;
  /** Pinned bottom link. Pass `null` to hide it (an app with no `/help` page). */
  helpHref?: string | null;

  // --- Accommodations for existing consumers (all optional, all additive) ---

  /**
   * Where the logo/app-name links to. Defaults to `/`. Apps mounted under a
   * segment (`/admin/dashboard`) set their own root here so the header link is
   * not a route out of the app shell.
   */
  homeHref?: string;
  /**
   * REPLACES the default `w-60` width class — it does not append, because two
   * competing Tailwind width classes in one string resolve by stylesheet order,
   * not by string order, and this repo carries no `tailwind-merge`.
   * Whatever you pass here, the page layout's left padding must match it
   * (`md:pl-60` for the default).
   */
  widthClassName?: string;
  /**
   * Appended to the `<aside>` classes. For non-conflicting overrides only
   * (background, border colour, z-index). Use `widthClassName` for width.
   */
  className?: string;
  /**
   * Inline style on the `<aside>`. For consumers that theme through CSS custom
   * properties (`{ background: "var(--surface)" }`) rather than Tailwind
   * colour classes. Note this styles the shell only, not the individual rows —
   * a fully themed variant is not solved yet.
   */
  style?: React.CSSProperties;
  /**
   * Rendered in the pinned bottom block, above Changelog/Help. For an
   * environment badge, a tenant switcher, a version string.
   */
  footer?: React.ReactNode;
};

// --- Helpers ---

function cls(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(" ");
}

/**
 * Segment-aware active check. A plain `startsWith` marks `/cloud-plus/cost-rules`
 * active while you are on `/cloud-plus-quotes`, because one string is a prefix of
 * the other — match whole path segments instead.
 *
 * `exact` turns off descendant matching for a row that is itself an ancestor of
 * the rest of the nav (a Dashboard at `/admin` alongside `/admin/orders`). `/`
 * is always exact for the same reason — every path is a descendant of it.
 */
function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * `isActive` for a nav row, short-circuiting external rows to `false`.
 *
 * A row pointing at another application is never the current page, and its
 * `href` is an absolute URL that `usePathname()` cannot match anyway. Use this
 * rather than `isActive` at every call site that handles a `NavLinkItem` or
 * `NavChildItem` — including the group-expansion checks, or a group whose
 * children are all external would be evaluated against absolute URLs on every
 * route change for an answer that is structurally always false.
 */
function isRowActive(
  pathname: string,
  item: { href: string; exact?: boolean; external?: boolean },
): boolean {
  if (item.external) return false;
  return isActive(pathname, item.href, item.exact);
}

// --- Inline SVGs (no lucide dependency; pass lucide icons in via the icon prop) ---

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function IconChangelog({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconHelp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconExternal({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
function IconLogOut({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// --- Nav rows ---

function NavLinkRow({
  href,
  label,
  icon: Icon,
  active,
  nested,
  external,
  onNavigate,
}: {
  href: string;
  label: string;
  icon?: React.ElementType;
  active: boolean;
  nested?: boolean;
  external?: boolean;
  onNavigate: () => void;
}) {
  const className = cls(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    nested && "ml-3 py-1.5",
    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
  );

  const body = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="truncate">{label}</span>
      {external && (
        <>
          <IconExternal className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" />
          {/* The icon is decorative (aria-hidden), so the warning that this
              leaves the app has to reach screen readers some other way. */}
          <span className="sr-only">(opens in a new tab)</span>
        </>
      )}
    </>
  );

  // A plain anchor, not `next/link`: this is a full document navigation to a
  // different origin, so there is no client-side route to push and nothing for
  // the router to prefetch.
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      // Screen readers get no signal from a background colour. Without this the
      // active row is indistinguishable from every other row.
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {body}
    </Link>
  );
}

function NavGroupRow({
  item,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavGroupItem;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const hasActiveChild = item.children.some((c) => isRowActive(pathname, c));
  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cls(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          // A collapsed group still has to show that something inside it is active.
          hasActiveChild && !open
            ? "bg-slate-100 text-slate-900"
            : "text-slate-600 hover:bg-slate-100",
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="truncate">{item.label}</span>
        <IconChevronDown
          className={cls("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5 border-l border-slate-200 pl-1">
          {item.children.map((child) => (
            <NavLinkRow
              key={child.href}
              href={child.href}
              label={child.label}
              icon={child.icon}
              nested
              external={child.external}
              active={isRowActive(pathname, child)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main component ---

/**
 * Left-hand navigation sidebar — the default shell for all internal, multi-tenant,
 * and customer-facing apps across the estate. Changelog, Help, the signed-in email
 * and Sign out are pinned to the bottom regardless of what goes in `navItems`.
 *
 *   <LeftNav
 *     appName="Command Centre"
 *     navItems={NAV_ITEMS}
 *     userEmail={user.email}
 *     onSignOut={signOutAction}   // a server action
 *   />
 *
 * Icons: pass any `React.ElementType` on a nav entry's `icon` field — lucide-react
 * components work directly (`icon: LayoutDashboard`). This repo deliberately has no
 * lucide dependency; the six built-in chrome icons below are inline SVGs.
 *
 * Layout: on `md+` the sidebar is `fixed left-0` and the page content shifts right
 * (`md:pl-60` by default, or whatever matches `widthClassName`). Below `md` it is
 * off-canvas behind a sticky hamburger bar.
 */
export function LeftNav({
  appName,
  appInitial,
  navItems,
  userEmail,
  onSignOut,
  changelogHref = "/changelog",
  helpHref = "/help",
  homeHref = "/",
  widthClassName = "w-60",
  className,
  style,
  footer,
}: LeftNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * A group is open if you have explicitly toggled it; otherwise it follows the
   * current route, so the section you are in is always expanded — including after
   * a client-side navigation into a different section. Deriving it this way,
   * rather than seeding state once, is what keeps that working.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const openFor = (g: NavGroupItem, ov: Record<string, boolean>) =>
    ov[g.label] ?? g.children.some((c) => isRowActive(pathname, c));

  const groupOpen = (g: NavGroupItem) => openFor(g, overrides);

  // Read `prev` inside the updater rather than the captured `overrides`, so two
  // toggles in one render pass cannot drop one another.
  const toggleGroup = (g: NavGroupItem) =>
    setOverrides((prev) => ({ ...prev, [g.label]: !openFor(g, prev) }));

  const closeMobile = () => setMobileOpen(false);
  const initial = appInitial ?? appName.charAt(0).toUpperCase();

  // Escape closes the off-canvas drawer — a modal overlay you can only dismiss by
  // pointing at the backdrop is a keyboard trap.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile top bar (hidden on md+) */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-sm md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
        >
          <IconMenu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-slate-900">{appName}</span>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label={`${appName} navigation`}
        style={style}
        className={cls(
          // Every `border-*` here names its colour explicitly. Tailwind v4's
          // default border colour is `currentColor`, not v3's `gray-200`, so an
          // unqualified `border-r` renders black in one consumer and invisible
          // in another purely from that app's inherited text colour. Only repos
          // carrying the v3 compat shim looked right by accident.
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-transform md:translate-x-0",
          widthClassName,
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          className,
        )}
      >
        {/* App header */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
          <Link href={homeHref} onClick={closeMobile} className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
              {initial}
            </div>
            <span className="truncate text-sm font-semibold text-slate-900">{appName}</span>
          </Link>
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Close menu"
            className="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) =>
            item.kind === "link" ? (
              <NavLinkRow
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                external={item.external}
                active={isRowActive(pathname, item)}
                onNavigate={closeMobile}
              />
            ) : (
              <NavGroupRow
                key={item.label}
                item={item}
                pathname={pathname}
                open={groupOpen(item)}
                onToggle={() => toggleGroup(item)}
                onNavigate={closeMobile}
              />
            ),
          )}
        </nav>

        {/* Bottom: [footer] · Changelog · Help · Account */}
        <div className="shrink-0 border-t border-slate-200 p-3">
          {footer && <div className="pb-2">{footer}</div>}

          {(changelogHref || helpHref) && (
            <div className="space-y-0.5">
              {changelogHref && (
                <NavLinkRow
                  href={changelogHref}
                  label="Changelog"
                  icon={IconChangelog}
                  active={isActive(pathname, changelogHref)}
                  onNavigate={closeMobile}
                />
              )}
              {helpHref && (
                <NavLinkRow
                  href={helpHref}
                  label="Help"
                  icon={IconHelp}
                  active={isActive(pathname, helpHref)}
                  onNavigate={closeMobile}
                />
              )}
            </div>
          )}

          {(userEmail || onSignOut) && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              {userEmail && (
                <p className="truncate px-3 pb-1.5 text-xs text-slate-400">{userEmail}</p>
              )}
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <IconLogOut className="h-4 w-4 shrink-0" />
                  <span>Sign out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
