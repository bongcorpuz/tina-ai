// FILE: tests/phase-10a3-r1-history-trust-persistence-accessibility-and-visual-validation-1.test.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error.message);
  }
}

function luminance(hex) {
  const raw = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
  const linear = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
}

test("history reload maps persisted trust from top-level or metadata and rejects malformed payloads", () => {
  const appSrc = readFileSync("src/App.jsx", "utf8");
  assert.match(appSrc, /function normalizeReloadedTrust\(row = \{\}\)/);
  assert.match(appSrc, /row\.trust \|\| row\.metadata\?\.trust \|\| null/);
  assert.match(appSrc, /typeof candidate === "object" && !Array\.isArray\(candidate\)/);
  assert.match(appSrc, /trust:\s*normalizeReloadedTrust\(msg\)/);
});

test("warning trust contrast is corrected from 3.49:1 to at least WCAG AA 4.5:1", () => {
  const before = contrast("#9a741e", "#f4e7c1");
  const after = contrast("#735313", "#f4e7c1");
  assert.equal(before, 3.49);
  assert.equal(after, 5.73);
  assert(after >= 4.5);

  const css = readFileSync("src/App.css", "utf8");
  assert.match(css, /--trust-warning-ink:\s*#735313/);
  assert.match(css, /color:\s*var\(--trust-warning-ink\)/);
});

test("critical and warning trust states use alert, lower-emphasis states use status", () => {
  const bannerSrc = readFileSync("src/components/TrustBanner.jsx", "utf8");
  assert.match(bannerSrc, /severity === "critical" \|\| severity === "warning" \? "alert" : "status"/);
  assert.match(bannerSrc, /aria-hidden="true"/);
  assert.doesNotMatch(bannerSrc, /â|△|✓/);
});

test("visual hierarchy remains one primary trust banner per message", () => {
  const appSrc = readFileSync("src/App.jsx", "utf8");
  const bannerCalls = appSrc.match(/<TrustBanner trust=\{msg\.trust\} \/>/g) || [];
  assert.equal(bannerCalls.length, 1);
});

console.log(`\nPHASE-10A3-R1 frontend tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
