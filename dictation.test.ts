import { test } from "node:test";
import assert from "node:assert/strict";
import { appendDictation, dictationErrorMessage, remainingChars } from "./dictation";

test("appends with one space", () => {
  assert.equal(appendDictation("Hello", "world"), "Hello world");
  assert.equal(appendDictation("Hello ", " world  "), "Hello world");
  assert.equal(appendDictation("", "first"), "first");
  assert.equal(appendDictation("line\n", "next"), "line\nnext");
});

test("empty phrase leaves the field alone", () => {
  assert.equal(appendDictation("abc", "   "), "abc");
});

test("respects maxLength and never trims existing text", () => {
  assert.equal(appendDictation("abc", "defgh", 6), "abc de");
  assert.equal(appendDictation("abcdef", "more", 6), "abcdef");
  assert.equal(appendDictation("abcdefgh", "more", 6), "abcdefgh");
});

test("remainingChars", () => {
  assert.equal(remainingChars("abc", 10), 7);
  assert.equal(remainingChars("abc"), Infinity);
  assert.equal(remainingChars("abcdefghijkl", 10), 0);
});

test("error messages", () => {
  assert.match(dictationErrorMessage("not-allowed") ?? "", /blocked/);
  assert.equal(dictationErrorMessage("no-speech"), null);
  assert.ok(dictationErrorMessage("weird"));
});
