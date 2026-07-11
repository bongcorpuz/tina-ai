// FILE: src/lib/trustPresentation.js
// PHASE-10A3-FRONTEND-TRUST-METADATA-CONSUMPTION-REMEDIATION-1
//
// Pure, deterministic, side-effect-free adapter that converts the backend's
// canonical `trust` object (services/trust-contract.js in tina-backend,
// PHASE-10A1 / PHASE-10A1-R1 / PHASE-10A2) into a frontend presentation
// model. Never invents a stronger state than the backend actually returned;
// always falls back safely when `trust` is missing, malformed, or contains
// an unrecognized enum value (older payload, future backend version, or
// reloaded conversation history -- the backend does not persist `trust`,
// so every message loaded from GET /conversations/:id/messages will have
// no trust object at all; this is the normal, expected, frequent case, not
// a rare edge case).
//
// No numeric confidence. No claim of legal certainty. Categorical only.

// ---- Backend enum values (kept in sync with tina-backend's
// services/trust-contract.js -- do not diverge from the live contract). ----
export const AUTHORITY_SUPPORT_VALUES = Object.freeze([
  "VERIFIED_CONTROLLING",
  "VERIFIED_SUPPORTING",
  "RELATED_AUTHORITY_ONLY",
  "NO_VERIFIED_AUTHORITY",
  "CONFLICTING_AUTHORITY",
  "NOT_APPLICABLE",
  "UNKNOWN"
]);

export const SOURCE_STATE_VALUES = Object.freeze([
  "AUTHORITY_FOUND",
  "RELATED_AUTHORITY_ONLY",
  "RETRIEVAL_TIMEOUT",
  "SOURCE_LOOKUP_EMPTY",
  "SOURCE_PARSE_ERROR",
  "NO_INDEXED_SOURCE",
  "NOT_APPLICABLE",
  "UNKNOWN"
]);

export const CONFLICT_STATE_VALUES = Object.freeze([
  "VERIFIED_CONFLICT",
  "POTENTIAL_CONFLICT",
  "NO_CONFLICT",
  "UNKNOWN",
  "NOT_APPLICABLE"
]);

const SOURCE_FAILURE_STATES = new Set([
  "RETRIEVAL_TIMEOUT",
  "SOURCE_LOOKUP_EMPTY",
  "SOURCE_PARSE_ERROR",
  "NO_INDEXED_SOURCE"
]);

// ---- Frontend presentation "kind" -- the single primary state a message
// is rendered with. Matches the task's required priority order exactly:
// 1 restricted, 2 verified conflict, 3 potential conflict, 4 no verified
// authority / source failure, 5 related authority only, 6 verified
// authority, 7 procedural guidance. Anything else (domain boundary /
// NOT_APPLICABLE / missing / unrecognized) renders no banner at all. ----
export const TRUST_KIND = Object.freeze({
  RESTRICTED: "RESTRICTED",
  VERIFIED_CONFLICT: "VERIFIED_CONFLICT",
  POTENTIAL_CONFLICT: "POTENTIAL_CONFLICT",
  SOURCE_FAILURE: "SOURCE_FAILURE",
  NO_VERIFIED_AUTHORITY: "NO_VERIFIED_AUTHORITY",
  RELATED_AUTHORITY_ONLY: "RELATED_AUTHORITY_ONLY",
  VERIFIED_CONTROLLING: "VERIFIED_CONTROLLING",
  VERIFIED_SUPPORTING: "VERIFIED_SUPPORTING",
  PROCEDURAL: "PROCEDURAL"
});

// CSS severity tier -- drives color/emphasis, never the sole cue (labels and
// icons/text markers always accompany color; see TrustBanner.jsx).
export const SEVERITY = Object.freeze({
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
  POSITIVE: "positive"
});

const SOURCE_FAILURE_COPY = {
  RETRIEVAL_TIMEOUT: {
    label: "Source retrieval timed out",
    description:
      "TINA could not complete source retrieval in time for this answer. This does not mean no law or authority exists -- please retry or narrow the question."
  },
  SOURCE_LOOKUP_EMPTY: {
    label: "No indexed source found",
    description:
      "Source lookup completed, but no indexed source was found for this specific question. This does not mean no law or authority exists."
  },
  SOURCE_PARSE_ERROR: {
    label: "Source could not be verified",
    description:
      "An indexed source was found but could not be parsed for verification. This does not mean no law or authority exists."
  },
  NO_INDEXED_SOURCE: {
    label: "No indexed authority available",
    description:
      "TINA could not identify an indexed authority matching this question. This does not mean no law or authority exists -- source verification may be incomplete."
  }
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeEnum(value, allowed) {
  return typeof value === "string" && allowed.includes(value) ? value : "UNKNOWN";
}

/**
 * Normalizes a raw backend `trust` object into a safe internal shape.
 * Never throws. Unknown/missing enum values become "UNKNOWN" rather than
 * being trusted at face value, so a future backend enum addition degrades
 * to a neutral state instead of being misinterpreted as an existing one.
 */
export function normalizeTrust(trust) {
  const t = isPlainObject(trust) ? trust : {};
  return {
    version: typeof t.version === "string" ? t.version : null,
    authoritySupport: safeEnum(t.authoritySupport, AUTHORITY_SUPPORT_VALUES),
    sourceState: safeEnum(t.sourceState, SOURCE_STATE_VALUES),
    legalConclusion: ["ALLOWED", "RESTRICTED", "NOT_APPLICABLE"].includes(t.legalConclusion) ? t.legalConclusion : "UNKNOWN",
    humanReviewRequired: t.humanReviewRequired === true,
    filingReadyDocumentGenerated: t.filingReadyDocumentGenerated === true,
    automaticSubmission: t.automaticSubmission === true,
    hasConflict: t.hasConflict === true,
    conflictState: safeEnum(t.conflictState, CONFLICT_STATE_VALUES),
    limitations: Array.isArray(t.limitations) ? t.limitations.filter((l) => typeof l === "string") : [],
    responseKind: ["CONTROLLED_PROCEDURAL", "RESTRICTED_LEGAL_CONCLUSION", "GENERAL_TAX", "DOMAIN_BOUNDARY", "FALLBACK"].includes(t.responseKind)
      ? t.responseKind
      : "UNKNOWN",
    present: isPlainObject(trust)
  };
}

/**
 * Builds the frontend presentation model for a single message's trust
 * object. Returns `null` when nothing should be displayed: no trust object
 * at all (reloaded history, older payload, or a non-/ask response type),
 * a domain-boundary/NOT_APPLICABLE response, or a fully unrecognized state.
 * Rendering nothing is the safe default -- it never invents reassurance and
 * never alarms the user about a message that carries no trust signal.
 *
 * @param {object|null|undefined} rawTrust
 * @returns {null | {
 *   kind: string,
 *   severity: string,
 *   label: string,
 *   description: string,
 *   secondaryLabel: string|null,
 *   humanReviewRequired: boolean,
 *   raw: object
 * }}
 */
export function buildTrustPresentation(rawTrust) {
  const trust = normalizeTrust(rawTrust);

  // No trust object at all (reloaded history, legacy payload, non-tax
  // command route that never computes one) -- render nothing.
  if (!trust.present) return null;

  // Domain-boundary / explicitly not-applicable responses never show tax
  // trust metadata.
  if (trust.responseKind === "DOMAIN_BOUNDARY") return null;

  const base = { humanReviewRequired: trust.humanReviewRequired, raw: trust };

  // Tier 1: restricted legal conclusion (highest priority -- always wins).
  if (trust.legalConclusion === "RESTRICTED") {
    return {
      ...base,
      kind: TRUST_KIND.RESTRICTED,
      severity: SEVERITY.CRITICAL,
      label: "Final legal conclusion not provided",
      description:
        "TINA does not provide a final validity, voidness, or outcome determination for this question. Human tax/legal review is required. No win/loss prediction, no filing-ready document, and no automatic submission are provided.",
      secondaryLabel: null
    };
  }

  // Tier 2: verified conflict.
  if (trust.conflictState === "VERIFIED_CONFLICT") {
    return {
      ...base,
      kind: TRUST_KIND.VERIFIED_CONFLICT,
      severity: SEVERITY.CRITICAL,
      label: "Conflicting authorities identified",
      description:
        "TINA identified genuinely conflicting authorities for this question. This answer should not be treated as settled -- professional review is recommended.",
      secondaryLabel: null
    };
  }

  // Tier 3: potential conflict.
  if (trust.conflictState === "POTENTIAL_CONFLICT") {
    return {
      ...base,
      kind: TRUST_KIND.POTENTIAL_CONFLICT,
      severity: SEVERITY.WARNING,
      label: "Possible authority conflict",
      description:
        "TINA detected incomplete or potentially inconsistent authority evidence. This is not a confirmed conflict, but the answer should be reviewed professionally before relying on it.",
      secondaryLabel: trust.authoritySupport === "RELATED_AUTHORITY_ONLY" ? "Related authority only" : null
    };
  }

  // Tier 4: no verified authority, or a named source/retrieval failure.
  if (SOURCE_FAILURE_STATES.has(trust.sourceState)) {
    const copy = SOURCE_FAILURE_COPY[trust.sourceState];
    return {
      ...base,
      kind: TRUST_KIND.SOURCE_FAILURE,
      severity: SEVERITY.WARNING,
      label: copy.label,
      description: copy.description,
      secondaryLabel: null
    };
  }
  if (trust.authoritySupport === "NO_VERIFIED_AUTHORITY") {
    return {
      ...base,
      kind: TRUST_KIND.NO_VERIFIED_AUTHORITY,
      severity: SEVERITY.WARNING,
      label: "No verified authority found",
      description:
        "This does not mean no law or authority exists. Source verification may be incomplete -- do not rely on any authority-looking conclusion in this answer without independent verification.",
      secondaryLabel: null
    };
  }

  // Tier 5: related authority only.
  if (trust.authoritySupport === "RELATED_AUTHORITY_ONLY") {
    return {
      ...base,
      kind: TRUST_KIND.RELATED_AUTHORITY_ONLY,
      severity: SEVERITY.INFO,
      label: "Related authority only",
      description:
        "The sources shown are relevant but may not directly control this issue. Professional interpretation may be required -- related authority is not the same as controlling authority.",
      secondaryLabel: null
    };
  }

  // Tier 6: verified authority (controlling, or supporting if the backend
  // ever actually returns it -- VERIFIED_SUPPORTING is currently reserved
  // and unreachable in the live backend contract; this branch exists only
  // so the frontend is ready if that ever changes, and is not presented as
  // a routinely available state).
  if (trust.authoritySupport === "VERIFIED_CONTROLLING") {
    return {
      ...base,
      kind: TRUST_KIND.VERIFIED_CONTROLLING,
      severity: SEVERITY.POSITIVE,
      label: "Verified controlling authority",
      description:
        "This answer is grounded in verified controlling authority. This is not a final legal opinion -- verify applicability to your specific facts.",
      secondaryLabel: null
    };
  }
  if (trust.authoritySupport === "VERIFIED_SUPPORTING") {
    return {
      ...base,
      kind: TRUST_KIND.VERIFIED_SUPPORTING,
      severity: SEVERITY.POSITIVE,
      label: "Verified supporting authority",
      description:
        "This answer is grounded in verified supporting authority, distinct from controlling authority. This is not a final legal opinion.",
      secondaryLabel: null
    };
  }

  // Tier 7: controlled procedural guidance.
  if (trust.responseKind === "CONTROLLED_PROCEDURAL") {
    return {
      ...base,
      kind: TRUST_KIND.PROCEDURAL,
      severity: SEVERITY.INFO,
      label: "Procedural guidance",
      description:
        "This response helps organize facts, documents, and next steps. It is not a final legal conclusion.",
      secondaryLabel: null
    };
  }

  // Everything else (NOT_APPLICABLE, UNKNOWN, unrecognized combinations):
  // render nothing rather than guessing.
  return null;
}

// ---- Optional, honest per-source-card "kind of authority" label. Only
// uses the `authorityType` field the backend actually returns on source
// cards (e.g. "STATUTE"); never infers a controlling/supporting HIERARCHY
// role from title or position, since that per-card role metadata does not
// exist on the public sourceCards payload today (confirmed against a live
// staging response during PHASE-10A3 investigation). ----
const AUTHORITY_TYPE_LABELS = {
  STATUTE: "Statute",
  LAW: "Statute",
  REGULATION: "Regulation",
  REVENUE_REGULATION: "Regulation",
  RULING: "Ruling",
  BIR_RULING: "Ruling",
  ISSUANCE: "Issuance",
  MEMORANDUM_CIRCULAR: "Circular",
  JURISPRUDENCE: "Case Law",
  CASE_LAW: "Case Law",
  COURT_DECISION: "Case Law",
  SUPREME_COURT: "Case Law",
  CTA: "Case Law"
};

export function getAuthorityTypeLabel(sourceCard) {
  const raw = String(sourceCard?.authorityType || sourceCard?.authority_type || "").toUpperCase().trim();
  if (!raw) return null;
  return AUTHORITY_TYPE_LABELS[raw] || null;
}
