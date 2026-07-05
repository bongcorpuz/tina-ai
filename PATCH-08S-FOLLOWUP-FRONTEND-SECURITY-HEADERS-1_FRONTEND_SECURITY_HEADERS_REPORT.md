# PATCH-08S-FOLLOWUP-FRONTEND-SECURITY-HEADERS-1 — Frontend Security Headers Hardening Report

## 1. Patch name and purpose

**Patch:** PATCH-08S-FOLLOWUP-FRONTEND-SECURITY-HEADERS-1

**Purpose:** Address the frontend security-scanner findings on the Vercel-hosted
TINA frontend (`https://tina-fawn.vercel.app`) by adding security response headers
via `vercel.json`. This is a Phase 8S follow-up hardening item — frontend host
configuration only. It does **not** modify backend code, runtime React code, env,
packages, or dependencies, and it does **not** deploy.

## 2. Repository and scope

- **Repo:** `C:/Projects/tina-ai` (Vite + React, hosted on Vercel).
- **Branch:** `main`
- **Base commit:** `ef7d74d` (working tree clean before this patch).
- **Target frontend:** `https://tina-fawn.vercel.app`
- **Backend staging API referenced by CSP `connect-src`:**
  `https://tina-backend-staging.onrender.com`

This patch is confined to the frontend repository. No backend file, environment
variable, Render setting, Vercel dashboard setting, or deployment was touched.

## 3. Scanner findings addressed

| Severity | Finding | Header added |
|---|---|---|
| HIGH | Missing Content-Security-Policy header | `Content-Security-Policy` |
| HIGH | Missing X-Frame-Options header | `X-Frame-Options: DENY` |
| MEDIUM | Missing X-Content-Type-Options header | `X-Content-Type-Options: nosniff` |
| MEDIUM | Missing Referrer-Policy header | `Referrer-Policy: strict-origin-when-cross-origin` |

`Permissions-Policy` was also added (defense-in-depth) to disable camera,
microphone, and geolocation, which the frontend does not use.

## 4. What changed

Created `vercel.json` (none existed before) with a single catch-all
`"/(.*)"` header rule applying these response headers to every route:

- **Content-Security-Policy:**
  `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https://tina-backend-staging.onrender.com; form-action 'self'; upgrade-insecure-requests`
- **X-Frame-Options:** `DENY`
- **X-Content-Type-Options:** `nosniff`
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **Permissions-Policy:** `camera=(), microphone=(), geolocation=()`

### CSP design notes

- `default-src 'self'` establishes a fail-closed baseline; each fetch directive is
  narrowed from there.
- `frame-ancestors 'none'` + `X-Frame-Options: DENY` block clickjacking from both
  modern and legacy angles.
- `object-src 'none'` and `base-uri 'self'` remove plugin and base-tag injection
  vectors.
- `connect-src` is limited to `'self'` and the staging backend only — **no
  wildcard**. If/when a production backend origin is introduced, it must be added
  here explicitly.
- `'unsafe-inline'`/`'unsafe-eval'` in `script-src` and `'unsafe-inline'` in
  `style-src` are retained for Vite/React staging compatibility. These are the
  main residual CSP weaknesses and are flagged for later nonce/hash tightening.
- `upgrade-insecure-requests` forces HTTPS sub-resource loads.

## 5. Files created

1. `vercel.json`
2. `evaluation/fixtures/phase-08s-followup-frontend-security-headers-1.fixture.json`
3. `tests/patch-08s-followup-frontend-security-headers-1.test.mjs`
4. `PATCH-08S-FOLLOWUP-FRONTEND-SECURITY-HEADERS-1_FRONTEND_SECURITY_HEADERS_REPORT.md` (this file)

### CURRENT_STATE.md note

`knowledge/CURRENT_STATE.md` **does not exist** in the frontend repo, and this
repo does not follow that convention (it is a Dev Factory / backend governance
convention). It was therefore **not created here**. This is recorded per the task
requirement.

## 6. Validation

```text
node tests/patch-08s-followup-frontend-security-headers-1.test.mjs
PASS - 13 passed, 0 failed, 62 assertions
```

The test is static and JSON-based: it performs no HTTP, reads no env vars, starts
no dev server, and binds no ports. It asserts that `vercel.json` parses, that all
five headers are present exactly once under the catch-all source, that the exact
header values are correct, that all required CSP directives are present, and that
CSP uses no wildcard `default-src *` or `connect-src *`. `npm run build` and
`npm test` are optional for this config-only change and were not required to pass
the gate; no dependency install or deployment was performed.

## 7. Security posture and limitations

**Improved:** clickjacking protection, MIME-sniffing protection, referrer leakage
reduction, a fail-closed CSP baseline, and disabling of unused sensitive browser
permissions.

**Not claimed / still open (out of scope for this patch):**

- Post-deploy verification (re-scan + browser console) is still required once the
  config is deployed by a separate decision.
- CSP may need tuning if legitimate third-party resources (fonts, analytics, auth,
  external images) get blocked.
- `'unsafe-inline'` / `'unsafe-eval'` remain in the script/style policy.
- Backend security headers, rate limits, `/routes` and `/health` minimization,
  `x-powered-by` suppression, `INDEX_SECRET` query-string removal, tenant/client/
  matter isolation, logging redaction, and third-party/Langfuse egress controls
  are **not** addressed here.
- Production readiness is **not** claimed; **no deployment was performed**.

## 8. Phase boundary

Phase 8 closed; Phase 8S closed and **not reopened** (this is a tracked Phase 8S
follow-up hardening item, not a reopening); Phase 08X closed; Phase 9 **not
started**; Phases 10/11 deferred; memory inactive (`TINA_ENABLE_MEMORY_*` and
`TINA_ENABLE_CHAT_CONTEXT_CARRYOVER` remain OFF).

## 9. Decision

```text
FRONTEND SECURITY HEADERS FOLLOWUP PASS WITH STRICT RECOMMENDATIONS
```

## 10. Strict recommendations

1. Deploy `vercel.json` via the normal Vercel pipeline as a **separate, approved**
   step, then re-run the scanner and check the browser console for CSP violations.
2. If CSP blocks legitimate resources, tighten by adding specific origins — never
   by widening to wildcards.
3. Plan a follow-up to remove `'unsafe-inline'`/`'unsafe-eval'` using nonces/hashes.
4. Add the production backend origin to `connect-src` explicitly when it exists.
5. Proceed to `PATCH-08S-FOLLOWUP-BACKEND-SECURITY-HEADERS-RATE-LIMITS-1` for the
   backend-side hardening items, or to `PHASE-09A-...-DESIGN-1` — user chooses.
6. Do not treat this patch as full production hardening.

## 11. Next task

User chooses the next priority:

- `PATCH-08S-FOLLOWUP-BACKEND-SECURITY-HEADERS-RATE-LIMITS-1` — continue Phase 8S
  hardening on the backend, or
- `PHASE-09A-PROFESSIONAL-WORKFLOW-COPILOT-DESIGN-1` — begin the Phase 9 design gate.
