import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE;

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
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tinaUser") || "{}");
    } catch {
      return {};
    }
  });

  const [loginError, setLoginError] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "tina",
      content:
        "Hi, I’m TINA. Ask me about Philippine tax matters based on the indexed knowledge base.",
      sources: [],
      fallbackReferences: []
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

      setToken(data.token);
      setRole(data.role || "user");
      setCurrentUser(userProfile);
      setUsername("");
      setPassword("");
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

    setToken("");
    setRole("");
    setCurrentUser({});
    setShowProfileMenu(false);
    setShowProfileModal(false);

    setMessages([
      {
        role: "tina",
        content:
          "Hi, I’m TINA. Ask me about Philippine tax matters based on the indexed knowledge base.",
        sources: [],
        fallbackReferences: []
      }
    ]);
  };

  const askTina = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ question: trimmed })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [
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

      setMessages(prev => [
        ...prev,
        {
          role: "tina",
          content: data.answer || "TINA did not return an answer.",
          sources: data.sourcesUsed || [],
          fallbackReferences: data.fallbackReferences || []
        }
      ]);
    } catch {
      setMessages(prev => [
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

      setMessages(prev => [
        ...prev,
        {
          role: "tina",
          content: res.ok
            ? `Knowledge base indexing completed. Files indexed: ${
                data.filesIndexed ?? "completed"
              }.`
            : data.error || "Indexing failed.",
          sources: [],
          fallbackReferences: []
        }
      ]);
    } catch {
      setMessages(prev => [
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

  const handleKeyDown = e => {
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
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              style={inputStyle}
            />

            <div style={passwordWrapper}>
              <input
                type={showLoginPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                onKeyDown={e => {
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
                onChange={e => setRegisterUsername(e.target.value)}
                placeholder="Username"
                style={inputStyle}
              />

              <input
                value={registerEmail}
                onChange={e => setRegisterEmail(e.target.value)}
                placeholder="Email address"
                style={inputStyle}
              />

              <input
                value={registerMobile}
                onChange={e => setRegisterMobile(e.target.value)}
                placeholder="Mobile phone"
                style={inputStyle}
              />

              <input
                value={registerCompany}
                onChange={e => setRegisterCompany(e.target.value)}
                placeholder="Company (optional)"
                style={inputStyle}
              />

              <div style={passwordWrapper}>
                <input
                  type={showRegisterPassword ? "text" : "password"}
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
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
          </div>
        </div>
      )}

      <div className="chat-container">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message-row ${msg.role === "user" ? "user" : "tina"}`}
          >
            {msg.role === "tina" && <div className="avatar">T</div>}

            <div className="message-box">
              <div className="message-label">
                {msg.role === "user" ? "YOU" : "TINA"}
              </div>

              <div>{msg.content}</div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  <strong>Source:</strong>
                  {[...new Set(msg.sources.map(s => s.source))].join(", ")}
                </div>
              )}

              {msg.fallbackReferences && msg.fallbackReferences.length > 0 && (
                <div className="sources">
                  <strong>Possible references to verify:</strong>
                  <ol>
                    {msg.fallbackReferences.map((ref, i) => (
                      <li key={i}>{ref}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {msg.role === "user" && <div className="avatar user-avatar">You</div>}
          </div>
        ))}

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
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask TINA about Philippine tax rules, BIR issuances, or deadlines..."
            rows={2}
          />

          <button onClick={askTina} disabled={loading || !question.trim()}>
            {loading ? "..." : "Send"}
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