import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Mic, MicOff, Paperclip, Volume2, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { axiosInstance } from "@/lib/axios";

const SESSION_KEY_STORAGE = "geem_chat_session_key";
const SESSION_ID_STORAGE  = "geem_chat_session_id";
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

export default function ShopChat() {
  const [open, setOpen]         = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [unread, setUnread]     = useState(0);

  // Intro form
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState("");
  const [mobile, setMobile]     = useState("");

  // Voice recording
  const [recording, setRecording]     = useState(false);
  const [audioBlob, setAudioBlob]     = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const esRef      = useRef<EventSource | null>(null);

  // ── Restore session from localStorage ──
  useEffect(() => {
    const storedKey = localStorage.getItem(SESSION_KEY_STORAGE);
    const storedId  = localStorage.getItem(SESSION_ID_STORAGE);
    if (storedKey && storedId) {
      setSessionKey(storedKey);
      setSessionId(parseInt(storedId));
    }
  }, []);

  // ── Load messages when session is known ──
  useEffect(() => {
    if (!sessionId || !sessionKey) return;
    fetchMessages();
  }, [sessionId, sessionKey]);

  // ── SSE – real-time updates ──
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
      } catch { /* ignore */ }
    });

    es.addEventListener("session_updated", () => { /* no-op for shop side */ });

    es.onerror = () => {
      es.close();
      // retry after 5s
      setTimeout(() => {
        if (sessionId && sessionKey && open) {
          // component will re-subscribe via effect on next render
        }
      }, 5000);
    };

    return () => { es.close(); esRef.current = null; };
  }, [sessionId, sessionKey, open]);

  // ── Scroll to bottom ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // ── Unread counter when closed ──
  useEffect(() => {
    if (open) { setUnread(0); return; }
    const agentMsgs = messages.filter(m => m.role === "agent");
    // simple heuristic: count msgs since last open (we don't track read state locally, just badge on new messages)
  }, [messages, open]);

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
      setShowForm(false);
      // load messages
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
    } catch { /* ignore */ }
  }

  // ── Voice recording ──
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
        // upload
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
      // Get upload URL
      const uuid = crypto.randomUUID();
      const { data: urlData } = await axiosInstance.post(API(`/storage/uploads/direct/${uuid}`), {
        fileName, contentType: blob.type,
      });
      // Upload to storage
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

  function renderMessage(m: Msg) {
    const isAgent  = m.role === "agent";
    const isSystem = m.role === "system";
    const time = new Date(m.createdAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" });

    if (isSystem) {
      return (
        <div key={m.id} className="flex justify-center my-1">
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{m.content}</span>
        </div>
      );
    }

    return (
      <div key={m.id} className={`flex ${isAgent ? "justify-start" : "justify-end"} mb-2`}>
        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${isAgent ? "bg-white text-gray-800 rounded-tl-sm" : "bg-blue-600 text-white rounded-tr-sm"}`}>
          {m.messageType === "text" && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
          {m.messageType === "voice" && m.fileUrl && (
            <audio controls src={m.fileUrl} className="h-8 max-w-full" />
          )}
          {m.messageType === "image" && m.fileUrl && (
            <img src={m.fileUrl} alt="image" className="max-w-full rounded-lg max-h-48 object-cover" />
          )}
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
        className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
        aria-label="Open chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{unread}</span>
        )}
      </button>

      {/* Chat drawer */}
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white" style={{ height: "520px" }}>
          {/* Header */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">Geem Support</p>
                <p className="text-xs text-blue-100">We typically reply in minutes</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-white/20">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          {/* Intro form */}
          {showForm ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 bg-gray-50">
              <p className="text-center text-sm text-gray-600 font-medium">Start a conversation</p>
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your name (optional)"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mobile number (optional)"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                type="tel"
              />
              <button
                onClick={startSession}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start Chat →
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 bg-gray-50 space-y-0.5">
                {messages.map(renderMessage)}
                <div ref={bottomRef} />
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
                  placeholder={recording ? "Recording… tap mic to send" : "Type a message…"}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                  disabled={recording || loading}
                />
                <button
                  onClick={sendText}
                  disabled={!input.trim() || recording || loading}
                  className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 shrink-0"
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
