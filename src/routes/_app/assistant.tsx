import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Sparkles, User, Wrench, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/assistant")({
  component: AssistantPage,
});

const STORAGE_KEY = "assistant.messages.v1";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AssistantPage() {
  const { role } = useAuth();
  const { lang } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const initialMessages = useMemo(() => loadMessages(), []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }),
        body: () => ({ role, lang }),
      }),
    [token, role, lang],
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: "assistant-main",
    messages: initialMessages,
    transport,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (status === "ready") taRef.current?.focus();
  }, [status]);

  const busy = status === "submitted" || status === "streaming";

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  };

  const suggestions = lang === "en"
    ? [
        "Show me today's pending mail",
        "Daily briefing for the Director",
        "Summarize incoming mail this week",
        "Find legal texts on artisanal mining",
      ]
    : [
        "Liste les courriers en attente d'aujourd'hui",
        "Briefing du jour pour le Directeur",
        "Résume les courriers arrivés cette semaine",
        "Cherche les textes juridiques sur l'exploitation artisanale",
      ];

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-3 md:h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-glow)] text-primary-foreground shadow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{lang === "en" ? "AI Assistant" : "Assistant IA"}</h1>
            <p className="text-xs text-muted-foreground">
              {lang === "en"
                ? "Search mail, generate reports, query legal texts, get briefings."
                : "Recherchez le courrier, générez des rapports, interrogez les textes juridiques, obtenez des briefings."}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([]);
              window.localStorage.removeItem(STORAGE_KEY);
            }}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {lang === "en" ? "Clear" : "Effacer"}
          </Button>
        )}
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/60" />
              <p className="max-w-md text-sm text-muted-foreground">
                {lang === "en"
                  ? "Ask anything about mail, reports, legal texts or daily tasks."
                  : "Posez n'importe quelle question sur le courrier, les rapports, les textes juridiques ou les tâches du jour."}
              </p>
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage({ text: s })}
                    className="rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {lang === "en" ? "Thinking…" : "Réflexion…"}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={lang === "en" ? "Type your message…" : "Tapez votre message…"}
              rows={2}
              className="min-h-[44px] flex-1 resize-none"
              disabled={busy}
            />
            {busy ? (
              <Button onClick={() => stop()} variant="secondary" size="icon" className="h-11 w-11">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : (
              <Button onClick={send} size="icon" className="h-11 w-11" disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={["flex gap-3", isUser ? "justify-end" : "justify-start"].join(" ")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-glow)] text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={["max-w-[85%] space-y-2", isUser ? "items-end" : "items-start"].join(" ")}>
        {message.parts?.map((part, i) => {
          if (part.type === "text") {
            return (
              <div
                key={i}
                className={[
                  "rounded-2xl px-4 py-2 text-sm",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                ].join(" ")}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{part.text}</p>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-headings:my-2">
                    <ReactMarkdown>{part.text}</ReactMarkdown>
                  </div>
                )}
              </div>
            );
          }
          if (part.type?.startsWith("tool-")) {
            const toolPart = part as { type: string; state?: string; toolName?: string; input?: unknown; output?: unknown };
            const name = toolPart.toolName ?? part.type.replace(/^tool-/, "");
            return (
              <details key={i} className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs">
                <summary className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  <span className="font-medium">{name}</span>
                  <span className="text-[10px] opacity-60">{toolPart.state ?? ""}</span>
                </summary>
                {toolPart.input != null && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px]">
                    {JSON.stringify(toolPart.input, null, 2)}
                  </pre>
                )}
                {toolPart.output != null && (
                  <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted/50 p-2 text-[11px]">
                    {JSON.stringify(toolPart.output, null, 2)}
                  </pre>
                )}
              </details>
            );
          }
          return null;
        })}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
