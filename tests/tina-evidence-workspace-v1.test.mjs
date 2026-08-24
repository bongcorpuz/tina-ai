import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve("src/App.jsx"), "utf8");
const css = readFileSync(resolve("src/App.css"), "utf8");
const panel = readFileSync(resolve("src/components/ReferencePanel.jsx"), "utf8");
const viewer = readFileSync(resolve("src/components/SourceDocumentViewer.jsx"), "utf8");

let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert(value, message);
}

check(
  app.includes('import ReferencePanel from "./components/ReferencePanel"') &&
    app.includes('import SourceDocumentViewer from "./components/SourceDocumentViewer"'),
  "App imports the evidence reader and internal source-document viewer"
);
check(
  app.includes("const [selectedReference, setSelectedReference] = useState(null)") &&
    app.includes("const isReferenceOpen = Boolean(selectedReference)") &&
    app.includes("const isDocumentOpen = isReferenceOpen && viewerMode === \"document\"") &&
    app.includes("isOpen={isReferenceOpen && !isDocumentOpen}"),
  "reader and document visibility derive from the single selected-reference state"
);
check(
  app.includes("setViewerMode(\"document\")") &&
    app.includes("setViewerMode(\"reference\")") &&
    app.includes("if (viewerMode === \"document\")"),
  "citation, document, back, and Escape transitions preserve one selected source"
);
check(
  app.includes("aria-pressed={isSelected}") &&
    /onClick=\{\(event\) => openReference\(source, event, sourceKey\)\}/.test(app),
  "normal-mode source citations remain accessible in-app selection controls"
);
check(
  app.includes("suppressLeadingShortAnswerHeading") &&
    app.includes("Short Answer") &&
    !app.includes('className="tina-indicator"'),
  "the display-only Short Answer heading and per-answer avatar are removed"
);
check(
  app.includes("msg.sourceCards?.length") && app.includes("msg.sources?.length"),
  "existing sourceCards-before-sources priority remains in the render flow"
);
check(
  app.includes("<TrustBanner trust={msg.trust} />") && app.includes("<SourceTrustSummary trust={msg.trust} />"),
  "existing trust components remain wired to live message trust"
);
check(
  panel.includes("Passage preview unavailable") &&
    /does not provide\s+an exact passage preview/.test(panel),
  "reader preserves the explicit no-passage fallback"
);
check(
  !/source\.(passage|excerpt|pageNumber|lineNumber|offset)/.test(panel),
  "reader does not consume or invent uncontracted passage or locator fields"
);
check(
  panel.includes("View source document") &&
    panel.includes("getDocumentId") &&
    !panel.includes('target="_blank"') &&
    !panel.includes("Open original source"),
  "reader opens the internal viewer rather than exposing an outbound Drive link"
);
check(
  viewer.includes("/sources/${encodeURIComponent(documentId)}/document") &&
    viewer.includes("Authorization: `Bearer ${token}`") &&
    viewer.includes("application/pdf") &&
    !/drive\.google\.com|docs\.google\.com/.test(viewer),
  "document viewer uses authenticated canonical IDs and renders no raw Drive host"
);
check(
  viewer.includes("Page {pageNumber}") &&
    viewer.includes("Zoom in") &&
    viewer.includes("Back to Evidence") &&
    viewer.includes("Source document unavailable"),
  "viewer includes real page controls, zoom controls, back behavior, and safe unavailable state"
);
check(
  css.includes("--workspace-content-measure: 760px") &&
    css.includes("max-width: var(--workspace-content-measure)") &&
    css.includes("border-radius: 0"),
  "answer, trust, sources, composer, and intentionally square user messages have explicit alignment styling"
);
check(
  css.includes(".source-document-viewer") &&
    css.includes("@media (max-width: 1099px) and (min-width: 768px)") &&
    css.includes("@media (max-width: 767px)"),
  "desktop, tablet, and mobile source-document viewer layouts are present"
);
check(
  css.includes("@media (prefers-reduced-motion: reduce)") &&
    css.includes(".reference-panel") &&
    css.includes(".source-document-viewer"),
  "reader and document-viewer motion both have reduced-motion treatment"
);

check(
  app.includes("extractDriveDocumentIdFromLegacySource") &&
    app.includes("validDocumentId") &&
    app.includes("source.driveViewUrl") &&
    app.includes("metadata.webViewLink") &&
    viewer.includes("/sources/${encodeURIComponent(documentId)}/document"),
  "existing Drive-backed source metadata resolves only to a canonical internal-viewer ID"
);

console.log(`TINA Evidence Workspace V1 checks: ${assertions} assertions passed`);
