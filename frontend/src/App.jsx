import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

const CHAT_MODES = ["QA", "chat"];
const LANGUAGES = ["eng", "vi"];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function newSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return `s-${crypto.randomUUID().slice(0, 8)}`;
  return `s-${Math.random().toString(16).slice(2, 10)}`;
}

/* ── Icons ──────────────────────────────────────────── */
function IconBot() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M12 2a4 4 0 0 1 4 4v5H8V6a4 4 0 0 1 4-4z"/>
      <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function IconPaperclip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}
function IconChevron({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

/* ── Message bubble ─────────────────────────────────── */
function MessageBubble({ msg }) {
  if (msg.type === "user") {
    return (
      <div className="msg-row user">
        <div className="user-bubble">{msg.content}</div>
      </div>
    );
  }
  if (msg.type === "error") {
    return (
      <div className="msg-row error">
        <div className="error-card" role="alert">
          <span className="error-label">Error</span>
          <span>{msg.content}</span>
        </div>
      </div>
    );
  }
  const meta = msg.metadata || {};
  const isCache = meta.resolution_source === "LLM_CACHE";
  return (
    <div className="msg-row assistant">
      <div className="bot-avatar" aria-hidden="true"><IconBot /></div>
      <article className="assistant-card" data-testid="assistant-message">
        <div className="assistant-body">{msg.content}</div>
        {meta.resolution_source && (
          <div className="meta-bar">
            <span className={`source-badge ${isCache ? "cache" : "live"}`}>
              {meta.resolution_source}
            </span>
            {meta.model && <><span className="meta-sep">·</span><span className="meta-val">{meta.model}</span></>}
            {meta.latency_ms != null && <><span className="meta-sep">·</span><span className="meta-val mono">{meta.latency_ms} ms</span></>}
            {meta.input_tokens != null && <><span className="meta-sep">·</span><span className="meta-val mono">In <strong>{meta.input_tokens}</strong></span></>}
            {meta.output_tokens != null && <><span className="meta-sep">·</span><span className="meta-val mono">Out <strong>{meta.output_tokens}</strong></span></>}
          </div>
        )}
      </article>
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────── */
function Sidebar({
  sidebarOpen, setSidebarOpen,
  model, setModel,
  language, setLanguage,
  chatMode, setChatMode,
  systemPrompt, setSystemPrompt,
  documents, onAddDocuments, onRemoveDoc, onProcessDocs,
  status,
  onApplySystemPrompt,
}) {
  const fileRef = useRef(null);

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-toggle-row">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)}>
          {sidebarOpen ? "◀ Hide" : "▶"}
        </button>
      </div>

      {sidebarOpen && (
        <div className="sidebar-content">
          {/* Status */}
          <div className="sidebar-section">
            <label className="sidebar-label">Status</label>
            <div className="status-pill">{status}</div>
          </div>

          {/* Language */}
          <div className="sidebar-section">
            <label className="sidebar-label">Language</label>
            <div className="radio-group">
              {LANGUAGES.map(l => (
                <label key={l} className={`radio-btn ${language === l ? "active" : ""}`}>
                  <input type="radio" name="language" value={l}
                    checked={language === l}
                    onChange={() => setLanguage(l)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {/* Chat Mode */}
          <div className="sidebar-section">
            <label className="sidebar-label">Chat Mode</label>
            <div className="radio-group">
              {CHAT_MODES.map(m => (
                <label key={m} className={`radio-btn ${chatMode === m ? "active" : ""}`}>
                  <input type="radio" name="chatmode" value={m}
                    checked={chatMode === m}
                    onChange={() => setChatMode(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="sidebar-section">
            <label className="sidebar-label">Model</label>
            <input
              className="sidebar-input"
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="e.g. llama3.1:8b-instruct-q8_0"
            />
          </div>

          {/* System Prompt */}
          <div className="sidebar-section">
            <label className="sidebar-label">System Prompt</label>
            <textarea
              className="sidebar-textarea"
              rows={5}
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Optional system instructions…"
            />
            <button className="sidebar-btn" onClick={onApplySystemPrompt}>
              Set System Prompt
            </button>
          </div>

          {/* Documents */}
          <div className="sidebar-section">
            <label className="sidebar-label">Documents</label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".txt,.pdf,.csv"
              style={{ display: "none" }}
              onChange={e => {
                onAddDocuments(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
            <button className="sidebar-btn" onClick={() => fileRef.current?.click()}>
              <IconPaperclip /> Add Files
            </button>
            {documents.length > 0 && (
              <>
                <ul className="doc-list">
                  {documents.map((f, i) => (
                    <li key={i} className="doc-item">
                      <span className="doc-name">{f.name}</span>
                      <button className="doc-remove" onClick={() => onRemoveDoc(i)}><IconTrash /></button>
                    </li>
                  ))}
                </ul>
                <div className="doc-actions">
                  <button className="sidebar-btn accent" onClick={onProcessDocs}>
                    Process Docs
                  </button>
                  <button className="sidebar-btn danger" onClick={() => onRemoveDoc("all")}>
                    Reset
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

/* ── Empty state ────────────────────────────────────── */
function EmptyState({ onSend, loading }) {
  const starters = [
    "What is RAG and how does it work?",
    "Summarize the uploaded document.",
    "Give me three tips for prompt engineering.",
  ];
  return (
    <div className="empty-state">
      <div className="empty-icon"><IconBot /></div>
      <h2>Chatbot 🤖</h2>
      <p>Upload documents, choose a model, and start chatting. Try one of these:</p>
      <div className="starter-chips">
        {starters.map(s => (
          <button key={s} className="chip" onClick={() => onSend(s)} disabled={loading}>{s}</button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════ */
export default function App() {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  /* sidebar / settings state */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState("llama3.1:8b-instruct-q8_0");
  const [language, setLanguage] = useState("eng");
  const [chatMode, setChatMode] = useState("QA");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [appliedPrompt, setAppliedPrompt] = useState("");
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("Ready!");

  /* active tab: "interface" | "settings" | "output" */
  const [tab, setTab] = useState("interface");
  const [outputLog, setOutputLog] = useState("");

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── Helpers ──────────────────────────────────────── */
  function resetSession() {
    if (loading) return;
    setSessionId(newSessionId());
    setMessages([]);
    setStatus("Ready!");
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function undoLast() {
    setMessages(prev => prev.slice(0, -2));
  }

  function clearChat() {
    setMessages([]);
    setStatus("Ready!");
  }

  function onAddDocuments(files) {
    setDocuments(prev => [...prev, ...files]);
  }

  function onRemoveDoc(idx) {
    if (idx === "all") { setDocuments([]); return; }
    setDocuments(prev => prev.filter((_, i) => i !== idx));
  }

  async function onProcessDocs() {
    setStatus("Processing documents 📄…");
    // In a full implementation this would upload files to backend.
    // For now, we simulate success and append to the log.
    setTimeout(() => {
      setStatus("Processing documents 📄 completed!");
      setOutputLog(prev =>
        prev + `[${new Date().toLocaleTimeString()}] Processed ${documents.length} document(s)\n`
      );
    }, 800);
  }

  function onApplySystemPrompt() {
    setAppliedPrompt(systemPrompt);
    setStatus("System prompt updated!");
    setOutputLog(prev => prev + `[${new Date().toLocaleTimeString()}] System prompt updated\n`);
  }

  /* ── Send ─────────────────────────────────────────── */
  const send = useCallback(async (text) => {
    const msg = typeof text === "string" ? text : input;
    if (loading) return;
    const trimmed = msg.trim();
    if (!trimmed) return;

    setInput("");
    setMessages(prev => [...prev, { id: uid(), type: "user", content: trimmed }]);
    setLoading(true);
    setStatus("Answering!");

    try {
      const payload = {
        session_id: sessionId,
        message: trimmed,
      };
      if (appliedPrompt.trim()) payload.system_prompt = appliedPrompt.trim();

      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let body = null;
      try { body = await res.json(); } catch { /* ignore */ }

      if (!res.ok) {
        const detail = body?.detail;
        const errMsg = typeof detail === "string" ? detail : `HTTP ${res.status}`;
        setMessages(prev => [...prev, { id: uid(), type: "error", content: errMsg }]);
        setStatus("Error!");
        return;
      }

      setMessages(prev => [
        ...prev,
        { id: uid(), type: "assistant", content: body.reply, metadata: body.metadata },
      ]);
      setStatus("Completed!");
      setOutputLog(prev =>
        prev + `[${new Date().toLocaleTimeString()}] ${chatMode} · ${model || "default"} → ${body.reply.slice(0, 60)}…\n`
      );
    } catch (err) {
      const isNet = err instanceof TypeError && err.message === "Failed to fetch";
      setMessages(prev => [
        ...prev,
        {
          id: uid(), type: "error",
          content: isNet
            ? `Cannot reach backend at ${API_BASE_URL}. Make sure the backend is running.`
            : `Network error: ${err.message}`,
        },
      ]);
      setStatus("Error!");
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, appliedPrompt, chatMode, model]);

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  /* ── Render ───────────────────────────────────────── */
  return (
    <div className="app-shell">
      {/* ── Header ─────────────────────────── */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><IconBot /></div>
          <div className="brand-text">
            <h1>Chatbot 🤖</h1>
            <p>Lyftr · LLM Gateway with Failover &amp; Cache</p>
          </div>
        </div>
        <div className="header-right">
          <div className="session-pill" title="Active session">
            <span className="live-dot" />
            {sessionId}
          </div>
          <button className="new-btn" onClick={resetSession} disabled={loading}>New session</button>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────── */}
      <nav className="tab-bar">
        {["interface", "settings", "output"].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {/* ══ Interface Tab ══════════════════════════════ */}
      {tab === "interface" && (
        <div className="main-layout">
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            model={model} setModel={setModel}
            language={language} setLanguage={setLanguage}
            chatMode={chatMode} setChatMode={setChatMode}
            systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt}
            documents={documents}
            onAddDocuments={onAddDocuments}
            onRemoveDoc={onRemoveDoc}
            onProcessDocs={onProcessDocs}
            status={status}
            onApplySystemPrompt={onApplySystemPrompt}
          />

          <div className="chat-pane">
            {/* Transcript */}
            <main className="transcript" aria-live="polite">
              {messages.length === 0 ? (
                <EmptyState onSend={send} loading={loading} />
              ) : (
                <div className="message-stream">
                  {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
                  {loading && (
                    <div className="msg-row loading">
                      <div className="loading-pill">
                        <span className="dots"><span /><span /><span /></span>
                        Thinking…
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </main>

            {/* Action row */}
            <div className="action-row">
              <div className="chat-mode-badge">{chatMode}</div>
              <button className="action-btn" onClick={undoLast} disabled={loading || messages.length < 2}>Undo</button>
              <button className="action-btn" onClick={clearChat} disabled={loading}>Clear</button>
              <button className="action-btn danger" onClick={resetSession} disabled={loading}>Reset</button>
            </div>

            {/* Composer */}
            <form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
              <textarea
                ref={textareaRef}
                data-testid="chat-input"
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={`Message (${chatMode} mode) — Enter to send, Shift+Enter for newline`}
                disabled={loading}
              />
              <button type="submit" className="send-btn" data-testid="send-button" disabled={loading}>
                {loading ? <span className="dots"><span /><span /><span /></span> : <IconSend />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ Settings Tab ═══════════════════════════════ */}
      {tab === "settings" && (
        <div className="settings-pane">
          <h2>Settings</h2>
          <div className="settings-grid">
            <div className="settings-card">
              <label className="sidebar-label">System Prompt</label>
              <textarea
                className="sidebar-textarea tall"
                rows={12}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Enter custom system instructions for the LLM…"
              />
              <button className="sidebar-btn accent" onClick={onApplySystemPrompt}>
                Set System Prompt
              </button>
            </div>
            <div className="settings-card">
              <label className="sidebar-label">Model</label>
              <input className="sidebar-input" type="text" value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. llama3.1:8b-instruct-q8_0" />
              <label className="sidebar-label" style={{ marginTop: "16px" }}>Language</label>
              <div className="radio-group">
                {LANGUAGES.map(l => (
                  <label key={l} className={`radio-btn ${language === l ? "active" : ""}`}>
                    <input type="radio" name="lang2" value={l}
                      checked={language === l}
                      onChange={() => setLanguage(l)} />
                    {l}
                  </label>
                ))}
              </div>
              <label className="sidebar-label" style={{ marginTop: "16px" }}>Chat Mode</label>
              <div className="radio-group">
                {CHAT_MODES.map(m => (
                  <label key={m} className={`radio-btn ${chatMode === m ? "active" : ""}`}>
                    <input type="radio" name="mode2" value={m}
                      checked={chatMode === m}
                      onChange={() => setChatMode(m)} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Output Tab ═════════════════════════════════ */}
      {tab === "output" && (
        <div className="output-pane">
          <div className="output-header">
            <h2>Output Log</h2>
            <button className="action-btn" onClick={() => setOutputLog("")}>Clear Log</button>
          </div>
          <pre className="output-log">{outputLog || "No output yet. Start chatting!"}</pre>
        </div>
      )}
    </div>
  );
}
