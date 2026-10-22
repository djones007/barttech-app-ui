"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { appendDictation, dictationErrorMessage } from "./dictation";

/**
 * One-tap dictation for any text field, using the browser's built-in Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition). No dependency, nothing is stored or sent by this
 * module itself (the browser's speech service does the recognising).
 *
 * Why this exists when phones already have a keyboard microphone: that one only works on a phone or
 * tablet. This is for desktop browsers (Chrome, Edge, Safari) and for one-tap convenience beside a
 * field. On a browser without the API (Firefox) `supported` is false and `DictateButton` renders
 * nothing, so the field simply works as before.
 *
 * ## Use
 *   const d = useDictation({ value, onChange: setValue, maxLength: 2000 });
 *   <textarea value={value} onChange=... />
 *   <DictateButton dictation={d} />
 *   <DictateStatus dictation={d} />   // interim words, or the permission note
 *
 * Behaviour: tap to start, tap to stop. Continuous, en-GB by default. Finished phrases are appended
 * to the END of the field (never over typed text, never past `maxLength`); words still being
 * recognised show in `interim`, outside the field, until they settle.
 */

type SRResultItem = { transcript: string };
type SRResult = { isFinal: boolean; 0: SRResultItem; length: number };
type SREvent = { resultIndex: number; results: { length: number; [i: number]: SRResult } };
type SRInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SRCtor = new () => SRInstance;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const subscribeNever = () => () => {};

export type Dictation = {
  /** False on the server, on first render, and in browsers without the API. */
  supported: boolean;
  listening: boolean;
  /** Words heard but not yet settled. Shown outside the field. */
  interim: string;
  /** Plain-English note when something blocked dictation (e.g. microphone denied). */
  error: string | null;
  toggle: () => void;
  stop: () => void;
};

export function useDictation(opts: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  lang?: string;
}): Dictation {
  const { value, onChange, maxLength, lang = "en-GB" } = opts;
  // false on the server and during hydration, then true where the API exists (no setState-in-effect).
  const supported = useSyncExternalStore(subscribeNever, () => getCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SRInstance | null>(null);
  // Latest field value, kept current so a result arriving mid-typing appends to what is there now.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const maxRef = useRef(maxLength);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    maxRef.current = maxLength;
  });

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const next = appendDictation(valueRef.current, text, maxRef.current);
          valueRef.current = next;
          onChangeRef.current(next);
        } else {
          live += text;
        }
      }
      setInterim(live.trim());
    };
    rec.onerror = (e) => {
      const msg = dictationErrorMessage(e.error);
      if (msg) setError(msg);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setError("Dictation could not start. You can keep typing.");
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, interim, error, toggle, stop };
}

/** A small microphone toggle. Renders nothing when the browser cannot dictate. */
export function DictateButton({
  dictation,
  label = "Dictate",
  className = "",
}: {
  dictation: Dictation;
  /** Accessible name, e.g. "Dictate what went wrong". */
  label?: string;
  className?: string;
}) {
  if (!dictation.supported) return null;
  const on = dictation.listening;
  return (
    <button
      type="button"
      onClick={dictation.toggle}
      aria-pressed={on}
      aria-label={on ? `Stop dictating (${label})` : label}
      title={on ? "Tap to stop dictating" : "Tap to dictate"}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
        on ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
      </svg>
      {on ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
          Listening… tap to stop
        </>
      ) : (
        "Dictate"
      )}
    </button>
  );
}

/** Interim words (live region) and any permission/error note. Renders nothing when idle. */
export function DictateStatus({ dictation }: { dictation: Dictation }) {
  if (!dictation.supported) return null;
  if (dictation.error) return <p className="text-xs text-red-700" role="alert">{dictation.error}</p>;
  if (dictation.listening) {
    return (
      <p className="text-xs italic text-slate-500" role="status" aria-live="polite">
        {dictation.interim || "Listening…"}
      </p>
    );
  }
  return null;
}
