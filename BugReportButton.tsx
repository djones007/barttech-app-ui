"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DictateButton, DictateStatus, useDictation } from "./Dictate";

/**
 * The staff "Report a bug" button: a bug icon (tooltip "Report a bug") that files what is wrong on
 * THIS screen, with enough context for someone else, or an automated fixer, to reproduce it.
 *
 * ## What one click captures
 *
 * The moment the icon is clicked, before the form opens (so the form is never in the picture):
 *   - a picture of the visible page, through the `capture` function the app passes in (see below);
 *   - the URL (query string dropped on the server), route, page title, viewport and pixel ratio;
 *   - the trail that led here: the last 25 clicks and in-app navigations, with timings. A click is
 *     recorded as the control's role and label ("button \"Save\""), NEVER an input's value;
 *   - the last few uncaught errors and unhandled rejections, and a Sentry event id if given one.
 * The person picks a kind (urgent, security, broken, layout, nice to have), says what went wrong (required) and what they expected (optional), can untick the
 * picture, and can attach up to two screenshots of their own.
 *
 * ## Why `capture` is a prop
 *
 * Rendering the DOM to an image needs a library (html-to-image), and rule 3 says this repo never
 * forces a dependency on its consumers. The app installs it and passes its `toBlob` straight in:
 * `<BugReportButton endpoint="/api/bug-report" capture={toBlob} />`. Without `capture` the button
 * still works, just without the automatic picture.
 *
 * ## What it posts
 *
 * `multipart/form-data` to `endpoint` (the APP's own route, which checks the session): `report`
 * (JSON), optional `page` (the automatic picture) and up to two `upload` files. Everything is
 * downscaled to WebP here first, because a serverless request body is capped at about 4.5 MB. The
 * route answers `{ ok: true, id?, href? }`; `href` (a link to the filed issue) is shown if present.
 * The shared core module's `bugReport.ts` cleans the JSON and forwards it.
 *
 * Mount it ONLY for signed-in staff. It is not a customer-facing feedback form.
 */

export type BugCaptureOptions = {
  width: number;
  height: number;
  pixelRatio: number;
  cacheBust: boolean;
  style: { position: string; left: string; top: string };
  filter: (node: HTMLElement) => boolean;
};
export type BugCaptureFn = (node: HTMLElement, options: BugCaptureOptions) => Promise<Blob | null>;

type Crumb = { at: number; kind: "click" | "nav" | "error"; detail: string };
type ClientError = { message: string; source: string; at: number };

const MAX_CRUMBS = 25;
const MAX_ERRORS = 5;
const MAX_SIDE = 1600;
const MAX_UPLOADS = 2;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // before downscaling
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // after downscaling, under the serverless body cap
const UI_ATTR = "data-bug-report-ui";

/**
 * What the reporter says this is. Ids match web-core `BUG_REPORT_KINDS`; the tracker turns them into
 * an issue type and priority, so conserve mode can work only the urgent, security and broken ones
 * and leave layout niggles and wish-list items for full mode.
 */
const KINDS = [
  { id: "urgent", label: "Urgent", hint: "Blocks work or loses money" },
  { id: "security", label: "Security", hint: "Data exposed or access wrong" },
  { id: "bug", label: "Something's broken", hint: "Wrong result or error" },
  { id: "layout", label: "Layout / looks off", hint: "Cosmetic, can wait" },
  { id: "feature", label: "Nice to have", hint: "Future feature or idea" },
] as const;
type KindId = (typeof KINDS)[number]["id"];

// ------------------------------------------------------------------ recorder (one per page)
const crumbs: Crumb[] = [];
const errors: ClientError[] = [];
let recording = false;

function push<T>(list: T[], item: T, max: number) {
  list.push(item);
  if (list.length > max) list.shift();
}

/** "button \"Save\"", "link \"Orders\"", "input email". Never a value someone typed. */
function describe(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  if (target.closest(`[${UI_ATTR}]`)) return null;
  const el = target.closest("a,button,[role=button],[role=tab],[role=menuitem],[role=option],input,select,textarea,label,summary") ?? target;
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role") ?? (tag === "a" ? "link" : tag);
  if (tag === "input" || tag === "select" || tag === "textarea") {
    const name = el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.getAttribute("id") ?? "";
    const type = tag === "input" ? (el.getAttribute("type") ?? "text") : tag;
    return `${type} field${name ? ` "${name.slice(0, 60)}"` : ""}`;
  }
  const label = (el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const href = tag === "a" ? el.getAttribute("href") : null;
  return `${role}${label ? ` "${label}"` : ""}${href && href.startsWith("/") ? ` -> ${href.split("?")[0]}` : ""}`;
}

function startRecording() {
  if (recording || typeof window === "undefined") return;
  recording = true;
  window.addEventListener(
    "click",
    (e) => {
      const d = describe(e.target);
      if (d) push(crumbs, { at: performance.now(), kind: "click", detail: d }, MAX_CRUMBS);
    },
    { capture: true, passive: true },
  );
  const err = (message: string, source: string) => {
    push(errors, { message: message.slice(0, 300), source: source.slice(0, 200), at: Math.round(performance.now()) }, MAX_ERRORS);
    push(crumbs, { at: performance.now(), kind: "error", detail: message.slice(0, 200) }, MAX_CRUMBS);
  };
  window.addEventListener("error", (e) => err(String(e.message ?? "error"), `${e.filename ?? ""}:${e.lineno ?? 0}`));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string } | undefined;
    err(`Unhandled rejection: ${String(r?.message ?? e.reason ?? "unknown")}`, "promise");
  });
}

// ------------------------------------------------------------------ images
async function toWebp(blob: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/webp", 0.8));
    return out && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  }
}

async function capturePage(capture: BugCaptureFn): Promise<Blob | null> {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shot = capture(document.body, {
    width: w,
    height: h,
    pixelRatio: 1,
    cacheBust: true,
    // Shift the page so the part in view lands at the image's origin. An OFFSET, never a transform:
    // a transformed <body> becomes the containing block for every position:fixed descendant (the
    // sidebar, a bell), so they scrolled away with the page and any report filed below the top of
    // a page came out with a blank strip where the sidebar was (first live report, 2026-09-30).
    style: { position: "relative", left: `${-window.scrollX}px`, top: `${-window.scrollY}px` },
    filter: (node) => !(node instanceof HTMLElement && node.hasAttribute?.(UI_ATTR)),
  });
  const timeout = new Promise<null>((res) => setTimeout(() => res(null), 10_000));
  const blob = await Promise.race([shot.catch(() => null), timeout]);
  return blob ? toWebp(blob) : null;
}

// ------------------------------------------------------------------ component
function BugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3 3 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

/**
 * Your own screenshots: drag a file onto the box, click it to choose one, or paste an image while the box has focus.
 * A Zight share link typed into the description works as well: the server fetches the picture behind it when it files the report.
 */
function UploadDrop({ files, onAdd, onRemove }: { files: File[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Add your own screenshot. Drop a file here, press Enter to choose one, or paste an image."
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(Array.from(e.dataTransfer.files)); }}
        onPaste={(e) => { const f = Array.from(e.clipboardData.files); if (f.length) { e.preventDefault(); onAdd(f); } }}
        className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-md border-2 border-dashed px-3 py-3 text-center text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${over ? "border-slate-600 bg-slate-100" : "border-slate-300 bg-slate-50 hover:bg-slate-100"}`}
      >
        <span className="font-medium">Add your own screenshot</span>
        <span className="text-xs text-slate-600">Drop it here, click to choose a file, or paste it. Up to {MAX_UPLOADS}.</span>
        <span className="text-xs text-slate-600">Or paste a Zight link into the description.</span>
        <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => { onAdd(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2 text-xs">
              {/* A plain <img>: a local blob: URL, not an asset next/image could optimise. */}
              <img src={urls[i]} alt="" className="h-10 w-10 rounded object-cover" />
              <span className="flex-1 truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BugReportButton({
  endpoint,
  capture,
  getSentryEventId,
  className = "fixed right-3 top-14 z-30 md:right-6 md:top-16",
  label = "Report a bug",
}: {
  /** The app's own POST route (session-checked), e.g. "/api/bug-report". */
  endpoint: string;
  /** html-to-image's `toBlob`, or any function with the same shape. Omit for no automatic picture. */
  capture?: BugCaptureFn;
  /** e.g. `() => Sentry.lastEventId()`. */
  getSentryEventId?: () => string | null | undefined;
  /** Positioning. The default sits under a top-right bell/avatar button. */
  className?: string;
  label?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const dictWhat = useDictation({ value: description, onChange: setDescription, maxLength: 2000 });
  const dictExpected = useDictation({ value: expected, onChange: setExpected, maxLength: 1000 });
  const [kind, setKind] = useState<KindId>("bug");
  const [includePage, setIncludePage] = useState(true);
  const [pageShot, setPageShot] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploads, setUploads] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ href?: string } | null>(null);
  const frozen = useRef<Record<string, unknown> | null>(null);
  // The picture is taken in the background while the form is already open (the form sits inside
  // the UI_ATTR wrapper, so it is filtered out of the picture). Taking it BEFORE opening made the
  // icon look dead for the seconds html-to-image needs on a busy page, and people clicked again.
  const shotPromise = useRef<Promise<Blob | null> | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(startRecording, []);
  useEffect(() => {
    if (pathname) push(crumbs, { at: performance.now(), kind: "nav", detail: pathname }, MAX_CRUMBS);
  }, [pathname]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    dictWhat.stop();
    dictExpected.stop();
    setOpen(false);
    setDescription("");
    setExpected("");
    setKind("bug");
    setIncludePage(true);
    setPageShot(null);
    setPreview(null);
    setUploads([]);
    setError(null);
    setDone(null);
    frozen.current = null;
    shotPromise.current = null;
    setCapturing(false);
  };

  useEffect(() => {
    if (!open) return;
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const begin = () => {
    if (open) return;
    const now = performance.now();
    // Freeze the context at the click, not after typing.
    frozen.current = {
      url: window.location.href,
      path: window.location.pathname,
      pageTitle: document.title,
      capturedAt: Math.round(now),
      breadcrumbs: crumbs.map((c) => ({ ...c, at: Math.round(c.at) })),
      context: {
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
        errors: [...errors],
        sentryEventId: getSentryEventId?.() ?? null,
        elapsedMs: Math.round(now),
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
      },
    };
    setOpen(true);
    if (capture) {
      setCapturing(true);
      const p = capturePage(capture).catch(() => null);
      shotPromise.current = p;
      void p.then((blob) => {
        if (shotPromise.current !== p) return; // closed (or reopened) before it finished
        setCapturing(false);
        setPageShot(blob);
        setPreview(blob ? URL.createObjectURL(blob) : null);
      });
    }
  };

  // Add to what is already chosen (drop, browse or paste), never replace it.
  const addUploads = (list: File[]) => {
    setError(null);
    if (!list.length) return;
    const bad = list.find((f) => !["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > MAX_UPLOAD_BYTES);
    if (bad) {
      setError("Screenshots must be PNG, JPG or WebP, under 8 MB each.");
      return;
    }
    const next = [...uploads, ...list];
    if (next.length > MAX_UPLOADS) setError(`${MAX_UPLOADS} screenshots at most. The first ${MAX_UPLOADS} were kept.`);
    setUploads(next.slice(0, MAX_UPLOADS));
  };

  const send = async () => {
    if (!frozen.current || description.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      // Sent before the picture finished: wait for it rather than drop it.
      const shot = pageShot ?? (includePage && shotPromise.current ? await shotPromise.current : null);
      const sendPage = includePage && shot !== null;
      form.set("report", JSON.stringify({ ...frozen.current, kind, description, expected, screenshotIncluded: sendPage }));
      let total = 0;
      if (sendPage && shot) {
        form.append("page", shot, "page.webp");
        total += shot.size;
      }
      for (const f of uploads) {
        const small = await toWebp(f);
        total += small.size;
        form.append("upload", small, f.name.replace(/\.[^.]+$/, "") + ".webp");
      }
      if (total > MAX_TOTAL_BYTES) {
        setError("The pictures are too large together. Remove one of your screenshots and try again.");
        return;
      }
      const res = await fetch(endpoint, { method: "POST", body: form });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; href?: string; error?: string };
      if (res.ok && out.ok) setDone({ href: out.href });
      else if (res.status === 401) setError("Your session has expired. Sign in again and resend.");
      else setError(out.error ? `That didn't send (${out.error}). Please try again.` : "That didn't send. Please try again.");
    } catch {
      setError("That didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className} {...{ [UI_ATTR]: "" }}>
      <button
        type="button"
        onClick={begin}
        aria-label={label}
        title={label}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
      >
        <BugIcon className="h-5 w-5" />
        <span className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block group-focus-visible:block">
          {label}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="bug-report-title">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 text-slate-900 shadow-xl">
            {done ? (
              <div className="space-y-3">
                <p id="bug-report-title" className="text-base font-semibold">Bug logged</p>
                <p className="text-sm text-slate-600" role="status">
                  It&apos;s in the fix queue with the page, the steps that led here and {includePage && pageShot ? "a picture of the screen" : "the page details"}.
                </p>
                <div className="flex gap-2">
                  {done.href && (
                    <a href={done.href} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">View the issue</a>
                  )}
                  <button type="button" onClick={reset} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">Close</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p id="bug-report-title" className="text-base font-semibold">{label}</p>
                <p className="text-xs text-slate-500">
                  Sends this page&apos;s address, the last few things you clicked, any errors on the page and the details below.
                </p>
                <fieldset className="space-y-1">
                  <legend className="text-sm font-medium">What kind is it?</legend>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {KINDS.map((k) => (
                      <label
                        key={k.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${kind === k.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}
                      >
                        <input type="radio" name="bug-report-kind" className="mt-1" checked={kind === k.id} onChange={() => setKind(k.id)} />
                        <span>
                          <span className="font-medium">{k.label}</span>
                          <span className="block text-xs text-slate-500">{k.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium" htmlFor="bug-report-what">What went wrong?</label>
                  <DictateButton dictation={dictWhat} label="Dictate what went wrong" />
                </div>
                <textarea
                  id="bug-report-what"
                  ref={textRef}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <DictateStatus dictation={dictWhat} />
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium" htmlFor="bug-report-expected">What did you expect to happen? <span className="font-normal text-slate-500">(optional)</span></label>
                  <DictateButton dictation={dictExpected} label="Dictate what you expected" />
                </div>
                <textarea
                  id="bug-report-expected"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                  maxLength={1000}
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
                <DictateStatus dictation={dictExpected} />
                {capturing ? (
                  <p className="text-xs text-slate-500" role="status">Taking a picture of the page…</p>
                ) : pageShot && preview ? (
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-1" checked={includePage} onChange={(e) => setIncludePage(e.target.checked)} />
                    <span className="flex-1">
                      Include this picture of the page
                      {/* A plain <img>: a local blob: URL, not an asset next/image could optimise. */}
                      <img src={preview} alt="Picture of the page as it was when you clicked" className="mt-2 max-h-40 w-full rounded border border-slate-200 object-contain object-left-top" />
                    </span>
                  </label>
                ) : (
                  capture && <p className="text-xs text-slate-500">The picture of the page could not be taken. Attach a screenshot if it helps.</p>
                )}
                <UploadDrop files={uploads} onAdd={addUploads} onRemove={(i) => setUploads(uploads.filter((_, j) => j !== i))} />
                {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" disabled={busy} onClick={reset} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
                  <button
                    type="button"
                    disabled={busy || description.trim().length < 3}
                    onClick={() => void send()}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
