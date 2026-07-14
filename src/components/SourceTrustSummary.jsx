// FILE: src/components/SourceTrustSummary.jsx
// PHASE-10A3-FRONTEND-TRUST-METADATA-CONSUMPTION-REMEDIATION-1
//
// Minimal, low-emphasis qualifier shown next to the existing SOURCE/SOURCES
// heading. This is not a second banner.

import { normalizeTrust } from "../lib/trustPresentation";

const QUALIFIER_LABEL = {
  VERIFIED_CONTROLLING: "Controlling authority",
  VERIFIED_SUPPORTING: "Supporting authority",
  RELATED_AUTHORITY_ONLY: "Related authority only"
};

export default function SourceTrustSummary({ trust }) {
  if (!trust) return null;
  const normalized = normalizeTrust(trust);
  // PHASE-10A4C Case C remediation: calibrated wording for the specific
  // "general authority found, but the requested issuance was not" case --
  // must not read as "Related authority only" (too generic) nor imply the
  // specific document was verified.
  const qualifier = normalized.specificAuthorityNotFound
    ? "General authorities cited"
    : QUALIFIER_LABEL[normalized.authoritySupport];
  if (!qualifier) return null;

  return <span className="source-trust-qualifier"> - {qualifier}</span>;
}
