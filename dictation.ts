// Pure helpers for dictation (no React, no browser APIs) so they can be unit-tested in plain Node.

/**
 * Append a dictated phrase to the end of what is already in a field.
 * - trims the phrase; an empty phrase returns `existing` unchanged
 * - joins with one space unless `existing` is empty or already ends in whitespace
 * - never exceeds `maxLength` (the phrase is cut, `existing` is never touched)
 */
export function appendDictation(existing: string, phrase: string, maxLength?: number): string {
  const add = phrase.replace(/\s+/g, " ").trim();
  if (!add) return existing;
  const sep = existing === "" || /\s$/.test(existing) ? "" : " ";
  const joined = existing + sep + add;
  if (maxLength === undefined || joined.length <= maxLength) return joined;
  if (existing.length >= maxLength) return existing;
  return joined.slice(0, maxLength).trimEnd();
}

/** Characters still free in a field with an optional max length. Infinity when there is no limit. */
export function remainingChars(value: string, maxLength?: number): number {
  return maxLength === undefined ? Infinity : Math.max(0, maxLength - value.length);
}

/** Map a SpeechRecognition error code to a short plain-English note, or null when it needs no message. */
export function dictationErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow the microphone for this site in your browser settings, or type instead.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Dictation needs a connection and could not reach the speech service.";
    case "no-speech":
    case "aborted":
      return null;
    default:
      return "Dictation stopped unexpectedly. You can keep typing.";
  }
}
