import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  ""
).replace(/\/$/, "");

const MAX_VISIBLE_SOURCES = 5;

const DEFAULT_WELCOME_MESSAGE = {
  role: "tina",
  content: "Hi, I’m TINA. Ask me about Philippine tax matters...",
  sources: [],
  fallbackReferences: []
};

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
    source.driveViewUrl ||
    source.drive_view_url ||
    source.driveDownloadUrl ||
    source.drive_download_url ||
    source.url ||
    source.href ||
    null
  );
}

function normalizeSources(rawSources) {
  if (!Array.isArray(rawSources)) return [];

  return rawSources
    .filter(Boolean)
    .filter((source) => !shouldHideSource(source))
    .filter((source) => Boolean(getSourceHref(source)))
    .slice(0, MAX_VISIBLE_SOURCES);
}

function normalizeFallbackReferences(rawFallbackReferences) {
  return Array.isArray(rawFallbackReferences)
    ? rawFallbackReferences.slice(0, 5)
    : [];
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
  const [messages, setMessages] = useState([DEFAULT_WELCOME_MESSAGE]);

  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [bootstrappingConversation, setBootstrappingConversation] =
    useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!token || conversationId || bootstrappingConversation) return;
    void ensureConversation(token);
  }, [token, conversationId, bootstrappingConversation]);

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

      const mapped = data.messages.map((msg) => ({
        role: msg.role === "assistant" ? "tina" : "user",
        content: msg.content || "",
        sources: normalizeSources(
          Array.isArray(msg.sourcesUsed)
            ? msg.sourcesUsed
            : Array.isArray(msg.sources_used)
              ? msg.sources_used
              : Array.isArray(msg.sources)
                ? msg.sources
                : []
        ),
        fallbackReferences: normalizeFallbackReferences(
          Array.isArray(msg.fallbackReferences)
            ? msg.fallbackReferences
            : Array.isArray(msg.fallback_references)
              ? msg.fallback_references
              : []
        )
      }));

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

    setToken("");
    setRole("");
    setConversationId("");
    setCurrentUser({});
    setShowProfileMenu(false);
    setShowProfileModal(false);
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

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
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

      setMessages((prev) => [
        ...prev,
        {
          role: "tina",
          content: data.answer || "TINA did not return an answer.",
          sources: normalizeSources(
            Array.isArray(data.sourcesUsed)
              ? data.sourcesUsed
              : Array.isArray(data.sources_used)
                ? data.sources_used
                : Array.isArray(data.sources)
                  ? data.sources
                  : Array.isArray(data.retrievedSources)
                    ? data.retrievedSources
                    : []
          ),
          fallbackReferences: normalizeFallbackReferences(
            Array.isArray(data.fallbackReferences)
              ? data.fallbackReferences
              : Array.isArray(data.fallback_references)
                ? data.fallback_references
                : []
          )
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

  const inputStyle = {
    width: "100%",
    padding: "12px",
    marginBottom: "10px",
    borderRadius: "10px",
    border: "1px solid #ccc"
  };

  const passwordWrapper = {
    position: "relative",
    width: "100%"
  };

  const toggleStyle = {
    position: "absolute",
    right: "12px",
    top: "42%",
    transform: "translateY(-50%)",
    fontSize: "12px",
    color: "#1e3358",
    fontWeight: "bold",
    cursor: "pointer"
  };

  const renderMessageContent = (msg) => {
    if (msg.role !== "tina") {
      return <div style={{ whiteSpace: "pre-wrap" }}>{msg.content || ""}</div>;
    }

    return (
      <div className="message-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {msg.content || ""}
        </ReactMarkdown>
      </div>
    );
  };

  if (!token) {
    return (
      <div className="app">
        <div className="header">
          <h1>TINA</h1>
          <p>Tax Information Navigation Assistant</p>
        </div>

        <div className="chat-container">
          <div
            className="message-box"
            style={{
              width: "100%",
              maxWidth: "420px",
              margin: "60px auto"
            }}
          >
            <div className="message-label">LOGIN</div>

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              style={inputStyle}
            />

            <div style={passwordWrapper}>
              <input
                type={showLoginPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") login();
                }}
                style={{ ...inputStyle, paddingRight: "62px" }}
              />

              <span
                style={toggleStyle}
                onClick={() => setShowLoginPassword(!showLoginPassword)}
              >
                {showLoginPassword ? "Hide" : "Show"}
              </span>
            </div>

            {loginError && (
              <div
                style={{
                  color: "#b91c1c",
                  marginBottom: "10px",
                  fontSize: "13px"
                }}
              >
                {loginError}
              </div>
            )}

            <button
              onClick={login}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: "#1e3358",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Login
            </button>

            <div
              style={{
                marginTop: "14px",
                textAlign: "center",
                fontSize: "13px"
              }}
            >
              New user?{" "}
              <button
                onClick={() => {
                  setShowRegister(true);
                  setRegisterMessage("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#1e3358",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Register
              </button>
            </div>
          </div>
        </div>

        {showRegister && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "16px",
              zIndex: 999
            }}
          >
            <div
              className="message-box"
              style={{
                width: "100%",
                maxWidth: "420px"
              }}
            >
              <div className="message-label">REGISTER</div>

              <input
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                placeholder="Username"
                style={inputStyle}
              />

              <input
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                placeholder="Email address"
                style={inputStyle}
              />

              <input
                value={registerMobile}
                onChange={(e) => setRegisterMobile(e.target.value)}
                placeholder="Mobile phone"
                style={inputStyle}
              />

              <input
                value={registerCompany}
                onChange={(e) => setRegisterCompany(e.target.value)}
                placeholder="Company (optional)"
                style={inputStyle}
              />

              <div style={passwordWrapper}>
                <input
                  type={showRegisterPassword ? "text" : "password"}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Password"
                  style={{ ...inputStyle, paddingRight: "62px" }}
                />

                <span
                  style={toggleStyle}
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                >
                  {showRegisterPassword ? "Hide" : "Show"}
                </span>
              </div>

              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  marginBottom: "10px",
                  lineHeight: "1.4"
                }}
              >
                OTP verification may be sent through your registered email and/or
                mobile phone once activated by the administrator.
              </div>

              {registerMessage && (
                <div
                  style={{
                    color: registerMessage.toLowerCase().includes("successful")
                      ? "#166534"
                      : "#b91c1c",
                    marginBottom: "10px",
                    fontSize: "13px"
                  }}
                >
                  {registerMessage}
                </div>
              )}

              <button
                onClick={register}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#1e3358",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginBottom: "8px"
                }}
              >
                Register
              </button>

              <button
                onClick={() => setShowRegister(false)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  color: "#1e3358",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="footer">
          Powered by <strong>&nbsp;Bong Corpuz &amp; Co. CPAs</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>TINA</h1>
        <p>Tax Information Navigation Assistant</p>

        <div className="topbar">
          <div className="profile-wrapper">
            <button
              className="profile-button"
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

                <button disabled>Upgrade</button>

                {role === "admin" && (
                  <button onClick={reindexDrive} disabled={indexing}>
                    {indexing ? "Indexing..." : "Re-index"}
                  </button>
                )}

                <button onClick={logout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfileModal && (
        <div className="modal-backdrop">
          <div className="profile-modal">
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

      <div className="chat-container">
        {messages.map((msg, index) => {
          const visibleSources = normalizeSources(msg.sources);

          return (
            <div
              key={index}
              className={`message-row ${msg.role === "user" ? "user" : "tina"}`}
            >
              {msg.role === "tina" && <div className="avatar">T</div>}

              <div className="message-box">
                <div className="message-label">
                  {msg.role === "user" ? "YOU" : "TINA"}
                </div>

                {renderMessageContent(msg)}

                {visibleSources.length > 0 && (
                  <div className="sources">
                    <strong>Sources:</strong>

                    <div style={{ marginTop: "8px" }}>
                      {visibleSources.map((source, sourceIndex) => {
                        const label = getSourceLabel(source);
                        const href = getSourceHref(source);

                        if (!href) return null;

                        return (
                          <div
                            key={getSourceKey(source, sourceIndex)}
                            style={{
                              marginBottom: "6px",
                              lineHeight: "1.45"
                            }}
                          >
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer noopener"
                              style={{
                                color: "#1d4ed8",
                                textDecoration: "underline",
                                wordBreak: "break-word",
                                cursor: "pointer"
                              }}
                            >
                              {label}
                            </a>
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

              {msg.role === "user" && (
                <div className="avatar user-avatar">You</div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="message-row tina">
            <div className="avatar">T</div>
            <div className="message-box">
              <div className="message-label">TINA</div>
              <div className="typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef}></div>
      </div>

      <div className="input-container">
        <div className="input-box">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask TINA about Philippine tax rules, BIR issuances, or deadlines..."
            rows={2}
          />

          <button
            onClick={askTina}
            disabled={loading || bootstrappingConversation || !question.trim()}
          >
            {loading || bootstrappingConversation ? "..." : "Send"}
          </button>
        </div>
      </div>

      <div className="footer">
        Powered by <strong>&nbsp;Bong Corpuz &amp; Co. CPAs</strong>
      </div>
    </div>
  );
}

export default App;
