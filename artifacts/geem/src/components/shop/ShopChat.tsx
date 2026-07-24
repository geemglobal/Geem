import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Mic, MicOff, Paperclip, ChevronDown, Loader2, Bot, UserRound, RefreshCw, XCircle } from "lucide-react";
import Axios from "axios";

// Dedicated axios instance for shop chat — intentionally has NO auth interceptor.
// The shared chatApi adds the admin Bearer token to every request, which
// causes the server to treat shop customers as admins. Chat uses sessionKey only.
const chatApi = Axios.create({ baseURL: "/api" });

const SESSION_KEY_STORAGE     = "geem_chat_session_key";
const SESSION_ID_STORAGE      = "geem_chat_session_id";
const CHAT_CUSTOMER_NAME_KEY  = "geem_chat_name";
const CHAT_CUSTOMER_MOBILE_KEY = "geem_chat_mobile";

// SSE connects directly to /api/... (not via chatApi baseURL)
const API_BASE = "/api";

interface Msg {
  id: number;
  role: "customer" | "agent" | "system";
  messageType: "text" | "voice" | "image" | "file";
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt: string;
}

export default function ShopChatWidget() {
  const [open, setOpen]           = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [messages, setMessages]   = useState<Msg[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [aiTyping, setAiTyping]   = useState(false);
  const [unread, setUnread]       = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Intro form
  const [showForm, setShowForm]   = useState(false);
  const [name, setName]           = useState("");
  const [mobile, setMobile]       = useState("");

  // Voice recording
  const [recording, setRecording]   = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);
  const esRef        = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgIdRef = useRef<number>(0);

  // ── Restore session from localStorage ──
  useEffect(() => {
    const storedKey = localStorage.getItem(SESSION_KEY_STORAGE);
    const storedId  = localStorage.getItem(SESSION_ID_STORAGE);
    if (storedKey && storedId) {
      // Validate session is still active before restoring
      const id = parseInt(storedId);
      chatApi.post("/chat/sessions", { sessionKey: storedKey })
        .then(({ data }) => {
          if (data.expired || !data.session) {
            // Session closed/resolved — clear and show fresh form
            clearSession();
            return;
          }
          setSessionKey(data.sessionKey);
          setSessionId(data.session.id);
        })
        .catch(() => {
          // Network error — restore from localStorage optimistically
          setSessionKey(storedKey);
          setSessionId(id);
        });
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !sessionKey) return;
    fetchMessages();
  }, [sessionId, sessionKey]);

  // ── SSE real-time + polling fallback ──
  useEffect(() => {
    if (!sessionId || !sessionKey) return;

    function mergeMsg(msg: Msg) {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        if (msg.id > lastMsgIdRef.current) lastMsgIdRef.current = msg.id;
        return [...prev, msg];
      });
      setAiTyping(false);
    }

    function connectSSE() {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      const url = `${API_BASE}/chat/sessions/${sessionId}/events?sessionKey=${encodeURIComponent(sessionKey!)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("message", (e) => {
        try { mergeMsg(JSON.parse(e.data)); } catch { /* ignore */ }
      });

      es.addEventListener("session_updated", (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.status === "closed" || d.status === "resolved") setSessionExpired(true);
        } catch { /* ignore */ }
      });

      // On error: reconnect after 3 s (don't just die)
      es.onerror = () => {
        es.close();
        esRef.current = null;
        reconnectRef.current = setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    // Polling fallback — every 3 s fetch any messages newer than what we have
    pollRef.current = setInterval(async () => {
      if (!sessionId || !sessionKey) return;
      try {
        const { data } = await chatApi.get<Msg[]>(
          `/chat/sessions/${sessionId}/messages`,
          { headers: { "X-Session-Key": sessionKey } }
        );
        data.forEach(msg => {
          if (msg.id > lastMsgIdRef.current) mergeMsg(msg);
        });
      } catch { /* ignore */ }
    }, 3000);

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, sessionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  function clearSession() {
    localStorage.removeItem(SESSION_KEY_STORAGE);
    localStorage.removeItem(SESSION_ID_STORAGE);
    setSessionId(null);
    setSessionKey(null);
    setMessages([]);
    setSessionExpired(false);
    setShowForm(true);
  }

  async function fetchMessages() {
    if (!sessionId || !sessionKey) return;
    try {
      const { data } = await chatApi.get<Msg[]>(`/chat/sessions/${sessionId}/messages`, {
        headers: { "X-Session-Key": sessionKey },
      });
      setMessages(data);
      if (data.length) lastMsgIdRef.current = Math.max(...data.map(m => m.id));
    } catch { /* ignore */ }
  }

  async function startSession() {
    setLoading(true);
    try {
      const { data } = await chatApi.post("/chat/sessions", {
        name: name.trim() || undefined,
        mobile: mobile.trim() || undefined,
      });

      if (!data.session) {
        clearSession();
        return;
      }

      setSessionId(data.session.id);
      setSessionKey(data.sessionKey);
      localStorage.setItem(SESSION_KEY_STORAGE, data.sessionKey);
      localStorage.setItem(SESSION_ID_STORAGE, String(data.session.id));
      if (name.trim())   localStorage.setItem(CHAT_CUSTOMER_NAME_KEY, name.trim());
      if (mobile.trim()) localStorage.setItem(CHAT_CUSTOMER_MOBILE_KEY, mobile.trim());
      setShowForm(false);

      const { data: msgs } = await chatApi.get<Msg[]>(`/chat/sessions/${data.session.id}/messages`, {
        headers: { "X-Session-Key": data.sessionKey },
      });
      setMessages(msgs);
    } catch {
      alert("Could not start chat. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function closeChat() {
    setClosing(true);
    try {
      if (sessionId && sessionKey) {
        // Post a goodbye message then clear locally — server keeps the record
        await chatApi.post(
          `/chat/sessions/${sessionId}/messages`,
          { messageType: "text", content: "Chat ended by customer.", sessionKey },
          { headers: { "X-Session-Key": sessionKey } }
        ).catch(() => {});
      }
    } finally {
      clearSession();
      setClosing(false);
      setShowCloseConfirm(false);
      setOpen(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    setUnread(0);
    if (!sessionId) setShowForm(true);
  }

  // Human mode: AI has handed off — detect from system message content
  const humanMode = messages.some(
    m => m.role === "system" && (m.content.includes("live agent") || m.content.includes("Connecting you"))
  );

  async function sendText() {
    if (!input.trim() || !sessionId || !sessionKey) return;
    const text = input.trim();
    setInput("");
    if (!humanMode) setAiTyping(true);  // only show AI typing in AI mode
    await sendMessage({ messageType: "text", content: text });
  }

  async function sendMessage(payload: { messageType: string; content?: string; fileUrl?: string; fileName?: string }) {
    if (!sessionId || !sessionKey) return;
    try {
      const { data: msg } = await chatApi.post<Msg>(
        `/chat/sessions/${sessionId}/messages`,
        { ...payload, sessionKey },
        { headers: { "X-Session-Key": sessionKey } }
      );
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    } catch { setAiTyping(false); }
  }

  // ── Voice ──
  async function toggleRecording() {
    if (recording) { mediaRecorderRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        await uploadAndSend(blob, "voice-message.webm", "voice");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { alert("Microphone permission denied."); }
  }

  async function uploadAndSend(blob: Blob, fileName: string, messageType: "voice" | "image" | "file") {
    setLoading(true);
    try {
      const uuid = crypto.randomUUID();
      const { data: urlData } = await chatApi.post(`/storage/uploads/direct/${uuid}`, { fileName, contentType: blob.type });
      await fetch(urlData.url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
      await sendMessage({ messageType, fileUrl: urlData.publicUrl || urlData.url, fileName, content: "" });
    } catch (e) { console.error("Upload failed", e); }
    finally { setLoading(false); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAndSend(file, file.name, file.type.startsWith("image/") ? "image" : "file");
    e.target.value = "";
  }

  function requestHuman() {
    const text = "I'd like to talk to a human agent please.";
    setAiTyping(false);
    sendMessage({ messageType: "text", content: text });
  }

  function renderMessage(m: Msg) {
    const isAgent  = m.role === "agent";
    const isSystem = m.role === "system";
    const time = new Date(m.createdAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" });

    if (isSystem) {
      return (
        <div key={m.id} className="flex justify-center my-2">
          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{m.content}</span>
        </div>
      );
    }

    return (
      <div key={m.id} className={`flex ${isAgent ? "justify-start" : "justify-end"} mb-2 items-end gap-1.5`}>
        {isAgent && (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mb-1">
            <Bot className="h-3.5 w-3.5 text-blue-600" />
          </div>
        )}
        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm
          ${isAgent ? "bg-white text-gray-800 rounded-tl-sm border border-gray-100" : "bg-blue-600 text-white rounded-tr-sm"}`}>
          {m.messageType === "text" && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>}
          {m.messageType === "voice" && m.fileUrl && <audio controls src={m.fileUrl} className="h-8 max-w-full" />}
          {m.messageType === "image" && m.fileUrl && <img src={m.fileUrl} alt="image" className="max-w-full rounded-lg max-h-48 object-cover" />}
          {m.messageType === "file" && m.fileUrl && (
            <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline text-xs">
              <Paperclip className="h-3 w-3" />{m.fileName || "Download"}
            </a>
          )}
          <p className={`text-xs mt-0.5 ${isAgent ? "text-gray-400" : "text-blue-100"}`}>{time}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg flex items-center justify-center hover:shadow-xl active:scale-95 transition-all"
        aria-label="Open chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{unread}</span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white" style={{ height: "540px" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between shrink-0 relative">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center ring-2 ring-white/30 overflow-hidden shrink-0">
                <img src="/api/shop/app-icon" alt="Geem" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="font-semibold text-sm">Geem Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <p className="text-xs text-blue-100">Online — here to help</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {sessionId && !sessionExpired && !showForm && (
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  className="p-1.5 rounded-full hover:bg-red-500/30 transition-colors"
                  title="End chat"
                >
                  <XCircle className="h-4.5 w-4.5 opacity-80" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>

            {/* Close confirm overlay */}
            {showCloseConfirm && (
              <div className="absolute inset-0 bg-blue-800/95 flex flex-col items-center justify-center gap-3 px-5 rounded-t-2xl z-10">
                <XCircle className="h-7 w-7 text-white/70" />
                <p className="text-sm font-semibold text-center">End this chat?</p>
                <p className="text-xs text-blue-200 text-center">Your conversation will be closed.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCloseConfirm(false)}
                    className="px-4 py-1.5 rounded-xl bg-white/20 text-white text-sm hover:bg-white/30 transition-colors"
                  >
                    Keep chatting
                  </button>
                  <button
                    onClick={closeChat}
                    disabled={closing}
                    className="px-4 py-1.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    End Chat
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Session expired banner */}
          {sessionExpired ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 bg-gray-50 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                <RefreshCw className="h-7 w-7 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 text-sm">This chat has ended</h3>
                <p className="text-xs text-gray-400 mt-1">Start a new conversation below</p>
              </div>
              <button
                onClick={clearSession}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Start New Chat
              </button>
            </div>
          ) : showForm ? (
            /* Intro form */
            <div className="flex-1 flex flex-col justify-center gap-5 px-6 bg-gradient-to-b from-blue-50 to-white">
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-800 text-base">👋 Hi! We're here for you</h3>
                <p className="text-xs text-gray-500 mt-1">Tell us your name so we can greet you properly 😊</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Your Name</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
                    placeholder="e.g. Ali Hassan"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") startSession(); }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    WhatsApp Number <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
                    placeholder="03xx-xxxxxxx"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    type="tel"
                    onKeyDown={e => { if (e.key === "Enter") startSession(); }}
                  />
                </div>
              </div>
              <button
                onClick={startSession}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Start Chatting
              </button>
              <p className="text-center text-xs text-gray-400">
                Our AI assistant replies instantly ⚡<br />Human agents available on request
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 bg-gray-50 space-y-0.5">
                {messages.map(renderMessage)}
                {aiTyping && !humanMode && (
                  <div className="flex justify-start mb-2 items-end gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mb-1">
                      <Bot className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                {humanMode && (
                  <div className="flex justify-center my-2">
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Waiting for a live agent…
                    </span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Talk to human pill — hide once already transferred */}
              {!humanMode && (
                <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex justify-center shrink-0">
                  <button
                    onClick={requestHuman}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors px-3 py-1 rounded-full hover:bg-blue-50"
                  >
                    <UserRound className="h-3.5 w-3.5" /> Talk to a human agent
                  </button>
                </div>
              )}

              {/* Input bar */}
              <div className="border-t bg-white px-3 py-2 flex items-center gap-2 shrink-0">
                <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileRef.current?.click()} disabled={loading}
                  className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0" title="Attach file">
                  <Paperclip className="h-4 w-4" />
                </button>
                <button onClick={toggleRecording} disabled={loading}
                  className={`p-1.5 rounded-full transition-colors shrink-0 ${recording ? "text-red-600 bg-red-50 animate-pulse" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"}`}
                  title={recording ? "Stop recording" : "Voice message"}>
                  {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <input
                  className="flex-1 text-sm outline-none bg-transparent"
                  placeholder={recording ? "Recording… tap mic to send" : "Type your message…"}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                  disabled={recording || loading}
                />
                <button onClick={sendText} disabled={!input.trim() || recording || loading}
                  className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 shrink-0 transition-colors">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
