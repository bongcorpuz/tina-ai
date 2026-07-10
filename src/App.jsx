import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";
import { loadChatHistory, saveChatHistory, clearChatHistory } from "./utils/chatStorage";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://tina-backend-y11x.onrender.com"
).replace(/\/$/, "");

const MAX_VISIBLE_SOURCES = 5;
const TINA_LOGO_SRC = "/tina-logo.png";

const DEFAULT_WELCOME_MESSAGE = {
  role: "tina",
  content: "Hi, I’m TINA. Ask me about Philippine tax matters...",
  sources: [],
  fallbackReferences: []
};

const TYPING_STATUS_PHRASES = [
  "Checking the facts...",
  "Finding the legal basis...",
  "Reading the tax authority...",
  "Matching the source cards...",
  "Testing the issue classification...",
  "Looking for controlling authority...",
  "Reviewing NIRC, RR, RMC, and cases...",
  "Shaping the answer...",
  "Almost there..."
];

function TypingStatusIndicator({ isLoading, phrases = TYPING_STATUS_PHRASES }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const safePhrases = phrases.length > 0 ? phrases : TYPING_STATUS_PHRASES;

  useEffect(() => {
    if (!isLoading) return undefined;

    const intervalId = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % safePhrases.length);
    }, 2800);

    return () => window.clearInterval(intervalId);
  }, [isLoading, safePhrases.length]);

  return (
    <div className="typing-status" aria-live="polite" key={phraseIndex}>
      {safePhrases[phraseIndex]}
    </div>
  );
}

function shouldHideSource(source = {}) {
  const path = String(
    source?.path ||
      source?.source_path ||
      source?.originalSource ||
      source?.source ||
      source?.title ||
      ""
  ).toLowerCase();

  return path.includes("07_cpa_notes") || path.includes("08_review_materials");
}

function getSourceKey(source = {}, index = 0) {
  return (
    source.fileId ||
    source.file_id ||
    source.driveViewUrl ||
    source.drive_view_url ||
    source.driveDownloadUrl ||
    source.drive_download_url ||
    source.path ||
    source.originalSource ||
    source.source ||
    source.title ||
    `source-${index}`
  );
}

function getSourceLabel(source = {}) {
  return (
    source.title ||
    source.source ||
    source.originalSource ||
    source.path ||
    "Untitled Source"
  );
}

function getSourceHref(source = {}) {
  return (
    source.publicUrl       ||
    source.public_url      ||
    source.driveViewUrl    ||
    source.drive_view_url  ||
    source.driveDownloadUrl ||
    source.drive_download_url ||
    source.url             ||
    source.href            ||
    null
  );
}

// Extract the filename portion of a path-like string.
// "documents/RR_16-2005.pdf"          → "RR_16-2005.pdf"
// "C:\\tax_docs\\RMC_65-2012.pdf"     → "RMC_65-2012.pdf"
// "RR_16-2005.pdf"                    → "RR_16-2005.pdf" (no-op)
function safeBasename(p = "") {
  return String(p || "").replace(/^.*[/\\]/, "");
}

// Strip filename suffixes and normalise an authority reference string.
// "RR No. 16-2005 — RR_16-2005.pdf" → "RR No. 16-2005"
// "NIRC-1997-RA-10963 (BIR).pdf"    → "NIRC / RA 10963"
// "RR_16-2005"                       → "RR 16-2005"
// "RMC_65-2012"                      → "RMC 65-2012"
function cleanAuthorityRef(ref = "") {
  return String(ref || "")
    // Strip " — filename.ext" suffix (em-dash, en-dash, or hyphen separator).
    // Hyphen placed at END of character class to avoid no-useless-escape lint error.
    .replace(/\s+[—–-]{1,2}\s+\S+\.(pdf|docx?|txt|xlsx?|pptx?)\b.*/i, "")
    // Strip bare ".ext" at end of string
    .replace(/\.(pdf|docx?|txt|xlsx?|pptx?)\s*$/i, "")
    // Remove "(BIR)" and similar parenthetical suffix tags
    .replace(/\s*\(BIR\)\s*/gi, " ")
    // Underscores → spaces  (RR_16-2005 → RR 16-2005)
    .replace(/_/g, " ")
    // NIRC-YYYY-RA-NNNNN compound filename → "NIRC / RA NNNNN"
    .replace(/\bNIRC[-\s]+\d{4}[-\s]+RA[-\s]+(\d+)\b/i, "NIRC / RA $1")
    // Collapse multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Authority-first display label for source chips.
// Uses the authority/issuance reference fields set by pipeline.js sourceCards
// construction (normalizedReference = inferIssuanceNumber → provRef).
// Falls back to a cleaned title that strips the " — filename.ext" portion.
function getAuthorityLabel(source = {}) {
  const ref =
    source.normalized_reference ||
    source.normalizedReference   ||
    source.citation              ||
    source.reference             ||
    source.authority_label       ||
    source.authorityLabel        ||
    source.sectionScope          ||
    source.section_scope         ||
    "";

  if (ref.trim()) return cleanAuthorityRef(ref);

  // Fallback: prefer document/title fields over raw path strings.
  // For path-like fields (source, originalSource, path) strip directory so we
  // never expose folder paths, chunk IDs, or retrieval-layer strings as labels.
  const raw =
    source.documentTitle                                                ||
    source.document_title                                               ||
    source.title                                                        ||
    (source.source        ? safeBasename(source.source)        : "") ||
    (source.originalSource ? safeBasename(source.originalSource) : "") ||
    (source.path          ? safeBasename(source.path)          : "") ||
    "";
  return cleanAuthorityRef(raw) || "Source";
}

// Stable dedupe key for a source object.
// Priority: normalized_reference → citation/authority → reference →
//           documentTitle/title → source/originalSource/filename → url → id → path
function getDedupeKey(source = {}) {
  const raw =
    source.normalized_reference ||
    source.normalizedReference  ||
    source.citation             ||
    source.authority_label      ||
    source.authorityLabel       ||
    source.sectionScope         ||
    source.section_scope        ||
    source.reference            ||
    source.documentTitle        ||
    source.document_title       ||
    source.title                ||
    (source.source        ? safeBasename(source.source)        : "") ||
    (source.originalSource ? safeBasename(source.originalSource) : "") ||
    source.filename             ||
    source.driveViewUrl         ||
    source.drive_view_url       ||
    source.url                  ||
    source.href                 ||
    source.id                   ||
    (source.sourcePath ? safeBasename(source.sourcePath) : "") ||
    (source.path       ? safeBasename(source.path)       : "") ||
    "";
  return String(raw).trim().toLowerCase() || null;
}

function normalizeSources(rawSources, { uncapped = false } = {}) {
  if (!Array.isArray(rawSources)) return [];

  const seen = new Set();
  const filtered = rawSources
    .filter(Boolean)
    .filter((source) => !shouldHideSource(source))
    // URL presence is NOT required here — non-URL sources are shown as
    // non-clickable authority chips in normal modes.
    .filter((source) => {
      const key = getDedupeKey(source);
      if (!key) return true;          // no stable key — cannot dedupe, keep
      if (seen.has(key)) return false; // duplicate — drop
      seen.add(key);
      return true;
    });

  return uncapped ? filtered : filtered.slice(0, MAX_VISIBLE_SOURCES);
}

function normalizeFallbackReferences(rawFallbackReferences) {
  return Array.isArray(rawFallbackReferences)
    ? rawFallbackReferences.slice(0, 5)
    : [];
}

// Infer the originating command hook from a persisted message row.
// Used by loadConversationMessages to restore section headings (LEGAL BASIS,
// ANSWER BASIS, SOURCES) that would otherwise degrade to SOURCE after reload.
//
// Priority:
//   1. row.hook / row.metadata?.hook    (if backend persists the hook field)
//   2. row.route / row.command          (alternate persisted field names)
//   3. Mode-field inference (commandMode, responseMode, mode, …)
//   4. requiresSourceVisibility flag    → /source
//   5. Default                          → /ask
function inferHookFromRow(row = {}) {
  // 1. Explicit stored hook or route
  const explicit =
    row.hook           ||
    row.metadata?.hook ||
    row.route          ||
    row.command        ||
    "";
  if (explicit) {
    const s = String(explicit).trim();
    return s.startsWith("/") ? s : `/${s}`;
  }

  // 2. Mode-field inference
  const mode = String(
    row.commandMode        ||
    row.command_mode       ||
    row.responseMode       ||
    row.response_mode      ||
    row.orchestrationMode  ||
    row.orchestration_mode ||
    row.mode               ||
    ""
  ).toUpperCase();

  if (mode.includes("REVIEW"))                              return "/review";
  if (mode.includes("QUIZ") || mode.includes("DIAGNOSTIC")) return "/quiz";
  if (mode.includes("SOURCE"))                              return "/source";
  if (mode.includes("CASE"))                                return "/case";

  // 3. Source-visibility flag implies /source
  if (
    row.requiresSourceVisibility  ||
    row.requires_source_visibility
  ) return "/source";

  return "/ask";
}

// Defensive display-only strip: removes model-generated trailing source appendix
// blocks that survived backend stripping.  All patterns are newline-anchored (\n+)
// so inline phrases like "See Sources: RR 16-2005 for details." are never affected.
// Does NOT mutate stored msg.content — only the value passed to ReactMarkdown.
function stripInlineSourceBlock(text = "") {
  return String(text || "")
    // "Sources Used" — plain, bold (**Sources Used:**), italic
    .replace(/\n+\*{0,2}Sources Used\*{0,2}:?\*{0,2}[\s\S]*$/i, "")
    // "Sources" — colon-present: Sources:, **Sources:**, **Sources**:, *Sources:*
    // Colon distinguishes the section header from prose ("Sources of income vary…").
    // No (?:\n|$) guard — colon alone is sufficient; catches inline lists too.
    .replace(/\n+\*{0,2}Sources\*{0,2}:\*{0,2}[\s\S]*$/i, "")
    // "Sources" — no-colon bold/italic variant (**Sources**\nItems); explicit \n guard
    .replace(/\n+\*{0,2}Sources\*{0,2}\s*\n[\s\S]*$/i, "")
    // Markdown heading variants: ## Sources, ### Sources:, # Sources Used, ## References
    .replace(/\n+#{1,6}\s*\*{0,2}(?:Sources(?:\s+Used)?|References)\*{0,2}:?[\s\S]*$/i, "")
    // "References" — plain (References:), bold (**References:**), italic
    .replace(/\n+\*{0,2}References\*{0,2}:?\*{0,2}[\s\S]*$/i, "")
    // "Validated Indexed Sources" appendix
    .replace(/\n+Validated Indexed Sources[\s\S]*$/i, "")
    .trim();
}

function ChipEl({ chip }) {
  if (!chip || typeof chip !== "object") return null;
  const title = chip.title || chip.label || "";
  if (chip.url) {
    return (
      <a
        className="educational-source-chip"
        href={chip.url}
        target="_blank"
        rel="noreferrer noopener"
        title={title}
      >
        {chip.label}
      </a>
    );
  }
  return (
    <span className="educational-source-chip disabled" title={title}>
      {chip.label}
    </span>
  );
}

function EducationalSources({ data }) {
  const chips = Array.isArray(data?.chips)
    ? data.chips.filter((chip) => chip && typeof chip === "object")
    : [];
  if (!data || chips.length === 0) return null;

  const { label } = data;
  const hasGroups = chips.some((c) => c.group);

  if (!hasGroups) {
    return (
      <div className="educational-sources">
        <span className="educational-sources-label">{label || "Sources"}</span>
        <div className="educational-source-chips">
          {chips.map((chip, i) => <ChipEl key={i} chip={chip} />)}
        </div>
      </div>
    );
  }

  const groups = {};
  const ungrouped = [];
  for (const chip of chips) {
    if (chip.group) {
      if (!groups[chip.group]) groups[chip.group] = [];
      groups[chip.group].push(chip);
    } else {
      ungrouped.push(chip);
    }
  }

  return (
    <div className="educational-sources">
      <span className="educational-sources-label">{label || "Sources"}</span>
      {Object.entries(groups).map(([groupName, groupChips]) => (
        <div key={groupName} className="educational-source-group">
          <span className="educational-source-group-title">{groupName}</span>
          <div className="educational-source-chips">
            {groupChips.map((chip, i) => <ChipEl key={i} chip={chip} />)}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="educational-source-chips">
          {ungrouped.map((chip, i) => <ChipEl key={i} chip={chip} />)}
        </div>
      )}
    </div>
  );
}

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerMobile, setRegisterMobile] = useState("");
  const [registerCompany, setRegisterCompany] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");

  const [token, setToken] = useState(localStorage.getItem("tinaToken") || "");
  const [role, setRole] = useState(localStorage.getItem("tinaRole") || "");
  const [conversationId, setConversationId] = useState(
    localStorage.getItem("tinaConversationId") || ""
  );

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tinaUser") || "{}");
    } catch {
      return {};
    }
  });

  const [loginError, setLoginError] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState(() => {
    const storedId = localStorage.getItem("tinaConversationId");
    if (storedId) {
      const cached = loadChatHistory();
      if (cached.length > 0) return cached;
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });

  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [bootstrappingConversation, setBootstrappingConversation] =
    useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const bottomRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-grow the composer textarea with content; resets when input clears.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [question]);

  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!token || conversationId || bootstrappingConversation) return;
    void ensureConversation(token);
  }, [token, conversationId, bootstrappingConversation]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setShowProfileMenu(false);
      setShowProfileModal(false);
      setShowSettingsModal(false);
      setShowHelpModal(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  async function createConversationWithToken(authToken) {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ title: "New Conversation" })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.conversation?.id) {
      throw new Error(data?.error || "Failed to create conversation.");
    }

    return data.conversation.id;
  }

  async function loadConversationMessages(authToken, id) {
    if (!id) return;

    try {
      const res = await fetch(`${API_BASE}/conversations/${id}/messages`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !Array.isArray(data?.messages)) return;

      if (data.messages.length === 0) {
        setMessages([DEFAULT_WELCOME_MESSAGE]);
        return;
      }

      const mapped = data.messages.map((msg) => {
        const rawSources =
          Array.isArray(msg.sourcesUsed)        ? msg.sourcesUsed
          : Array.isArray(msg.sources_used)     ? msg.sources_used
          : Array.isArray(msg.sources)          ? msg.sources
          : [];

        // Derive the originating hook for TINA messages.
        // Only meaningful for TINA turns; null for user bubbles.
        const hook =
          msg.role === "assistant" || msg.role === "tina"
            ? inferHookFromRow(msg)
            : null;

        // Derive requiresSourceVisibility with strongest-signal priority:
        //   1. Explicit persisted flags (most reliable)
        //   2. Hook inference (e.g. inferred /source from mode fields)
        //   3. Source count > cap (weak fallback only — misclassifies /source
        //      messages with ≤ MAX_VISIBLE_SOURCES sources)
        const requiresSourceVisibility =
          Boolean(
            msg.requiresSourceVisibility           ||
            msg.requires_source_visibility         ||
            msg.metadata?.requiresSourceVisibility ||
            msg.metadata?.forceSourceVisibility
          ) ||
          hook === "/source" ||
          rawSources.length > MAX_VISIBLE_SOURCES; // weak fallback

        return {
          role: msg.role === "assistant" ? "tina" : "user",
          content: msg.content || "",
          hook,
          // sourceCards is a frontend-computed field, not persisted server-side.
          // Leave empty so the render-loop priority rule falls through to sources.
          sourceCards: [],
          requiresSourceVisibility,
          sources: normalizeSources(rawSources, { uncapped: requiresSourceVisibility }),
          fallbackReferences: normalizeFallbackReferences(
            Array.isArray(msg.fallbackReferences)
              ? msg.fallbackReferences
              : Array.isArray(msg.fallback_references)
                ? msg.fallback_references
                : []
          ),
          educationalSources: msg.educationalSources || null
        };
      });

      setMessages(mapped);
    } catch {
      setMessages([DEFAULT_WELCOME_MESSAGE]);
    }
  }

  async function ensureConversation(authToken) {
    if (!authToken) return "";

    setBootstrappingConversation(true);

    try {
      let activeConversationId =
        localStorage.getItem("tinaConversationId") || "";

      if (!activeConversationId) {
        activeConversationId = await createConversationWithToken(authToken);
        localStorage.setItem("tinaConversationId", activeConversationId);
      }

      setConversationId(activeConversationId);
      await loadConversationMessages(authToken, activeConversationId);

      return activeConversationId;
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "tina",
          content:
            error?.message || "TINA could not initialize the conversation session.",
          sources: [],
          fallbackReferences: []
        }
      ]);
      return "";
    } finally {
      setBootstrappingConversation(false);
    }
  }

  async function resetConversation(authToken) {
    localStorage.removeItem("tinaConversationId");
    clearChatHistory();
    setConversationId("");
    setMessages([DEFAULT_WELCOME_MESSAGE]);

    if (!authToken) return "";

    return await ensureConversation(authToken);
  }

  const login = async () => {
    setLoginError("");

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Login failed.");
        return;
      }

      const userProfile = {
        username: data.username || username,
        email: data.email || "",
        mobile: data.mobile || "",
        company: data.company || "",
        role: data.role || "user"
      };

      localStorage.setItem("tinaToken", data.token);
      localStorage.setItem("tinaRole", data.role || "user");
      localStorage.setItem("tinaUser", JSON.stringify(userProfile));
      localStorage.removeItem("tinaConversationId");

      setToken(data.token);
      setRole(data.role || "user");
      setCurrentUser(userProfile);
      setConversationId("");
      setMessages([DEFAULT_WELCOME_MESSAGE]);
      setUsername("");
      setPassword("");

      await ensureConversation(data.token);
    } catch {
      setLoginError("Cannot connect to TINA backend.");
    }
  };

  const register = async () => {
    setRegisterMessage("");

    if (
      !registerUsername.trim() ||
      !registerPassword.trim() ||
      !registerEmail.trim() ||
      !registerMobile.trim()
    ) {
      setRegisterMessage("Username, password, email, and mobile are required.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerUsername,
          password: registerPassword,
          email: registerEmail,
          mobile: registerMobile,
          company: registerCompany || ""
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setRegisterMessage(
          data.error ||
            "Registration is not yet activated. Please contact the administrator."
        );
        return;
      }

      setRegisterMessage(
        data.message || "Registration successful. You may now log in."
      );

      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterEmail("");
      setRegisterMobile("");
      setRegisterCompany("");

      setTimeout(() => {
        setShowRegister(false);
        setRegisterMessage("");
      }, 1500);
    } catch {
      setRegisterMessage(
        "Registration is not yet activated. Please contact the administrator."
      );
    }
  };

  const logout = () => {
    localStorage.removeItem("tinaToken");
    localStorage.removeItem("tinaRole");
    localStorage.removeItem("tinaUser");
    localStorage.removeItem("tinaConversationId");
    clearChatHistory();

    setToken("");
    setRole("");
    setConversationId("");
    setCurrentUser({});
    setShowProfileMenu(false);
    setShowProfileModal(false);
    setShowSettingsModal(false);
    setShowHelpModal(false);
    setMessages([DEFAULT_WELCOME_MESSAGE]);
  };

  const SLASH_COMMAND_ENDPOINTS = {
    "/ask": "/ask",
    "/tax": "/tax",
    "/review": "/review",
    "/quiz": "/quiz",
    "/case": "/case",
    "/source": "/source",
    "/audit": "/audit",
    "/debug": "/debug",
    "/patch": "/patch",
    "/diagnostic": "/diagnostic",
    "/progress": "/progress",
    "/feedback": "/feedback"
  };

  const COMMAND_MODE_MAP = {
    "/quiz": {
      commandMode: "QUIZ",
      responseMode: "QUIZ_MODE",
      orchestrationMode: "QUIZ_MODE",
      requiresQuizMode: true
    },
    "/review": {
      commandMode: "REVIEWER",
      responseMode: "REVIEWER_MODE",
      orchestrationMode: "REVIEWER_MODE",
      requiresReviewerMode: true
    },
    "/case": {
      commandMode: "CASE",
      responseMode: "CASE_ANALYSIS",
      orchestrationMode: "CASE_ANALYSIS",
      requiresCaseAnalysis: true
    },
    "/source": {
      commandMode: "SOURCE",
      responseMode: "SOURCE_LOOKUP",
      orchestrationMode: "SOURCE_LOOKUP",
      requiresSourceVisibility: true
    },
    "/tax": {
      commandMode: "TAX",
      responseMode: "SENIOR_COUNSEL_MEMO",
      orchestrationMode: "SENIOR_COUNSEL_MEMO"
    },
    "/audit": {
      commandMode: "AUDIT",
      responseMode: "COMPLEX_ADVISORY",
      orchestrationMode: "COMPLEX_ADVISORY"
    },
    "/diagnostic": {
      commandMode: "DIAGNOSTIC",
      responseMode: "QUIZ_MODE",
      orchestrationMode: "QUIZ_MODE",
      requiresQuizMode: true
    },
    "/ask": {}
  };

  const detectSlashCommand = (text) => {
    const match = text.match(/^(\/\w+)/);
    if (!match) return null;
    return SLASH_COMMAND_ENDPOINTS[match[1].toLowerCase()] || null;
  };

  const buildCommandBody = (text, activeConversationId) => {
    const match = text.match(/^(\/\w+)\s*(.*)/s);
    const command = match ? match[1].toLowerCase() : null;
    const cleanQuestion = match ? match[2].trim() : text;
    const modeMeta = (command && COMMAND_MODE_MAP[command]) || {};

    return {
      question: text,
      cleanQuestion: command ? cleanQuestion : text,
      detectedCommand: command || null,
      conversationId: activeConversationId,
      ...modeMeta
    };
  };

  const askTina = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading || !token) return;

    // Derive display content: strip slash command prefix for production routes.
    // Developer routes (/debug, /diagnostic, /patch) and exit commands
    // (/bye, /exit, /quit) fall through the hasOwnProperty check and preserve
    // the raw input verbatim. The API body still receives the original trimmed input.
    const DISPLAY_PREFIXES = {
      "/ask":    null,
      "/tax":    null,
      "/review": "Review:",
      "/quiz":   "Quiz:",
      "/source": "Source Search:",
      "/case":   "Case:",
      "/audit":  "Audit:",
    };
    const _bubbleMatch  = trimmed.match(/^(\/\w+)\s*(.*)/s);
    const _bubbleCmd    = _bubbleMatch ? _bubbleMatch[1].toLowerCase() : null;
    const _bubbleClean  = _bubbleMatch ? _bubbleMatch[2].trim() : trimmed;
    const displayContent =
      _bubbleCmd && Object.prototype.hasOwnProperty.call(DISPLAY_PREFIXES, _bubbleCmd)
        ? DISPLAY_PREFIXES[_bubbleCmd]
          ? `${DISPLAY_PREFIXES[_bubbleCmd]} ${_bubbleClean}`.trim()
          : _bubbleClean || trimmed
        : trimmed;

    setMessages((prev) => [...prev, { role: "user", content: displayContent }]);
    setQuestion("");
    setLoading(true);

    const apiEndpoint = detectSlashCommand(trimmed) || "/ask";

    try {
      let activeConversationId = conversationId;

      if (!activeConversationId) {
        activeConversationId = await ensureConversation(token);
      }

      if (!activeConversationId) {
        setMessages((prev) => [
          ...prev,
          {
            role: "tina",
            content: "TINA could not initialize a conversation session.",
            sources: [],
            fallbackReferences: []
          }
        ]);
        return;
      }

      let res = await fetch(`${API_BASE}${apiEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(buildCommandBody(trimmed, activeConversationId))
      });

      let data = await res.json().catch(() => ({}));

      if (
        !res.ok &&
        typeof data?.error === "string" &&
        data.error.toLowerCase().includes("conversation")
      ) {
        activeConversationId = await resetConversation(token);

        if (!activeConversationId) {
          setMessages((prev) => [
            ...prev,
            {
              role: "tina",
              content: "TINA could not recover the chat session.",
              sources: [],
              fallbackReferences: []
            }
          ]);
          return;
        }

        res = await fetch(`${API_BASE}${apiEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(buildCommandBody(trimmed, activeConversationId))
        });

        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "tina",
            content: data.error || "TINA could not process the request.",
            sources: [],
            fallbackReferences: []
          }
        ]);
        return;
      }

      // /source mode: backend sets requiresSourceVisibility and hook="/source".
      // For /source, sourceCards is stored empty so the priority rule in the
      // render loop falls through to msg.sources (the full uncapped array).
      // For all other modes, sourceCards holds the backend's deduped max-5 array
      // and is used as the single authoritative source display.
      const isSourceMode = Boolean(
        data.requiresSourceVisibility ||
        data.hook === "/source"
      );

      const rawSourceList =
        Array.isArray(data.sourcesUsed)        ? data.sourcesUsed
        : Array.isArray(data.sources_used)     ? data.sources_used
        : Array.isArray(data.sources)          ? data.sources
        : Array.isArray(data.retrievedSources) ? data.retrievedSources
        : [];

      setMessages((prev) => [
        ...prev,
        {
          role: "tina",
          content: data.answer || "TINA did not return an answer.",
          // hook: used by the render loop to pick the section heading
          // (SOURCE / LEGAL BASIS / ANSWER BASIS).
          hook: data.hook || null,
          // sourceCards: only populated for non-/source modes; empty for /source
          // so the render-loop priority rule naturally falls through to sources.
          sourceCards: !isSourceMode && Array.isArray(data.sourceCards)
            ? data.sourceCards
            : [],
          requiresSourceVisibility: isSourceMode,
          // sources: uncapped for /source; max-5 + filtered for all other modes.
          sources: normalizeSources(rawSourceList, { uncapped: isSourceMode }),
          fallbackReferences: normalizeFallbackReferences(
            Array.isArray(data.fallbackReferences)
              ? data.fallbackReferences
              : Array.isArray(data.fallback_references)
                ? data.fallback_references
                : []
          ),
          educationalSources: data.educationalSources || null
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "tina",
          content:
            "I could not connect to the TINA backend. Please check if the backend is running.",
          sources: [],
          fallbackReferences: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reindexDrive = async () => {
    if (role !== "admin" || indexing) return;

    setIndexing(true);

    try {
      const res = await fetch(`${API_BASE}/index-drive`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "tina",
          content: res.ok
            ? `Knowledge base indexing started. Status: ${
                data.message || "background job running"
              }.`
            : data.error || "Indexing failed.",
          sources: [],
          fallbackReferences: []
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "tina",
          content: "Could not connect to the indexing endpoint.",
          sources: [],
          fallbackReferences: []
        }
      ]);
    } finally {
      setIndexing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askTina();
    }
  };

  const renderMessageContent = (msg) => {
    if (msg.role !== "tina") {
      return <div style={{ whiteSpace: "pre-wrap" }}>{msg.content || ""}</div>;
    }

    const cleanContent = stripInlineSourceBlock(msg.content || "");
    return (
      <div className="message-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {cleanContent}
        </ReactMarkdown>
      </div>
    );
  };

  if (!token) {
    return (
      <div className="app auth-app">
        <header className="header auth-header">
          <div className="header-brand app-brand-lockup">
            <img className="brand-logo-small" src={TINA_LOGO_SRC} alt="TINA logo" />
            <div>
              <h1>TINA</h1>
              <p>Tax Information Navigation Assistant</p>
            </div>
          </div>
          <span className="auth-header-note">Secure professional workspace</span>
        </header>

        <div className="chat-container auth-container">
          <div className="auth-card">
            <div className="auth-brand-block">
              <img className="auth-logo" src={TINA_LOGO_SRC} alt="TINA logo" />
              <div>
                <div className="message-label">Login</div>
                <h2>Secure access to Philippine tax intelligence.</h2>
                <p>
                  Built for professional review, source-aware research, and
                  authority-disciplined tax workflows.
                </p>
              </div>
            </div>

            <label className="auth-field">
              <span>Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password-field">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") login();
                  }}
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  {showLoginPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {loginError && (
              <div className="auth-message auth-message-error" role="alert">
                {loginError}
              </div>
            )}

            <button className="auth-submit" onClick={login}>
              Login
            </button>

            <div className="auth-switch">
              New user?{" "}
              <button
                onClick={() => {
                  setShowRegister(true);
                  setRegisterMessage("");
                }}
              >
                Register
              </button>
            </div>
          </div>
        </div>

        {showRegister && (
          <div className="auth-modal-backdrop">
            <div className="auth-card auth-register-card">
              <div className="auth-brand-block compact">
                <img className="auth-logo" src={TINA_LOGO_SRC} alt="TINA logo" />
                <div>
                  <div className="message-label">Register</div>
                  <h2>Create your TINA access.</h2>
                  <p>Use your professional contact details for account setup.</p>
                </div>
              </div>

              <label className="auth-field">
                <span>Username</span>
                <input
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                />
              </label>

              <label className="auth-field">
                <span>Email address</span>
                <input
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="auth-field">
                <span>Mobile phone</span>
                <input
                  value={registerMobile}
                  onChange={(e) => setRegisterMobile(e.target.value)}
                  placeholder="Mobile phone"
                  autoComplete="tel"
                />
              </label>

              <label className="auth-field">
                <span>Company</span>
                <input
                  value={registerCompany}
                  onChange={(e) => setRegisterCompany(e.target.value)}
                  placeholder="Company (optional)"
                  autoComplete="organization"
                />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <div className="auth-password-field">
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Create a password"
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  >
                    {showRegisterPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <div className="auth-help-text">
                OTP verification may be sent through your registered email and/or
                mobile phone once activated by the administrator.
              </div>

              {registerMessage && (
                <div
                  className={`auth-message ${
                    registerMessage.toLowerCase().includes("successful")
                      ? "auth-message-success"
                      : "auth-message-error"
                  }`}
                  role="status"
                >
                  {registerMessage}
                </div>
              )}

              <button className="auth-submit" onClick={register}>
                Register
              </button>

              <button className="auth-secondary" onClick={() => setShowRegister(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="footer auth-footer">
          Powered by <strong>&nbsp;BENTO PH</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand app-brand-lockup">
          <img className="brand-logo-small" src={TINA_LOGO_SRC} alt="TINA logo" />
          <div>
            <h1>TINA</h1>
            <p>Tax Information Navigation Assistant</p>
          </div>
        </div>

        <div className="profile-wrapper">
          <button
            className="profile-button"
            aria-expanded={showProfileMenu}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            {currentUser?.username || "User"} ▾
          </button>

          {showProfileMenu && (
            <div className="profile-menu">
              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setShowProfileMenu(false);
                }}
              >
                Profile
              </button>

              <button
                onClick={() => {
                  setShowSettingsModal(true);
                  setShowProfileMenu(false);
                }}
              >
                Settings
              </button>

              <button
                onClick={() => {
                  setShowHelpModal(true);
                  setShowProfileMenu(false);
                }}
              >
                Help
              </button>

              {role === "admin" && (
                <button onClick={reindexDrive} disabled={indexing}>
                  {indexing ? "Indexing..." : "Re-index"}
                </button>
              )}

              <button onClick={logout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>Profile</strong>
              <button onClick={() => setShowProfileModal(false)}>×</button>
            </div>

            <div className="profile-row">
              <span>Username</span>
              <strong>{currentUser?.username || "-"}</strong>
            </div>

            <div className="profile-row">
              <span>Email</span>
              <strong>{currentUser?.email || "-"}</strong>
            </div>

            <div className="profile-row">
              <span>Mobile</span>
              <strong>{currentUser?.mobile || "-"}</strong>
            </div>

            <div className="profile-row">
              <span>Company</span>
              <strong>{currentUser?.company || "Not provided"}</strong>
            </div>

            <div className="profile-row">
              <span>Role</span>
              <strong>{role || "user"}</strong>
            </div>

            <div className="profile-row">
              <span>Conversation</span>
              <strong style={{ wordBreak: "break-all" }}>
                {conversationId || "Not initialized"}
              </strong>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div className="profile-modal account-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>Settings</strong>
              <button onClick={() => setShowSettingsModal(false)}>×</button>
            </div>

            <section className="account-modal-section">
              <h2>Billing</h2>
              <div className="profile-row">
                <span>Current plan</span>
                <strong>Plan details not connected</strong>
              </div>
              <div className="profile-row">
                <span>Upgrade plan</span>
                <strong>Coming soon</strong>
              </div>
              <div className="profile-row">
                <span>Billing management</span>
                <strong>Not available yet</strong>
              </div>
              <p>Billing backend is not yet connected.</p>
            </section>

            <section className="account-modal-section">
              <h2>Security</h2>
              <div className="profile-row">
                <span>Account security</span>
                <strong>Placeholder</strong>
              </div>
              <div className="profile-row">
                <span>Password / authentication</span>
                <strong>Not connected</strong>
              </div>
              <div className="profile-row">
                <span>Sessions / devices</span>
                <strong>Not connected</strong>
              </div>
              <p>Security management backend is not yet connected.</p>
            </section>

            <section className="account-modal-section">
              <h2>Login</h2>
              <div className="profile-row">
                <span>Signed in as</span>
                <strong>{currentUser?.email || currentUser?.username || "-"}</strong>
              </div>
              <div className="profile-row">
                <span>Role</span>
                <strong>{role || "user"}</strong>
              </div>
              <div className="profile-row">
                <span>Session status</span>
                <strong>{token ? "Active" : "Signed out"}</strong>
              </div>
              <p>Logout is available from the account menu.</p>
            </section>
          </div>
        </div>
      )}

      {showHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div className="profile-modal account-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>Help</strong>
              <button onClick={() => setShowHelpModal(false)}>×</button>
            </div>

            <section className="account-modal-section">
              <h2>Help Center</h2>
              <ul>
                <li>Ask TINA clear Philippine tax questions.</li>
                <li>Include facts, dates, tax type, and taxpayer context when available.</li>
                <li>Use specific authority references when you have them.</li>
              </ul>
            </section>

            <section className="account-modal-section">
              <h2>Release Notes</h2>
              <ul>
                <li>TINA is under active development.</li>
                <li>SAE V1 authority safety improvements are active.</li>
              </ul>
            </section>

            <section className="account-modal-section">
              <h2>Keyboard Shortcuts</h2>
              <ul>
                <li>Enter to send.</li>
                <li>Shift + Enter for a new line.</li>
                <li>Esc closes the account menu or open modal.</li>
              </ul>
            </section>

            <section className="account-modal-section">
              <h2>Report a Bug</h2>
              <p>
                Include the exact question, time asked, answer shown, and visible
                source cards so the issue can be reproduced.
              </p>
            </section>
          </div>
        </div>
      )}

      <div className="chat-container">
        {messages.map((msg, index) => {
          // Single visible source truth: prefer sourceCards (deduped, authority-ranked,
          // max-5 from backend) over sources. For /source messages, sourceCards is
          // empty so this naturally falls through to the full uncapped sources array.
          const visibleSources = normalizeSources(
            msg.sourceCards?.length
              ? msg.sourceCards
              : msg.sources?.length
                ? msg.sources
                : [],
            { uncapped: Boolean(msg.requiresSourceVisibility) }
          );

          const isSourceMode = Boolean(msg.requiresSourceVisibility);
          const sectionHeading =
            isSourceMode
              ? "SOURCES"
              : msg.hook === "/review"
                ? "LEGAL BASIS"
                : msg.hook === "/quiz"
                  ? "ANSWER BASIS"
                  : "SOURCE";

          return (
            <div
              key={index}
              className={`message-row ${msg.role === "user" ? "user" : "tina"}`}
            >
              {msg.role === "tina" && (
                <div className="tina-indicator" aria-hidden="true">
                  <img src={TINA_LOGO_SRC} alt="TINA logo" />
                </div>
              )}

              <div className="message-box">
                {renderMessageContent(msg)}

                {msg.role === "tina" && visibleSources.length === 0 && (
                  <EducationalSources data={msg.educationalSources} />
                )}

                {/* Normal mode: authority chips (clickable or non-clickable) */}
                {!isSourceMode && visibleSources.length > 0 && (
                  <div className="sources">
                    <strong>{sectionHeading}:</strong>
                    <div className="source-chips">
                      {visibleSources.map((source, sourceIndex) => {
                        const label = getAuthorityLabel(source);
                        const href = getSourceHref(source);
                        return href ? (
                          <a
                            key={getSourceKey(source, sourceIndex)}
                            className="source-chip"
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {label}
                          </a>
                        ) : (
                          <span
                            key={getSourceKey(source, sourceIndex)}
                            className="source-chip"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* /source mode: full explorer list with full titles */}
                {isSourceMode && visibleSources.length > 0 && (
                  <div className="sources">
                    <strong>{sectionHeading}:</strong>
                    <div className="source-list">
                      {visibleSources.map((source, sourceIndex) => {
                        const label = getSourceLabel(source);
                        const href = getSourceHref(source);
                        return (
                          <div
                            key={getSourceKey(source, sourceIndex)}
                            className="source-list-item"
                          >
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer noopener"
                              >
                                {label}
                              </a>
                            ) : (
                              <span>{label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {msg.fallbackReferences && msg.fallbackReferences.length > 0 && (
                  <div className="sources">
                    <strong>Possible references to verify:</strong>
                    <ol>
                      {msg.fallbackReferences.slice(0, 5).map((ref, i) => (
                        <li key={i}>{ref}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div
            className="message-row tina"
            role="status"
            aria-label="TINA is typing"
          >
            <div className="tina-indicator" aria-hidden="true">
              <img src={TINA_LOGO_SRC} alt="TINA logo" />
            </div>
            <div className="message-box">
              <TypingStatusIndicator isLoading={loading} />
            </div>
          </div>
        )}

        <div ref={bottomRef}></div>
      </div>

      <div className="input-container">
        <div className="input-box">
          <textarea
            ref={composerRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask TINA..."
            rows={1}
            aria-label="Message TINA"
          />

          <button
            className="send-button"
            onClick={askTina}
            disabled={loading || bootstrappingConversation || !question.trim()}
            aria-label={
              loading || bootstrappingConversation
                ? "TINA is responding"
                : "Send message"
            }
          >
            {loading || bootstrappingConversation ? (
              <span className="send-spinner" aria-hidden="true" />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="footer">
        Powered by <strong>&nbsp;BENTO PH</strong>
      </div>
    </div>
  );
}

export default App;
