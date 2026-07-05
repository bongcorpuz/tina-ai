// PATCH-08S-FOLLOWUP-FRONTEND-SECURITY-HEADERS-1 - frontend security headers test.
// Static, JSON-based validation only. Performs NO HTTP, does not call Vercel/backend,
// requires no env vars, does not start a dev server or bind ports. It validates
// the fixture and the vercel.json security headers config.

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_PATH = "evaluation/fixtures/phase-08s-followup-frontend-security-headers-1.fixture.json";
const VERCEL_PATH = "vercel.json";

const VALID_DECISIONS = [
  "FRONTEND SECURITY HEADERS FOLLOWUP PASS WITH STRICT RECOMMENDATIONS",
  "FRONTEND SECURITY HEADERS FOLLOWUP WARNING WITH STRICT RECOMMENDATIONS",
  "FRONTEND SECURITY HEADERS FOLLOWUP BLOCKED"
];

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
let vercel;
let headerMap;
let csp;

await test("fixture and vercel.json exist and parse as JSON", () => {
  check(existsSync(resolve(FIXTURE_PATH)), `${FIXTURE_PATH} must exist`);
  fx = JSON.parse(readFileSync(resolve(FIXTURE_PATH), "utf8"));
  check(existsSync(resolve(VERCEL_PATH)), "vercel.json must exist");
  vercel = JSON.parse(readFileSync(resolve(VERCEL_PATH), "utf8"));
});

await test("patch id and decision are valid", () => {
  check(fx.patch.id === "PATCH-08S-FOLLOWUP-FRONTEND-SECURITY-HEADERS-1", "patch id");
  check(VALID_DECISIONS.includes(fx.decision), `invalid decision: ${fx.decision}`);
});

await test("vercel.json has a headers array with a catch-all /(.*) source", () => {
  check(Array.isArray(vercel.headers) && vercel.headers.length > 0, "headers array present");
  const catchAll = vercel.headers.find((h) => h.source === "/(.*)");
  check(catchAll !== undefined, "catch-all /(.*) source present");
  check(Array.isArray(catchAll.headers) && catchAll.headers.length > 0, "catch-all has headers");
  // Build a key -> value map from the catch-all entry.
  headerMap = {};
  for (const h of catchAll.headers) headerMap[h.key] = h.value;
});

await test("all required security headers are present exactly once", () => {
  const catchAll = vercel.headers.find((h) => h.source === "/(.*)");
  const keys = catchAll.headers.map((h) => h.key);
  for (const key of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
    check(keys.includes(key), `header ${key} present`);
    check(keys.filter((k) => k === key).length === 1, `header ${key} not duplicated`);
  }
});

await test("header values are exact", () => {
  check(headerMap["X-Frame-Options"] === "DENY", "X-Frame-Options DENY");
  check(headerMap["X-Content-Type-Options"] === "nosniff", "X-Content-Type-Options nosniff");
  check(headerMap["Referrer-Policy"] === "strict-origin-when-cross-origin", "Referrer-Policy strict-origin-when-cross-origin");
});

await test("Permissions-Policy disables camera, microphone, and geolocation", () => {
  const pp = headerMap["Permissions-Policy"] || "";
  check(/camera=\(\)/.test(pp), "camera disabled");
  check(/microphone=\(\)/.test(pp), "microphone disabled");
  check(/geolocation=\(\)/.test(pp), "geolocation disabled");
});

await test("CSP contains all required directives", () => {
  csp = headerMap["Content-Security-Policy"] || "";
  const required = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://tina-backend-staging.onrender.com",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ];
  for (const directive of required) {
    check(csp.includes(directive), `CSP must include: ${directive}`);
  }
});

await test("CSP does not use wildcard default-src or connect-src", () => {
  check(!/default-src\s+\*/.test(csp), "no default-src *");
  check(!/connect-src\s+\*/.test(csp), "no connect-src *");
  // A bare '*' token anywhere in a source list is disallowed for these fetch directives.
  check(!/(default-src|connect-src)[^;]*\s\*(\s|;|$)/.test(csp), "no wildcard token in default-src/connect-src");
});

await test("scanner findings are recorded as addressed", () => {
  const findings = fx.scannerFindings.map((f) => f.finding);
  for (const f of ["Missing Content-Security-Policy Header", "Missing X-Frame-Options Header", "Missing X-Content-Type-Options Header", "Missing Referrer-Policy Header"]) {
    check(findings.includes(f), `scanner finding recorded: ${f}`);
  }
  check(fx.scannerFindings.every((f) => f.addressed === true), "all findings addressed");
});

await test("fixture records Phase 8S closed/not reopened, Phase 9 not started, memory inactive", () => {
  const p = fx.phaseStatus;
  check(p.phase8SClosed === true && p.phase8SReopened === false, "Phase 8S closed and not reopened");
  check(p.phase9NotStarted === true, "Phase 9 not started");
  check(p.phase08XClosed === true, "08X closed");
  check(p.memoryInactive === true, "memory inactive");
});

await test("fixture records out-of-scope items and non-backend scope", () => {
  const oos = fx.outOfScopeItems.join(" | ").toLowerCase();
  for (const item of ["backend security headers", "rate limits", "tenant", "logging redaction", "phase 9 implementation", "production rollout"]) {
    check(oos.includes(item), `out-of-scope includes: ${item}`);
  }
  check(fx.nonRuntimeScope.noBackendChange === true && fx.nonRuntimeScope.noEnvChange === true && fx.nonRuntimeScope.noDeployment === true, "non-runtime scope flags");
});

await test("prohibited claims include production fully hardened and Phase 9 started", () => {
  const pc = fx.prohibitedClaims.join(" | ").toLowerCase();
  for (const needle of ["production is fully hardened", "phase 8s is reopened", "backend security is fixed", "rate limiting is implemented", "production is deployed", "phase 9 started", "all scanner findings are globally fixed"]) {
    check(pc.includes(needle), `prohibited claims must include: ${needle}`);
  }
});

await test("this test performs no HTTP and reads no env vars", () => {
  const selfSrc = readFileSync(resolve("tests/patch-08s-followup-frontend-security-headers-1.test.mjs"), "utf8");
  check(!/[^"'`.\w]fetch\s*\(|[^"'`.\w]https?\.(request|get)\s*\(/.test(selfSrc), "no HTTP");
  check(!/process\.env\.\w/.test(selfSrc), "no process.env.<NAME> reads");
});

console.log(`\nPATCH-08S-FOLLOWUP-FRONTEND-SECURITY-HEADERS-1 tests: ${passed} passed, ${failed} failed, ${assertions} assertions`);
if (failed > 0) process.exit(1);
