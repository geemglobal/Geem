import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Mic, MicOff, Paperclip, ChevronDown, Loader2, Bot, UserRound, Sparkles } from "lucide-react";
import { axiosInstance } from "@/lib/axios";

const SESSION_KEY_STORAGE    = "geem_chat_session_key";
const SESSION_ID_STORAGE     = "geem_chat_session_id";
const CHAT_CUSTOMER_NAME_KEY = "geem_chat_name";
const CHAT_CUSTOMER_MOBILE_KEY = "geem_chat_mobile";
const API = (path: string) => `/api${path}`;

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

  // Intro form
  const [showForm, setShowForm]   = useState(false);
  const [name, setName]           = useState("");
  const [mobile, setMobile]       = useState("");

  // Voice recording
  const [recording, setRecording]   = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const esRef     = useRef<EventSource | null>(null);

  // ── Restore session ──
  useEffect(() => {
    const storedKey = localStorage.getItem(SESSION_KEY_STORAGE);
    const storedId  = localStorage.getItem(SESSION_ID_STORAGE);
    if (storedKey && storedId) {
      setSessionKey(storedKey);
      setSessionId(parseInt(storedId));
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !sessionKey) return;
    fetchMessages();
  }, [sessionId, sessionKey]);

  // ── SSE real-time ──
  useEffect(() => {
    if (!sessionId || !sessionKey || !open) return;
    const url = API(`/chat/sessions/${sessionId}/events?sessionKey=${sessionKey}`);
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("message", (e) => {
      try {
        const msg: Msg = JSON.parse(e.data);
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setAiTyping(false);
        if (!open) setUnread(u => u + 1);
      } catch { /* ignore */ }
    });

    es.onerror = () => { es.close(); };
    return () => { es.close(); esRef.current = null; };
  }, [sessionId, sessionKey, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  async function fetchMessages() {
    if (!sessionId || !sessionKey) return;
    try {
      const { data } = await axiosInstance.get<Msg[]>(API(`/chat/sessions/${sessionId}/messages`), {
        headers: { "X-Session-Key": sessionKey },
      });
      setMessages(data);
    } catch { /* ignore */ }
  }

  async function startSession() {
    setLoading(true);
    try {
      const storedKey = localStorage.getItem(SESSION_KEY_STORAGE);
      const { data } = await axiosInstance.post(API("/chat/sessions"), {
        name: name.trim() || undefined,
        mobile: mobile.trim() || undefined,
        sessionKey: storedKey || undefined,
      });
      setSessionId(data.session.id);
      setSessionKey(data.sessionKey);
      localStorage.setItem(SESSION_KEY_STORAGE, data.sessionKey);
      localStorage.setItem(SESSION_ID_STORAGE, String(data.session.id));
      // Persist for checkout auto-fill
      if (name.trim()) localStorage.setItem(CHAT_CUSTOMER_NAME_KEY, name.trim());
      if (mobile.trim()) localStorage.setItem(CHAT_CUSTOMER_MOBILE_KEY, mobile.trim());
      setShowForm(false);
      const { data: msgs } = await axiosInstance.get<Msg[]>(API(`/chat/sessions/${data.session.id}/messages`), {
        headers: { "X-Session-Key": data.sessionKey },
      });
      setMessages(msgs);
    } catch {
      alert("Could not start chat. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    setUnread(0);
    if (!sessionId) setShowForm(true);
  }

  async function sendText() {
    if (!input.trim() || !sessionId || !sessionKey) return;
    const text = input.trim();
    setInput("");
    setAiTyping(true); // show typing indicator while AI prepares reply
    await sendMessage({ messageType: "text", content: text });
  }

  async function sendMessage(payload: { messageType: string; content?: string; fileUrl?: string; fileName?: string }) {
    if (!sessionId || !sessionKey) return;
    try {
      const { data: msg } = await axiosInstance.post<Msg>(
        API(`/chat/sessions/${sessionId}/messages`),
        { ...payload, sessionKey },
        { headers: { "X-Session-Key": sessionKey } }
      );
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    } catch { setAiTyping(false); }
  }

  // ── Voice ──
  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
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
    } catch {
      alert("Microphone permission denied.");
    }
  }

  async function uploadAndSend(blob: Blob, fileName: string, messageType: "voice" | "image" | "file") {
    setLoading(true);
    try {
      const uuid = crypto.randomUUID();
      const { data: urlData } = await axiosInstance.post(API(`/storage/uploads/direct/${uuid}`), {
        fileName, contentType: blob.type,
      });
      await fetch(urlData.url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
      const fileUrl = urlData.publicUrl || urlData.url;
      await sendMessage({ messageType, fileUrl, fileName, content: "" });
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    await uploadAndSend(file, file.name, isImage ? "image" : "file");
    e.target.value = "";
  }

  function requestHuman() {
    if (!sessionId || !sessionKey) return;
    setInput("I'd like to talk to a human agent please.");
    // auto-send
    setTimeout(() => {
      const text = "I'd like to talk to a human agent please.";
      setInput("");
      setAiTyping(false);
      sendMessage({ messageType: "text", content: text });
    }, 50);
  }

  function renderMessage(m: Msg) {
    const isAgent  = m.role === "agent";
    const isSystem = m.role === "system";
    const time = new Date(m.createdAt).toLocaleTimeString("en-PK", {
      timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit",
    });

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
        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${isAgent ? "bg-white text-gray-800 rounded-tl-sm border border-gray-100" : "bg-blue-600 text-white rounded-tr-sm"}`}>
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
        {open
          ? <X className="h-6 w-6" />
          : <MessageCircle className="h-6 w-6" />
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{unread}</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white" style={{ height: "540px" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center ring-2 ring-white/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">Geem Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <p className="text-xs text-blue-100">Online — here to help</p>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          {/* Intro form */}
          {showForm ? (
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
                  <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp Number <span className="text-gray-400 font-normal">(optional)</span></label>
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
                Our AI assistant replies instantly ⚡<br />
                Human agents available on request
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 bg-gray-50 space-y-0.5">
                {messages.map(renderMessage)}

                {/* AI typing indicator */}
                {aiTyping && (
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

                <div ref={bottomRef} />
              </div>

              {/* Talk-to-human pill */}
              <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex justify-center shrink-0">
                <button
                  onClick={requestHuman}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors px-3 py-1 rounded-full hover:bg-blue-50"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  Talk to a human agent
                </button>
              </div>

              {/* Input bar */}
              <div className="border-t bg-white px-3 py-2 flex items-center gap-2 shrink-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  onClick={toggleRecording}
                  disabled={loading}
                  className={`p-1.5 rounded-full transition-colors shrink-0 ${recording ? "text-red-600 bg-red-50 animate-pulse" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"}`}
                  title={recording ? "Stop recording" : "Voice message"}
                >
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
                <button
                  onClick={sendText}
                  disabled={!input.trim() || recording || loading}
                  className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 shrink-0 transition-colors"
                >
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
