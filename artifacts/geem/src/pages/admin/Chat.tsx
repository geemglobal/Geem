import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send } from "lucide-react";

interface ChatSession { id: number; customerName: string | null; status: string; unreadCount: number; lastMessage: string | null; createdAt: string; }
interface ChatMessage { id: number; sessionId: number; role: string; content: string; createdAt: string; }

export default function Chat() {
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [reply, setReply] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: sessions } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: () => axiosInstance.get<ChatSession[]>("/chat/sessions").then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", selectedSession?.id],
    queryFn: () => axiosInstance.get<ChatMessage[]>(`/chat/sessions/${selectedSession!.id}/messages`).then(r => r.data),
    enabled: !!selectedSession,
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => axiosInstance.post(`/chat/sessions/${selectedSession!.id}/messages`, { content, role: "agent" }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chat-messages", selectedSession?.id] }); setReply(""); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" />Live Chat</h1>
        <p className="text-muted-foreground">Manage customer chat sessions</p>
      </div>

      <div className="grid grid-cols-3 gap-4 h-[600px]">
        <Card className="overflow-y-auto">
          <CardContent className="pt-4 space-y-2">
            {!sessions?.length && <p className="text-center text-muted-foreground py-4 text-sm">No chat sessions</p>}
            {sessions?.map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`p-3 rounded-lg cursor-pointer border transition-all ${selectedSession?.id === s.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`}
              >
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm">{s.customerName || `Session #${s.id}`}</p>
                  {s.unreadCount > 0 && <Badge className="h-5 w-5 p-0 justify-center text-xs">{s.unreadCount}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1">{s.lastMessage || "No messages yet"}</p>
                <div className="flex justify-between items-center mt-1">
                  <Badge variant={s.status === "open" ? "default" : "secondary"} className="text-xs">{s.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-2 flex flex-col">
          {!selectedSession ? (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a chat session</p>
              </div>
            </CardContent>
          ) : (
            <>
              <div className="p-4 border-b">
                <p className="font-semibold">{selectedSession.customerName || `Session #${selectedSession.id}`}</p>
                <p className="text-xs text-muted-foreground">Started {new Date(selectedSession.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>
              </div>
              <CardContent className="flex-1 overflow-y-auto py-4 space-y-3">
                {messages?.map(m => (
                  <div key={m.id} className={`flex ${m.role === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${m.role === "agent" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p>{m.content}</p>
                      <p className={`text-xs mt-1 ${m.role === "agent" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(m.createdAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
                {!messages?.length && <p className="text-center text-muted-foreground text-sm">No messages yet</p>}
              </CardContent>
              <div className="p-4 border-t flex gap-2">
                <Input
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Type a reply..."
                  onKeyDown={e => { if (e.key === "Enter" && reply.trim()) sendMessage.mutate(reply); }}
                />
                <Button onClick={() => reply.trim() && sendMessage.mutate(reply)} disabled={!reply.trim() || sendMessage.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
