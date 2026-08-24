// TINA Evidence Workspace V1 — Editorial Evidence Desk.
// A source reader must show only data supplied by the existing source record.
// Exact passages, locators, and hierarchy roles are never inferred here.

import { useEffect, useRef } from "react";

export default function ReferencePanel({
  source,
  isOpen,
  onClose,
  getAuthorityLabel,
  getSourceHref,
  getAuthorityTypeLabel
}) {
  const panelRef = useRef(null);
  const isMobileReader = window.matchMedia("(max-width: 767px)").matches;

  useEffect(() => {
    if (!isOpen || !isMobileReader || !panelRef.current) return undefined;

    const panel = panelRef.current;
    const focusableSelector = 'button:not([disabled]), a[href]';
    const focusable = Array.from(panel.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    firstFocusable?.focus();

    const trapFocus = (event) => {
      if (event.key !== "Tab" || focusable.length === 0) return;
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    panel.addEventListener("keydown", trapFocus);
    return () => panel.removeEventListener("keydown", trapFocus);
  }, [isOpen, isMobileReader]);

  if (!source) return null;

  const title =
    source.documentTitle ||
    source.document_title ||
    source.title ||
    getAuthorityLabel(source);
  const authorityType = getAuthorityTypeLabel(source);
  const locator =
    source.sectionScope ||
    source.section_scope ||
    source.locator ||
    source.citation ||
    source.reference ||
    null;
  const sourceHref = getSourceHref(source);

  return (
    <aside
      ref={panelRef}
      className={`reference-panel ${isOpen ? "is-open" : ""}`}
      aria-label={`Reference: ${title}`}
      aria-hidden={!isOpen}
      role={isMobileReader && isOpen ? "dialog" : "complementary"}
      aria-modal={isMobileReader && isOpen ? "true" : undefined}
    >
      <header className="reference-panel-header">
        <button
          className="reference-back-button"
          type="button"
          onClick={onClose}
          aria-label="Back to conversation"
        >
          <span aria-hidden="true">←</span>
          <span>Reference</span>
        </button>

        <span className="reference-eyebrow">Evidence reader</span>

        <button
          className="reference-close-button"
          type="button"
          onClick={onClose}
          aria-label="Close reference panel"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="reference-panel-body" key={String(title)}>
        <div className="reference-eyebrow">Reference</div>
        <h2>{title}</h2>

        {(authorityType || locator) && (
          <div className="reference-metadata">
            {authorityType && <span className="reference-type">{authorityType}</span>}
            {locator && <span className="reference-locator">{locator}</span>}
          </div>
        )}

        <div className="reference-rule" />

        <section className="passage-unavailable" aria-labelledby="passage-unavailable-title">
          <span className="passage-unavailable-icon" aria-hidden="true">i</span>
          <div>
            <span className="reference-eyebrow" id="passage-unavailable-title">
              Passage preview unavailable
            </span>
            <p>
              The current source record identifies this authority but does not provide
              an exact passage preview.
            </p>
            <p className="passage-unavailable-note">
              No page, line, offset, surrounding text, or inferred excerpt is shown.
            </p>
          </div>
        </section>

        {sourceHref ? (
          <a
            className="open-original-source"
            href={sourceHref}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open original source <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <p className="reference-url-unavailable">
            Original-source URL is not available in this source record.
          </p>
        )}
      </div>
    </aside>
  );
}
