// FILE: src/components/SourceTrustSummary.jsx
// PHASE-10A3-FRONTEND-TRUST-METADATA-CONSUMPTION-REMEDIATION-1
//
// A minimal, low-visual-weight qualifier shown next to the existing
// SOURCE/SOURCES heading (not a second banner -- TrustBanner already carries
// the full explanation). Only labels the authority-support level actually
// reported by the backend; never invents a per-card controlling/supporting
// distinction, since that per-card role metadata is not present on the
// public sourceCards payload (confirmed during PHASE-10A3 investigation --
// only an `authorityType` field such as "STATUTE" is present, which
// getAuthorityTypeLabel() in trustPresentation.js may use per-card).

import { normalizeTrust } from "../lib/trustPresentation";

const QUALIFIER_LABEL = {
  VERIFIED_CONTROLLING: "Controlling authority",
  VERIFIED_SUPPORTING: "Supporting authority",
  RELATED_AUTHORITY_ONLY: "Related authority only"
};

export default function SourceTrustSummary({ trust }) {
  if (!trust) return null;
  const normalized = normalizeTrust(trust);
  const qualifier = QUALIFIER_LABEL[normalized.authoritySupport];
  if (!qualifier) return null;

  return <span className="source-trust-qualifier"> · {qualifier}</span>;
}
