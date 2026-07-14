// FILE: src/components/TrustBanner.jsx
// PHASE-10A3-FRONTEND-TRUST-METADATA-CONSUMPTION-REMEDIATION-1
//
// Renders one consolidated trust panel per message, built from
// src/lib/trustPresentation.js's buildTrustPresentation(). Never renders
// more than one primary notice at a time, and never relies on color alone.

import { buildTrustPresentation, TRUST_KIND } from "../lib/trustPresentation";

const SEVERITY_MARKER = {
  critical: "!",
  warning: "!",
  info: "i",
  positive: "OK"
};

const KIND_TEST_ID = {
  [TRUST_KIND.RESTRICTED]: "restricted",
  [TRUST_KIND.VERIFIED_CONFLICT]: "verified-conflict",
  [TRUST_KIND.POTENTIAL_CONFLICT]: "potential-conflict",
  [TRUST_KIND.SOURCE_FAILURE]: "source-failure",
  [TRUST_KIND.NO_VERIFIED_AUTHORITY]: "no-verified-authority",
  [TRUST_KIND.RELATED_AUTHORITY_ONLY]: "related-authority-only",
  [TRUST_KIND.SPECIFIC_AUTHORITY_NOT_FOUND]: "specific-authority-not-found",
  [TRUST_KIND.VERIFIED_CONTROLLING]: "verified-controlling",
  [TRUST_KIND.VERIFIED_SUPPORTING]: "verified-supporting",
  [TRUST_KIND.PROCEDURAL]: "procedural"
};

export default function TrustBanner({ trust }) {
  const presentation = buildTrustPresentation(trust);
  if (!presentation) return null;

  const { kind, severity, label, description, secondaryLabel, humanReviewRequired } = presentation;
  const liveRole = severity === "critical" || severity === "warning" ? "alert" : "status";

  return (
    <div
      className={`trust-banner trust-banner-${severity}`}
      data-trust-kind={KIND_TEST_ID[kind] || "unknown"}
      role={liveRole}
    >
      <div className="trust-banner-row">
        <span className="trust-banner-marker" aria-hidden="true">
          {SEVERITY_MARKER[severity] || "i"}
        </span>
        <span className="trust-banner-label">{label}</span>
        {secondaryLabel && (
          <span className="trust-banner-secondary">{secondaryLabel}</span>
        )}
        {humanReviewRequired && (
          <span className="trust-banner-review-tag">Human review required</span>
        )}
      </div>
      <p className="trust-banner-description">{description}</p>
    </div>
  );
}
