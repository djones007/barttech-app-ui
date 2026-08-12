import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AA_NORMAL,
  accessiblePair,
  contrastRatio,
  parseColor,
  readableOn,
  relativeLuminance,
  toHex,
} from "./contrast";

// ---------------------------------------------------------------------------
// These assertions exist because the bug they describe shipped, sat in front of
// people for months, and was invisible to every automated check in the repo.
//
// A chip painted with a colour from data and a foreground hard-coded as white
// reads perfectly against a mid-blue and is *literally unreadable* against a
// saturated yellow — 1.23:1, where AA asks for 4.5:1. A build cannot see it, a
// type checker cannot see it, and a reviewer only sees it if they happen to
// load a page containing that one colour.
//
// The property worth protecting is not "these particular colours look right
// today". It is: NO colour, present or future, can produce an unreadable pair.
// The sweep at the bottom is therefore the load-bearing test — the named cases
// above it are documentation of the specific failures that motivated the module.
// ---------------------------------------------------------------------------

test("parseColor handles the formats a colour input can emit", () => {
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColor("#FFEA00"), { r: 255, g: 234, b: 0 });
  assert.deepEqual(parseColor("  #008000  "), { r: 0, g: 128, b: 0 });
  assert.deepEqual(parseColor("rgb(249, 115, 22)"), { r: 249, g: 115, b: 22 });
  assert.deepEqual(parseColor("rgba(0, 0, 255, 0.5)"), { r: 0, g: 0, b: 255 });
});

test("parseColor returns null rather than guessing", () => {
  // A silent fallback to black here would paint a black chip and look
  // deliberate. Null forces the caller to choose.
  for (const bad of ["", "  ", "not-a-colour", "#ff", "#gggggg", "hsl(0 100% 50%)", null, undefined]) {
    assert.equal(parseColor(bad as string), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test("luminance and ratio match the WCAG reference points", () => {
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.equal(
    Math.round(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })),
    21
  );
  // Order must not matter.
  assert.equal(
    contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }),
    contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
  );
});

test("the regression: white on saturated yellow is unreadable, and is not what we return", () => {
  const yellow = "#ffea00";
  const whiteOnYellow = contrastRatio(
    { r: 255, g: 255, b: 255 },
    parseColor(yellow)!
  );
  // Documents the actual severity: this is not "a bit faint", it is invisible.
  assert.ok(whiteOnYellow < 1.3, `expected the old pairing to be ~1.23:1, got ${whiteOnYellow}`);

  const pair = accessiblePair(yellow);
  assert.equal(pair.background, yellow, "a readable foreground exists, so the colour must not be altered");
  assert.equal(pair.adjusted, false);
  assert.ok(pair.ratio >= AA_NORMAL, `expected AA, got ${pair.ratio}`);
  assert.notEqual(pair.foreground, "#ffffff");
});

test("a colour that no fixed foreground can rescue is nudged, not left failing", () => {
  // Pure red is the case that breaks a naive better-of-black-or-white: 4.00:1
  // against white, 4.44:1 against near-black. Both fail, and picking the
  // better one still fails.
  const red = parseColor("#ff0000")!;
  assert.ok(contrastRatio({ r: 255, g: 255, b: 255 }, red) < AA_NORMAL);
  assert.ok(contrastRatio({ r: 17, g: 24, b: 39 }, red) < AA_NORMAL);

  const pair = accessiblePair("#ff0000");
  assert.equal(pair.adjusted, true, "expected the background to be adjusted");
  assert.ok(pair.ratio >= AA_NORMAL, `expected AA, got ${pair.ratio}`);

  // The chip must still read as red — hue and saturation are preserved, only
  // lightness moves, and only as far as it has to.
  const out = parseColor(pair.background)!;
  assert.ok(out.r > out.g && out.r > out.b, `expected a red, got ${pair.background}`);
  const shift = Math.abs(relativeLuminance(out) - relativeLuminance(red));
  assert.ok(shift < 0.05, `expected a small lightness nudge, luminance moved by ${shift}`);
});

test("an unparseable colour falls back instead of throwing", () => {
  // Note the fallback is itself nudged: the default indigo scores 4.47:1
  // against white — three hundredths under AA, which is exactly the kind of
  // near-miss that survives review forever. So assert on the guarantee and on
  // the hue, not on getting the literal fallback string back.
  const pair = accessiblePair("not-a-colour");
  assert.ok(pair.ratio >= AA_NORMAL);
  const out = parseColor(pair.background)!;
  assert.ok(out.b > out.r && out.b > out.g, `expected the indigo fallback, got ${pair.background}`);

  assert.equal(accessiblePair(null).background, accessiblePair("not-a-colour").background);
  // Black needs no adjustment, so a caller-supplied fallback comes back intact.
  assert.equal(accessiblePair(undefined, { fallback: "#000000" }).background, "#000000");
});

test("readableOn agrees with accessiblePair", () => {
  for (const c of ["#ffea00", "#0000ff", "#ffffff", "#000000"]) {
    assert.equal(readableOn(c), accessiblePair(c).foreground);
  }
});

test("a caller can demand more than AA", () => {
  const pair = accessiblePair("#008000", { minRatio: 7 });
  assert.ok(pair.ratio >= 7, `expected AAA, got ${pair.ratio}`);
});

test("extremes are handled", () => {
  assert.ok(accessiblePair("#ffffff").ratio >= AA_NORMAL);
  assert.ok(accessiblePair("#000000").ratio >= AA_NORMAL);
  assert.equal(accessiblePair("#ffffff").adjusted, false);
  assert.equal(accessiblePair("#000000").adjusted, false);
});

test("toHex round-trips", () => {
  assert.equal(toHex({ r: 255, g: 234, b: 0 }), "#ffea00");
  assert.equal(toHex({ r: 0, g: 0, b: 0 }), "#000000");
  // Out-of-range input is clamped rather than producing a malformed string.
  assert.equal(toHex({ r: 300, g: -20, b: 12.6 }), "#ff000d");
});

test("NO colour in the sRGB cube can produce a sub-AA pair", () => {
  // The load-bearing test. Chip colours are user-editable, so the guarantee has
  // to hold for colours nobody has picked yet — not just the ones on screen
  // today. Stepping every channel by 17 covers 4,096 colours including all of
  // the saturated primaries and the awkward mid-tone band where neither a light
  // nor a dark foreground works.
  let worst = { colour: "", ratio: Infinity };
  let adjustedCount = 0;

  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        const colour = toHex({ r, g, b });
        const pair = accessiblePair(colour);
        if (pair.adjusted) adjustedCount++;

        // Trust the reported ratio only if it matches an independent
        // recomputation from the returned strings — a pair that lies about
        // itself is worse than one that fails honestly.
        const measured = contrastRatio(parseColor(pair.foreground)!, parseColor(pair.background)!);
        assert.ok(
          Math.abs(measured - pair.ratio) < 0.02,
          `${colour}: reported ${pair.ratio} but measured ${measured}`
        );
        assert.ok(measured >= AA_NORMAL, `${colour} produced ${measured}:1 (${pair.foreground} on ${pair.background})`);

        if (measured < worst.ratio) worst = { colour, ratio: measured };
      }
    }
  }

  // Most colours must pass untouched — if the nudge were firing everywhere it
  // would mean the module is quietly restyling the whole palette rather than
  // rescuing the few colours that need it.
  assert.ok(adjustedCount < 4096 * 0.1, `${adjustedCount}/4096 colours were adjusted — too many`);
  console.log(`  swept 4096 colours, worst pair ${worst.ratio.toFixed(2)}:1 (${worst.colour}), ${adjustedCount} adjusted`);
});
