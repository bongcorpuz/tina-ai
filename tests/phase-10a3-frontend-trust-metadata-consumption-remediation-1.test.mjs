// FILE: tests/phase-10a3-frontend-trust-metadata-consumption-remediation-1.test.mjs
// PHASE-10A3-FRONTEND-TRUST-METADATA-CONSUMPTION-REMEDIATION-1
//
// Directly executes the real, pure src/lib/trustPresentation.js functions
// against every required scenario (not string scans). Static, no HTTP, no
// dev server, no env vars. Component-level (TrustBanner.jsx /
// SourceTrustSummary.jsx) rendering is not tested with a rendering
// framework -- this repository has no React Testing Library / Vitest
// installed (confirmed: package.json has no test runner), and the existing
// frontend test convention (tests/patch-08s-...test.mjs) is plain
// node:assert scripts against pure logic/fixtures. Introducing a rendering
// framework solely for this task was judged not justified per the task's
// own instruction to avoid a heavy framework without justification; instead
// this suite verifies the components import and call the real, tested
// presentation functions (source-level wiring check), and the presentation
// logic itself -- where all the actual decision complexity lives -- is
// fully covered by real execution below.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildTrustPresentation,
  normalizeTrust,
  getAuthorityTypeLabel,
  TRUST_KIND,
  SEVERITY,
  AUTHORITY_SUPPORT_VALUES,
  SOURCE_STATE_VALUES,
  CONFLICT_STATE_VALUES
} from "../src/lib/trustPresentation.js";

const PATCH = "PHASE-10A3-FRONTEND-TRUST-METADATA-CONSUMPTION-REMEDIATION-1";
const FIXTURE_PATH = "evaluation/fixtures/phase-10a3-frontend-trust-metadata-consumption-remediation-1.fixture.json";
const REPORT_PATH = "PHASE-10A3-FRONTEND-TRUST-METADATA-CONSUMPTION-REMEDIATION-1_REPORT.md";
const TRUST_BANNER_PATH = "src/components/TrustBanner.jsx";
const SOURCE_TRUST_SUMMARY_PATH = "src/components/SourceTrustSummary.jsx";
const APP_PATH = "src/App.jsx";

let passed = 0;
let failed = 0;
let assertions = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(`  ${error.message}`);
  }
}

function check(condition, message) {
  assertions += 1;
  assert(condition, message);
}

let fx;

await test("fixture exists and is valid JSON with both required sections", () => {
  check(existsSync(resolve(FIXTURE_PATH)), "fixture file exists");
  fx = JSON.parse(readFileSync(resolve(FIXTURE_PATH), "utf8"));
  check(Array.isArray(fx.cases) && fx.cases.length >= 18, "at least 18 trust presentation cases recorded");
  check(Array.isArray(fx.sourceCardRoleCases) && fx.sourceCardRoleCases.length > 0, "source-card role cases recorded");
});

await test("all fixture cases produce the exact required kind/severity via real execution", () => {
  for (const c of fx.cases) {
    const input = c.input === "__UNDEFINED__" ? undefined : c.input;
    let result;
    assert.doesNotThrow(() => { result = buildTrustPresentation(input); }, `${c.id}: does not throw`);
    if (c.expectedKind === null) {
      check(result === null, `${c.id}: expected null (no banner), got ${JSON.stringify(result)}`);
      continue;
    }
    check(result !== null, `${c.id}: expected a presentation object, got null`);
    check(result.kind === c.expectedKind, `${c.id}: expected kind ${c.expectedKind}, got ${result.kind}`);
    if (c.expectedSeverity) check(result.severity === c.expectedSeverity, `${c.id}: expected severity ${c.expectedSeverity}, got ${result.severity}`);
    if (c.expectedLabel) check(result.label === c.expectedLabel, `${c.id}: expected label "${c.expectedLabel}", got "${result.label}"`);
    if (c.expectedSecondaryLabel) check(result.secondaryLabel === c.expectedSecondaryLabel, `${c.id}: expected secondaryLabel "${c.expectedSecondaryLabel}", got "${result.secondaryLabel}"`);
    if (typeof c.expectedHumanReviewRequired === "boolean") check(result.humanReviewRequired === c.expectedHumanReviewRequired, `${c.id}: expected humanReviewRequired ${c.expectedHumanReviewRequired}`);
  }
});

await test("1. verified controlling authority", () => {
  const r = buildTrustPresentation(fx.cases.find((c) => c.id === "1-verified-controlling").input);
  check(r.kind === TRUST_KIND.VERIFIED_CONTROLLING, "kind is VERIFIED_CONTROLLING");
  check(r.severity === SEVERITY.POSITIVE, "severity is positive");
  check(!/final legal opinion/i.test(r.description) || /not a final legal opinion/i.test(r.description), "does not imply a final legal opinion without qualifying it");
});

await test("2. verified supporting authority (reserved/unreachable backend state, frontend must not manufacture it)", () => {
  const supportingCase = fx.cases.find((c) => c.id === "2-verified-supporting");
  const r = buildTrustPresentation(supportingCase.input);
  check(r.kind === TRUST_KIND.VERIFIED_SUPPORTING, "kind is VERIFIED_SUPPORTING only when the backend explicitly returns it");
  check(r.label !== buildTrustPresentation(fx.cases.find((c) => c.id === "1-verified-controlling").input).label,
    "VERIFIED_SUPPORTING label is visually/textually distinct from VERIFIED_CONTROLLING");
  // The frontend must never derive VERIFIED_SUPPORTING from any other input shape.
  const controllingInput = fx.cases.find((c) => c.id === "1-verified-controlling").input;
  check(buildTrustPresentation(controllingInput).kind !== TRUST_KIND.VERIFIED_SUPPORTING, "VERIFIED_CONTROLLING input never produces VERIFIED_SUPPORTING");
});

await test("3-8. related authority / no verified authority / all four named source failures", () => {
  for (const id of ["3-related-authority-only", "4-no-verified-authority", "5-retrieval-timeout", "6-source-lookup-empty", "7-source-parse-error", "8-no-indexed-source"]) {
    const c = fx.cases.find((x) => x.id === id);
    const r = buildTrustPresentation(c.input);
    check(r !== null, `${id}: produces a presentation`);
    check(r.kind === c.expectedKind, `${id}: correct kind`);
  }
  // Each of the four source-failure states must have a DISTINCT label --
  // failures must not collapse into one generic "no law exists" message.
  const labels = new Set(
    ["5-retrieval-timeout", "6-source-lookup-empty", "7-source-parse-error", "8-no-indexed-source"]
      .map((id) => buildTrustPresentation(fx.cases.find((c) => c.id === id).input).label)
  );
  check(labels.size === 4, "all four source-failure states have distinct labels");
});

await test("9-10. potential conflict vs verified conflict are visually and textually distinct", () => {
  const potential = buildTrustPresentation(fx.cases.find((c) => c.id === "9-potential-conflict").input);
  const verified = buildTrustPresentation(fx.cases.find((c) => c.id === "10-verified-conflict").input);
  check(potential.kind === TRUST_KIND.POTENTIAL_CONFLICT, "potential conflict kind");
  check(verified.kind === TRUST_KIND.VERIFIED_CONFLICT, "verified conflict kind");
  check(potential.severity !== verified.severity, "different severity tiers (warning vs critical)");
  check(potential.label !== verified.label, "different labels");
  check(!/\bis a confirmed conflict\b|\bconfirmed conflict exists\b/i.test(potential.description), "potential conflict description does not affirmatively claim a confirmed conflict");
  check(/not a confirmed conflict/i.test(potential.description), "potential conflict description explicitly negates confirmed status");

  const combo = buildTrustPresentation(fx.cases.find((c) => c.id === "9b-potential-conflict-with-related-authority-secondary").input);
  check(combo.kind === TRUST_KIND.POTENTIAL_CONFLICT, "combination rule: conflict remains primary");
  check(combo.secondaryLabel === "Related authority only", "combination rule: related authority shown as secondary");
});

await test("11. restricted legal conclusion is prominent and forbids prohibited claims", () => {
  const r = buildTrustPresentation(fx.cases.find((c) => c.id === "11-restricted-legal-conclusion").input);
  check(r.kind === TRUST_KIND.RESTRICTED, "kind is RESTRICTED");
  check(r.severity === SEVERITY.CRITICAL, "severity is critical (highest priority)");
  check(r.humanReviewRequired === true, "human review flag carried through");
  const text = `${r.label} ${r.description}`.toLowerCase();
  for (const forbidden of ["guaranteed", "100% correct", "court-approved", "bir-approved", "final legal answer"]) {
    check(!text.includes(forbidden), `no prohibited phrase "${forbidden}"`);
  }
});

await test("12. controlled procedural guidance is restrained, not a legal conclusion", () => {
  const r = buildTrustPresentation(fx.cases.find((c) => c.id === "12-controlled-procedural").input);
  check(r.kind === TRUST_KIND.PROCEDURAL, "kind is PROCEDURAL");
  check(r.severity === SEVERITY.INFO, "severity is info, not critical");
  check(/not a final legal conclusion/i.test(r.description), "explicitly states it is not a final legal conclusion");
});

await test("13. restricted + human review renders as ONE notice, not two", () => {
  const r = buildTrustPresentation(fx.cases.find((c) => c.id === "13-human-review-attached-to-restricted").input);
  check(r.kind === TRUST_KIND.RESTRICTED, "single primary kind");
  check(r.humanReviewRequired === true, "human-review detail attached to the same object, not a second banner");
});

await test("14. domain boundary / not applicable shows no tax-trust banner", () => {
  const r = buildTrustPresentation(fx.cases.find((c) => c.id === "14-domain-boundary-not-applicable").input);
  check(r === null, "no banner rendered for domain-boundary responses");
});

await test("15. missing trust object renders normally with no crash and no false reassurance", () => {
  assert.doesNotThrow(() => buildTrustPresentation(), "no-argument call does not throw");
  assert.doesNotThrow(() => buildTrustPresentation(null), "null does not throw");
  assert.doesNotThrow(() => buildTrustPresentation(undefined), "undefined does not throw");
  assert.doesNotThrow(() => buildTrustPresentation("not-an-object"), "non-object does not throw");
  assert.doesNotThrow(() => buildTrustPresentation(42), "number does not throw");
  assert.doesNotThrow(() => buildTrustPresentation([]), "array does not throw");
  check(buildTrustPresentation(null) === null, "null -> no banner");
  check(buildTrustPresentation(undefined) === null, "undefined -> no banner");
});

await test("16. unknown future enum value degrades safely, never guessed as a known state", () => {
  const r = buildTrustPresentation(fx.cases.find((c) => c.id === "16-unknown-future-enum-value").input);
  check(r === null, "unrecognized authoritySupport value renders no banner rather than guessing");
  const normalized = normalizeTrust(fx.cases.find((c) => c.id === "16-unknown-future-enum-value").input);
  check(normalized.authoritySupport === "UNKNOWN", "unrecognized enum value normalizes to UNKNOWN internally");
});

await test("17. contradictory trust input trusts the categorical field, not the boolean, and never crashes", () => {
  const c1 = fx.cases.find((c) => c.id === "17-contradictory-trust-input");
  const r1 = buildTrustPresentation(c1.input);
  check(r1.kind === TRUST_KIND.VERIFIED_CONTROLLING, "hasConflict:true alone does not override conflictState:NO_CONFLICT");
  check(r1.kind !== TRUST_KIND.VERIFIED_CONFLICT, "a stray hasConflict boolean never manufactures a VERIFIED_CONFLICT banner");

  const c2 = fx.cases.find((c) => c.id === "17b-contradictory-malformed-limitations");
  assert.doesNotThrow(() => buildTrustPresentation(c2.input), "malformed non-array limitations does not throw");
  const normalized = normalizeTrust(c2.input);
  check(Array.isArray(normalized.limitations), "malformed limitations normalizes to a safe empty/filtered array");
});

await test("18. source-card role/type differentiation uses only real authorityType metadata, never invents controlling/supporting per card", () => {
  for (const c of fx.sourceCardRoleCases) {
    const label = getAuthorityTypeLabel(c.input);
    check(label === c.expectedLabel, `${c.id}: expected ${JSON.stringify(c.expectedLabel)}, got ${JSON.stringify(label)}`);
  }
  // Explicitly confirm no per-card GOVERNING/SUPPORTING/CONTROLLING hierarchy
  // label is ever produced by this function -- that per-card role metadata
  // does not exist on the public sourceCards payload (confirmed against a
  // live staging response during PHASE-10A3 investigation).
  const src = readFileSync(resolve("src/lib/trustPresentation.js"), "utf8");
  const fnBody = src.slice(src.indexOf("export function getAuthorityTypeLabel"));
  check(!/GOVERNING|CONTROLLING|SUPPORTING/.test(fnBody), "getAuthorityTypeLabel never emits a controlling/supporting hierarchy label");
});

await test("enum lists stay in sync with tina-backend's services/trust-contract.js shape (documented, not auto-imported across repos)", () => {
  check(AUTHORITY_SUPPORT_VALUES.includes("VERIFIED_CONTROLLING") && AUTHORITY_SUPPORT_VALUES.includes("VERIFIED_SUPPORTING"), "authoritySupport enum present");
  check(SOURCE_STATE_VALUES.includes("RETRIEVAL_TIMEOUT") && SOURCE_STATE_VALUES.includes("SOURCE_PARSE_ERROR"), "sourceState enum present");
  check(CONFLICT_STATE_VALUES.includes("VERIFIED_CONFLICT") && CONFLICT_STATE_VALUES.includes("POTENTIAL_CONFLICT"), "conflictState enum present");
});

await test("no categorical output ever contains a numeric confidence percentage or forbidden certainty phrase", () => {
  const forbiddenPatterns = [/\d+%\s*(confidence|accurate|correct)/i, /legally verified/i, /guaranteed accurate/i, /court-approved/i, /bir-approved/i];
  for (const c of fx.cases) {
    const input = c.input === "__UNDEFINED__" ? undefined : c.input;
    const r = buildTrustPresentation(input);
    if (!r) continue;
    const text = `${r.label} ${r.description} ${r.secondaryLabel || ""}`;
    for (const pattern of forbiddenPatterns) {
      check(!pattern.test(text), `${c.id}: no forbidden phrase matching ${pattern}`);
    }
  }
});

await test("determinism and no mutation: repeated calls with a frozen input produce identical output", () => {
  const input = Object.freeze({ ...fx.cases.find((c) => c.id === "1-verified-controlling").input, limitations: Object.freeze([]) });
  const r1 = buildTrustPresentation(input);
  const r2 = buildTrustPresentation(input);
  check(JSON.stringify(r1) === JSON.stringify(r2), "deterministic across repeated calls");
});

await test("TrustBanner.jsx and SourceTrustSummary.jsx import and call the real presentation functions (wiring check)", () => {
  check(existsSync(resolve(TRUST_BANNER_PATH)), "TrustBanner.jsx exists");
  check(existsSync(resolve(SOURCE_TRUST_SUMMARY_PATH)), "SourceTrustSummary.jsx exists");
  const bannerSrc = readFileSync(resolve(TRUST_BANNER_PATH), "utf8");
  check(/import\s*\{[^}]*buildTrustPresentation[^}]*\}\s*from\s*["']\.\.\/lib\/trustPresentation["']/.test(bannerSrc),
    "TrustBanner.jsx imports buildTrustPresentation from the real presentation module");
  check(bannerSrc.includes("buildTrustPresentation(trust)"), "TrustBanner.jsx calls buildTrustPresentation with the trust prop");
  check(/if\s*\(!presentation\)\s*return null/.test(bannerSrc), "TrustBanner.jsx renders nothing when there is no presentation");

  const summarySrc = readFileSync(resolve(SOURCE_TRUST_SUMMARY_PATH), "utf8");
  check(/import\s*\{[^}]*normalizeTrust[^}]*\}\s*from\s*["']\.\.\/lib\/trustPresentation["']/.test(summarySrc),
    "SourceTrustSummary.jsx imports normalizeTrust from the real presentation module");
});

await test("App.jsx captures live data.trust and restores persisted trust on reloaded history", () => {
  const appSrc = readFileSync(resolve(APP_PATH), "utf8");
  check(appSrc.includes("trust: data.trust || null"), "App.jsx captures data.trust on the live /ask response");
  check(appSrc.includes("function normalizeReloadedTrust"), "App.jsx defines reloaded trust normalization");
  check(appSrc.includes("row.trust || row.metadata?.trust || null"), "App.jsx reads both top-level and metadata trust from history rows");
  check(appSrc.includes("trust: normalizeReloadedTrust(msg)"), "App.jsx attaches restored trust to reconstructed messages");
  check(appSrc.includes("<TrustBanner trust={msg.trust} />"), "App.jsx renders TrustBanner for each tina message");
  check(appSrc.includes("<SourceTrustSummary trust={msg.trust} />"), "App.jsx renders SourceTrustSummary next to the source heading");
  check(appSrc.includes('import TrustBanner from "./components/TrustBanner"'), "App.jsx imports TrustBanner");
  check(appSrc.includes('import SourceTrustSummary from "./components/SourceTrustSummary"'), "App.jsx imports SourceTrustSummary");
});

await test("no secret appears in the fixture or report", () => {
  const combined = [FIXTURE_PATH, REPORT_PATH]
    .filter((p) => existsSync(resolve(p)))
    .map((p) => readFileSync(resolve(p), "utf8"))
    .join("\n");
  check(!/Bearer\s+ey[A-Za-z0-9_-]{10,}/.test(combined), "no bearer JWT-looking token present");
  check(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(combined), "no private key present");
  check(!/VITE_[A-Z_]*KEY\s*[:=]\s*['"]?\S/i.test(combined), "no Vite secret env value present");
});

console.log(`\n${PATCH} tests: ${passed} passed, ${failed} failed, ${assertions} assertions`);
if (failed > 0) process.exit(1);
