import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve("src/App.jsx"), "utf8");
const css = readFileSync(resolve("src/App.css"), "utf8");
const panel = readFileSync(resolve("src/components/ReferencePanel.jsx"), "utf8");

let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert(value, message);
}

check(
  app.includes('import ReferencePanel from "./components/ReferencePanel"'),
  "App imports the reusable reference panel"
);
check(
  app.includes("const [selectedReference, setSelectedReference] = useState(null)") &&
    app.includes("const isReferenceOpen = Boolean(selectedReference)") &&
    app.includes("isOpen={Boolean(selectedReference)}"),
  "reader visibility derives from the single selected-reference state"
);
check(
  app.includes("aria-pressed={isSelected}") &&
    /onClick=\{\(event\) => openReference\(source, event, sourceKey\)\}/.test(app),
  "normal-mode source citations are accessible in-app selection controls"
);
check(
  app.includes("if (isReferenceOpen)") && app.includes("citationTriggerRef.current?.focus()"),
  "Escape/close behavior prioritizes reference close and restores citation focus"
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
  "reader uses an explicit no-passage fallback"
);
check(
  !/source\.(passage|excerpt|pageNumber|lineNumber|offset)/.test(panel),
  "reader does not consume or invent uncontracted passage or locator fields"
);
check(
  panel.includes('target="_blank"') && panel.includes('rel="noreferrer noopener"') &&
    panel.includes("Original-source URL is not available in this source record."),
  "reader separates safe outbound links from the no-URL fallback"
);
check(
  css.includes("grid-template-columns: minmax(0, 1fr) minmax(392px, 38%)") &&
    css.includes("@media (max-width: 1099px) and (min-width: 768px)") &&
    css.includes("@media (max-width: 767px)"),
  "desktop, tablet, and mobile evidence-reader layouts are present"
);
check(
  css.includes("@media (prefers-reduced-motion: reduce)") && css.includes(".reference-panel"),
  "reference motion has a reduced-motion treatment"
);

console.log(`TINA Evidence Workspace V1 checks: ${assertions} assertions passed`);
