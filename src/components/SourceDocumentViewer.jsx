// TINA Evidence Workspace — internal source-document inspection only.
// Uses an authenticated canonical document ID; never receives or renders a Drive URL.

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function getSafeDocumentState(response) {
  if (response.status === 401) return "session-required";
  if (response.status === 415) return "format-unavailable";
  if (response.status === 404 || response.status === 403 || response.status === 400) {
    return "unavailable";
  }
  return "retrieval-unavailable";
}

export default function SourceDocumentViewer({
  source,
  documentId,
  isOpen,
  token,
  apiBase,
  onBackToEvidence,
  onClose,
  getAuthorityLabel,
  getAuthorityTypeLabel
}) {
  const panelRef = useRef(null);
  const canvasRef = useRef(null);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [loadState, setLoadState] = useState("idle");
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);

  const isMobileViewer = window.matchMedia("(max-width: 767px)").matches;
  const title =
    source?.documentTitle ||
    source?.document_title ||
    source?.title ||
    (source ? getAuthorityLabel(source) : "Source document");
  const authorityType = source ? getAuthorityTypeLabel(source) : "";
  const locator =
    source?.sectionScope ||
    source?.section_scope ||
    source?.locator ||
    source?.citation ||
    source?.reference ||
    null;

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return undefined;

    const element = canvasRef.current;
    const updateWidth = () => setPageWidth(Math.max(240, element.clientWidth - 2));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const panel = panelRef.current;
    if (!panel || !isMobileViewer) return undefined;

    const selector = 'button:not([disabled]), [href]';
    const focusable = Array.from(panel.querySelectorAll(selector));
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
  }, [isOpen, isMobileViewer, loadState]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let active = true;
    let objectUrl = null;

    async function loadDocument() {
      setPageCount(0);
      setPageNumber(1);
      setScale(1);
      setDocumentUrl(null);

      if (!token) {
        setLoadState("session-required");
        return;
      }

      if (!documentId) {
        setLoadState("unavailable");
        return;
      }

      setLoadState("loading");

      try {
        const response = await fetch(
          `${apiBase}/sources/${encodeURIComponent(documentId)}/document`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (!response.ok) {
          if (active) setLoadState(getSafeDocumentState(response));
          return;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().includes("application/pdf")) {
          if (active) setLoadState("format-unavailable");
          return;
        }

        const documentBlob = await response.blob();
        objectUrl = URL.createObjectURL(documentBlob);

        if (active) {
          setDocumentUrl(objectUrl);
          setLoadState("ready");
        }
      } catch {
        if (active) setLoadState("retrieval-unavailable");
      }
    }

    void loadDocument();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiBase, documentId, isOpen, token]);

  if (!source) return null;

  const unavailableCopy = {
    "session-required": {
      label: "Session required",
      body: "Sign in to TINA to inspect source documents in this workspace."
    },
    unavailable: {
      label: "Source document unavailable",
      body: "TINA cannot provide this source document from the current source record."
    },
    "format-unavailable": {
      label: "Document format unavailable",
      body: "This source is available to TINA but cannot be rendered as a PDF in the document viewer."
    },
    "retrieval-unavailable": {
      label: "Document retrieval unavailable",
      body: "TINA could not retrieve this source document. Try again later or review it with an authorized administrator."
    }
  };

  const unavailable = unavailableCopy[loadState];

  return (
    <aside
      ref={panelRef}
      className={`source-document-viewer ${isOpen ? "is-open" : ""}`}
      aria-label={`Source document: ${title}`}
      aria-hidden={!isOpen}
      role={isMobileViewer && isOpen ? "dialog" : "complementary"}
      aria-modal={isMobileViewer && isOpen ? "true" : undefined}
    >
      <header className="source-document-header">
        <button
          type="button"
          className="source-document-back"
          onClick={onBackToEvidence}
        >
          <span aria-hidden="true">←</span>
          <span>Back to Evidence</span>
        </button>

        <button
          type="button"
          className="source-document-close"
          onClick={onClose}
          aria-label="Close source document viewer"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="source-document-body">
        <div className="reference-eyebrow">TINA source document viewer</div>
        <h2>{title}</h2>
        {(authorityType || locator) && (
          <div className="reference-metadata">
            {authorityType && <span className="reference-type">{authorityType}</span>}
            {locator && <span className="reference-locator">{locator}</span>}
          </div>
        )}

        <div className="source-document-rule" />

        {loadState === "loading" && (
          <section className="source-document-state" aria-live="polite">
            <span className="source-document-spinner" aria-hidden="true" />
            <div>
              <span className="reference-eyebrow">Loading source document</span>
              <p>TINA is preparing this source for secure in-workspace review.</p>
            </div>
          </section>
        )}

        {unavailable && (
          <section className="source-document-state source-document-unavailable" aria-live="polite">
            <span className="passage-unavailable-icon" aria-hidden="true">i</span>
            <div>
              <span className="reference-eyebrow">{unavailable.label}</span>
              <p>{unavailable.body}</p>
              <p className="passage-unavailable-note">
                No external document URL, file path, or source-system detail is shown.
              </p>
            </div>
          </section>
        )}

        {loadState === "ready" && documentUrl && (
          <section className="source-document-canvas" aria-label="PDF source document">
            <div className="source-document-controls" aria-label="Document controls">
              <button
                type="button"
                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                disabled={pageNumber <= 1}
              >
                Previous
              </button>
              <span aria-live="polite">
                Page {pageNumber}{pageCount ? ` of ${pageCount}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setPageNumber((current) => Math.min(pageCount || current, current + 1))}
                disabled={!pageCount || pageNumber >= pageCount}
              >
                Next
              </button>
              <div className="source-document-zoom" aria-label="Zoom controls">
                <button
                  type="button"
                  onClick={() => setScale((current) => Math.max(0.75, Number((current - 0.15).toFixed(2))))}
                  disabled={scale <= 0.75}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span>{Math.round(scale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setScale((current) => Math.min(1.6, Number((current + 0.15).toFixed(2))))}
                  disabled={scale >= 1.6}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>

            <div className="source-document-page" ref={canvasRef}>
              <Document
                file={documentUrl}
                loading={null}
                error={
                  <div className="source-document-state source-document-unavailable">
                    <span className="passage-unavailable-icon" aria-hidden="true">i</span>
                    <div>
                      <span className="reference-eyebrow">Document rendering unavailable</span>
                      <p>TINA retrieved the document but could not render it in this workspace.</p>
                    </div>
                  </div>
                }
                onLoadSuccess={({ numPages }) => {
                  setPageCount(numPages);
                  setPageNumber((current) => Math.min(Math.max(current, 1), numPages));
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth || undefined}
                  scale={scale}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </Document>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
