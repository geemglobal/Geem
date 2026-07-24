import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, Mic, MicOff, Paperclip, Phone, User,
  Ticket, CheckCircle2, XCircle, RefreshCw, Loader2, Clock,
} from "lucide-react";

interface ChatSession {
  id: number; customerName: string | null; customerMobile: string | null;
  assignedStaffId: number | null; staffName: string | null;
  status: string; unreadCount: number; lastMessage: string | null;
  ticketNumber: string | null; createdAt: string; updatedAt: string;
}
interface ChatMessage {
  id: number; sessionId: number; role: string; messageType: string;
  content: string; fileUrl?: string | null; fileName?: string | null; createdAt: string;
}
interface StaffMember { id: number; name: string; role: string; }

const API = (path: string) => `/api${path}`;

export default function Chat() {
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [reply, setReply] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const globalEsRef = useRef<EventSource | null>(null);
  const globalReconnRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: sessions = [], refetch: refetchSessions } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions"],
    queryFn: () => axiosInstance.get<ChatSession[]>(API("/chat/sessions")).then(r => r.data),
    refetchInterval: 4000,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", selectedSession?.id],
    queryFn: () => axiosInstance.get<ChatMessage[]>(API(`/chat/sessions/${selectedSession!.id}/messages`)).then(r => r.data),
    enabled: !!selectedSession,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["chat-staff"],
    queryFn: () => axiosInstance.get<StaffMember[]>(API("/chat/staff")).then(r => r.data),
  });

  // ── Audio notification helper ─────────────────────────────────────────────
  const prevUnreadTotalRef = useRef(0);
  useEffect(() => {
    const total = sessions.reduce((s, x) => s + (x.unreadCount ?? 0), 0);
    if (total > prevUnreadTotalRef.current) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } catch { /* ignore */ }
    }
    prevUnreadTotalRef.current = total;
  }, [sessions]);

  // ── Global SSE (all sessions → triggers list refetch) ────────────────────
  useEffect(() => {
    let dead = false;
    function connect() {
      if (dead) return;
      const token = localStorage.getItem("geem_token");
      if (!token) return;
      const es = new EventSource(API(`/chat/admin/events?token=${encodeURIComponent(token)}`), { withCredentials: true });
      globalEsRef.current = es;
      es.addEventListener("session_updated", () => refetchSessions());
      es.addEventListener("message", () => refetchSessions());
      es.onerror = () => {
        es.close();
        globalEsRef.current = null;
        if (!dead) globalReconnRef.current = setTimeout(connect, 4000);
      };
    }
    connect();
    return () => {
      dead = true;
      globalEsRef.current?.close();
      if (globalReconnRef.current) clearTimeout(globalReconnRef.current);
    };
  }, []);

  // ── SSE for selected session (with reconnect) ─────────────────────────────
  useEffect(() => {
    if (!selectedSession) return;
    let dead = false;
    const reconnRef = { current: null as ReturnType<typeof setTimeout> | null };

    function connect() {
      if (dead) return;
      const url = API(`/chat/sessions/${selectedSession!.id}/events`);
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;
      es.addEventListener("message", () => refetchMessages());
      es.addEventListener("session_updated", () => { refetchSessions(); refetchMessages(); });
      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!dead) reconnRef.current = setTimeout(connect, 3000);
      };
    }
    connect();
    return () => {
      dead = true;
      esRef.current?.close();
      esRef.current = null;
      if (reconnRef.current) clearTimeout(reconnRef.current);
    };
  }, [selectedSession?.id]);

  // ── Scroll to bottom on new messages ────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const sendMsg = useMutation({
    mutationFn: (payload: { content?: string; messageType?: string; fileUrl?: string; fileName?: string }) =>
      axiosInstance.post<ChatMessage>(API(`/chat/sessions/${selectedSession!.id}/messages`), { role: "agent", messageType: "text", ...payload }).then(r => r.data),
    onSuccess: () => { refetchMessages(); refetchSessions(); setReply(""); },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  const updateSession = useMutation({
    mutationFn: (patch: { status?: string; assignedStaffId?: number }) =>
      axiosInstance.patch(API(`/chat/sessions/${selectedSession!.id}`), patch).then(r => r.data),
    onSuccess: (data) => {
      setSelectedSession(data);
      refetchSessions();
      toast({ title: "Session updated" });
    },
  });

  const createTicket = useMutation({
    mutationFn: () => axiosInstance.post(API(`/chat/sessions/${selectedSession!.id}/ticket`)).then(r => r.data),
    onSuccess: (data) => {
      refetchSessions();
      refetchMessages();
      setSelectedSession(prev => prev ? { ...prev, ticketNumber: data.ticketNumber } : prev);
      toast({ title: `Ticket created: ${data.ticketNumber}` });
    },
  });

  // ── Voice recording ───────────────────────────────────────────────────────
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
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAndSend(blob, "voice.webm", "voice");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast({ title: "Microphone permission denied", variant: "destructive" });
    }
  }

  async function uploadAndSend(blob: Blob, fileName: string, messageType: "voice" | "image" | "file") {
    setUploading(true);
    try {
      const uuid = crypto.randomUUID();
      const { data: urlData } = await axiosInstance.post(API(`/storage/uploads/direct/${uuid}`), {
        fileName, contentType: blob.type,
      });
      await fetch(urlData.url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
      const fileUrl = urlData.publicUrl || urlData.url;
      await sendMsg.mutateAsync({ messageType, fileUrl, fileName, content: "" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAndSend(file, file.name, file.type.startsWith("image/") ? "image" : "file");
    e.target.value = "";
  }

  function handleSend() {
    if (reply.trim()) sendMsg.mutate({ content: reply, messageType: "text" });
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderMessage(m: ChatMessage) {
    const isAgent  = m.role === "agent";
    const isSystem = m.role === "system";
    const time = new Date(m.createdAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" });

    if (isSystem) return (
      <div key={m.id} className="flex justify-center my-1">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{m.content}</span>
      </div>
    );

    return (
      <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"} mb-2`}>
        {!isAgent && (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 mr-2 shrink-0 mt-1">C</div>
        )}
        <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm shadow-sm ${isAgent ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
          {m.messageType === "text" && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
          {m.messageType === "voice" && m.fileUrl && <audio controls src={m.fileUrl} className="h-8 max-w-full" />}
          {m.messageType === "image" && m.fileUrl && <img src={m.fileUrl} alt="img" className="max-w-full rounded-lg max-h-48 object-cover" />}
          {m.messageType === "file" && m.fileUrl && (
            <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline text-xs">
              <Paperclip className="h-3 w-3" />{m.fileName || "Download"}
            </a>
          )}
          <p className={`text-xs mt-0.5 ${isAgent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{time}</p>
        </div>
        {isAgent && (
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary ml-2 shrink-0 mt-1">A</div>
        )}
      </div>
    );
  }

  const open   = sessions.filter(s => s.status === "open");
  const closed = sessions.filter(s => s.status !== "open");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" />Live Chat</h1>
          <p className="text-muted-foreground text-sm">Customer support sessions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchSessions()}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 200px)", minHeight: "500px" }}>
        {/* ── Sessions sidebar ── */}
        <Card className="overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-muted/30 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sessions</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{open.length} open</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{closed.length} closed</span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {!sessions.length && (
              <p className="text-center text-muted-foreground py-8 text-sm">No chat sessions yet</p>
            )}
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`w-full text-left p-3 border-b transition-all hover:bg-accent ${selectedSession?.id === s.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex justify-between items-start gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <p className="font-medium text-sm truncate">{s.customerName || `#${s.id}`}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">{s.unreadCount}</span>
                    )}
                    <Badge variant={s.status === "open" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">{s.status}</Badge>
                  </div>
                </div>
                {s.customerMobile && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" />{s.customerMobile}</p>
                )}
                {s.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{s.lastMessage}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  {s.ticketNumber && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Ticket className="h-2.5 w-2.5" />{s.ticketNumber}
                    </span>
                  )}
                  {s.staffName && (
                    <span className="text-[10px] text-muted-foreground ml-auto">@{s.staffName.split(" ")[0]}</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(s.updatedAt || s.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </button>
            ))}
          </div>
        </Card>

        {/* ── Chat panel ── */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {!selectedSession ? (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a session to start chatting</p>
              </div>
            </CardContent>
          ) : (
            <>
              {/* Header */}
              <div className="p-3 border-b bg-muted/20 shrink-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm">{selectedSession.customerName || `Session #${selectedSession.id}`}</p>
                    {selectedSession.customerMobile && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{selectedSession.customerMobile}</p>
                    )}
                    {selectedSession.ticketNumber && (
                      <p className="text-xs font-medium text-amber-700 flex items-center gap-1"><Ticket className="h-3 w-3" />{selectedSession.ticketNumber}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {/* Assign staff */}
                    <Select
                      value={selectedSession.assignedStaffId?.toString() ?? ""}
                      onValueChange={v => updateSession.mutate({ assignedStaffId: parseInt(v) })}
                    >
                      <SelectTrigger className="h-7 text-xs w-36">
                        <SelectValue placeholder="Assign staff" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()} className="text-xs">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Ticket */}
                    {!selectedSession.ticketNumber && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => createTicket.mutate()} disabled={createTicket.isPending}>
                        <Ticket className="h-3 w-3 mr-1" />Create Ticket
                      </Button>
                    )}

                    {/* Status */}
                    {selectedSession.status === "open" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" onClick={() => updateSession.mutate({ status: "resolved" })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Resolve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300" onClick={() => updateSession.mutate({ status: "closed" })}>
                          <XCircle className="h-3 w-3 mr-1" />Close
                        </Button>
                      </>
                    )}
                    {selectedSession.status !== "open" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateSession.mutate({ status: "open" })}>
                        <RefreshCw className="h-3 w-3 mr-1" />Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/50 space-y-0.5">
                {messages.map(renderMessage)}
                {!messages.length && (
                  <p className="text-center text-muted-foreground text-sm py-8">No messages yet</p>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xlsx" className="hidden" onChange={handleFile} />
              <div className="border-t p-3 flex items-center gap-2 bg-white shrink-0">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  onClick={toggleRecording}
                  disabled={uploading}
                  className={`p-1.5 rounded-full transition-colors ${recording ? "text-red-600 bg-red-50 animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                  title={recording ? "Stop & send" : "Voice message"}
                >
                  {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <Input
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder={recording ? "Recording… tap mic to send" : "Type a reply…"}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && reply.trim()) { e.preventDefault(); handleSend(); } }}
                  disabled={recording || uploading || sendMsg.isPending}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!reply.trim() || recording || uploading || sendMsg.isPending}
                  size="sm"
                >
                  {sendMsg.isPending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
