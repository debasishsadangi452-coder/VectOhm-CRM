import { useEffect, useRef, useState } from "react";
import { Bot, Check, Loader2, MessageSquarePlus, Send, ShieldAlert, Trash2, User, X } from "lucide-react";
import { toast } from "sonner";
import {
  useAssistantCapabilities,
  useAssistantConversation,
  useAssistantConversations,
  useCancelAssistantAction,
  useConfirmAssistantAction,
  useDeleteAssistantConversation,
  useSendAssistantMessage,
} from "@/hooks/use-assistant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantAction, AssistantMessage } from "@/lib/api/assistant";

const TOOL_LABEL: Record<string, string> = {
  list_intent_automations: "Checked automations",
  get_automation_leads: "Looked at automation leads",
  list_pending_outreach: "Checked emails waiting for approval",
  search_contacts: "Searched contacts",
  search_companies: "Searched companies",
  list_deals: "Looked at deals",
  list_tasks: "Checked tasks",
  list_projects: "Checked projects",
  find_user: "Looked up a colleague",
  list_leave_requests: "Checked leave requests",
  attendance_today: "Checked today's attendance",
};

const toolLabel = (name: string) => TOOL_LABEL[name] ?? name.replace(/_/g, " ");

function errMsg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function AssistantChat() {
  const { data: caps } = useAssistantCapabilities();
  const { data: conversations = [] } = useAssistantConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: conversation, isLoading: loadingConversation } = useAssistantConversation(activeId);
  const send = useSendAssistantMessage();
  const confirm = useConfirmAssistantAction();
  const cancel = useCancelAssistantAction();
  const remove = useDeleteAssistantConversation();

  const [draft, setDraft] = useState("");
  // Shown immediately while the model is thinking; replaced by the real conversation.
  const [pendingText, setPendingText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages: AssistantMessage[] = conversation?.messages ?? [];
  const pending: AssistantAction[] = (conversation?.actions ?? []).filter((a) => a.status === "PENDING");
  const busy = send.isPending || confirm.isPending || cancel.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, pending.length, pendingText]);

  async function submit(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setPendingText(message);
    try {
      const res = await send.mutateAsync({ conversationId: activeId ?? undefined, message });
      setActiveId(res.id);
    } catch (err) {
      setDraft(message);
      toast.error(errMsg(err, "The assistant couldn't answer."));
    } finally {
      setPendingText(null);
    }
  }

  async function decide(action: AssistantAction, accept: boolean) {
    try {
      if (accept) await confirm.mutateAsync(action.id);
      else await cancel.mutateAsync(action.id);
    } catch (err) {
      toast.error(errMsg(err, "Could not complete that."));
    }
  }

  async function deleteChat(id: string) {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await remove.mutateAsync(id);
      if (activeId === id) setActiveId(null);
    } catch (err) {
      toast.error(errMsg(err, "Could not delete the conversation."));
    }
  }

  const empty = !activeId && !pendingText;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-[calc(100vh-9rem)] min-h-[480px]">
      <aside className="rounded-2xl border border-border/80 bg-card flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border/60">
          <Button onClick={() => setActiveId(null)} variant="outline" className="w-full gap-2 text-xs font-bold">
            <MessageSquarePlus className="size-4" /> New chat
          </Button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Past conversations">
          {conversations.length === 0 && <li className="text-[11px] text-text-dim p-2">No chats yet.</li>}
          {conversations.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`flex-1 min-w-0 text-left text-xs px-2.5 py-2 rounded-lg truncate ${
                  c.id === activeId ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                }`}
              >
                {c.title}
              </button>
              <button
                type="button"
                onClick={() => deleteChat(c.id)}
                title="Delete chat"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-text-muted hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-2xl border border-border/80 bg-card flex flex-col overflow-hidden">
        <header className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          <h1 className="font-black text-base">Assistant</h1>
          {caps && (
            <span className="text-[11px] text-text-dim">
              · {caps.tools.length} abilities for your role
              {caps.tools.some((t) => t.write) && " · asks before changing anything"}
            </span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4" aria-live="polite">
          {caps && !caps.configured && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2">
              <ShieldAlert className="size-4 shrink-0 text-amber-600" />
              <span>The assistant isn't set up on this server yet (the AI key is missing). Ask an admin to add it.</span>
            </div>
          )}

          {empty && (
            <div className="max-w-xl mx-auto text-center space-y-4 pt-8">
              <div className="size-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Bot className="size-6" />
              </div>
              <h2 className="font-black text-lg">How can I help?</h2>
              <p className="text-xs text-text-dim">
                I can look things up and do work in the CRM using only what your role is allowed to see and do. I'll
                always ask you to confirm before I change data or send an email.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {(caps?.suggestions ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border/70 hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingConversation && activeId && <Loader2 className="size-5 animate-spin text-primary" />}

          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {pendingText && <Bubble message={{ id: "pending", role: "user", text: pendingText, tools: [], createdAt: "" }} />}
          {send.isPending && (
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}

          {pending.map((action) => (
            <div key={action.id} className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3 max-w-2xl" role="group" aria-label="Confirm action">
              <div className="text-[10px] font-extrabold uppercase tracking-wide text-primary">Needs your confirmation</div>
              <p className="text-sm">{action.summary}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide(action, true)} disabled={busy} className="gap-1.5">
                  {confirm.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(action, false)} disabled={busy} className="gap-1.5">
                  <X className="size-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft);
          }}
          className="border-t border-border/60 p-3 flex items-end gap-2"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(draft);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask me anything about your work…"
            aria-label="Message"
            className="resize-none min-h-[44px] max-h-40"
          />
          <Button type="submit" disabled={busy || !draft.trim() || caps?.configured === false} className="h-11 gap-1.5" aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      </section>
    </div>
  );
}

function Bubble({ message }: { message: AssistantMessage }) {
  const mine = message.role === "user";
  return (
    <div className={`flex gap-2.5 ${mine ? "justify-end" : ""}`}>
      {!mine && (
        <div className="size-7 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center mt-0.5">
          <Bot className="size-4" />
        </div>
      )}
      <div className={`max-w-[80%] space-y-1.5 ${mine ? "items-end" : ""}`}>
        {message.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.tools.map((t, i) => (
              <span key={`${t}-${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-text-dim border border-border/60">
                {toolLabel(t)}
              </span>
            ))}
          </div>
        )}
        {message.text && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
            }`}
          >
            <FormattedMessage text={message.text} isUser={mine} />
          </div>
        )}
      </div>
      {mine && (
        <div className="size-7 shrink-0 rounded-full bg-muted text-text-dim flex items-center justify-center mt-0.5">
          <User className="size-4" />
        </div>
      )}
    </div>
  );
}

function renderInlineTokens(line: string, isUser = false) {
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+?\*|`[^`\n]+`|\[([^\]]+)\]\(([^)]+)\))/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      elements.push(line.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const key = `${match.index}-${raw}`;
    if (raw.startsWith("***") && raw.endsWith("***")) {
      elements.push(
        <strong key={key} className={`font-bold italic ${isUser ? "text-primary-foreground" : "text-foreground font-semibold"}`}>
          {raw.slice(3, -3)}
        </strong>,
      );
    } else if (raw.startsWith("**") && raw.endsWith("**")) {
      elements.push(
        <strong key={key} className={`font-bold ${isUser ? "text-primary-foreground" : "text-foreground font-semibold"}`}>
          {raw.slice(2, -2)}
        </strong>,
      );
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      elements.push(
        <em key={key} className="italic">
          {raw.slice(1, -1)}
        </em>,
      );
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      elements.push(
        <code
          key={key}
          className={`px-1.5 py-0.5 rounded text-xs font-mono ${
            isUser ? "bg-white/20 text-primary-foreground" : "bg-background/80 text-foreground border border-border/50"
          }`}
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("[") && match[2] && match[3]) {
      elements.push(
        <a
          key={key}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80"
        >
          {match[2]}
        </a>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    elements.push(line.slice(lastIndex));
  }
  return elements;
}

function FormattedMessage({ text, isUser = false }: { text: string; isUser?: boolean }) {
  const codeBlockParts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-1">
      {codeBlockParts.map((part, partIdx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const rawContent = part.slice(3, -3).trimStart();
          const firstNl = rawContent.indexOf("\n");
          let lang = "";
          let code = rawContent;
          if (firstNl !== -1) {
            const firstLine = rawContent.slice(0, firstNl).trim();
            if (/^[a-zA-Z0-9_-]+$/.test(firstLine)) {
              lang = firstLine;
              code = rawContent.slice(firstNl + 1);
            }
          }
          return (
            <div key={partIdx} className="my-2 rounded-lg overflow-hidden border border-border/60 bg-background/90 text-foreground">
              {lang && (
                <div className="px-3 py-1 text-[10px] font-mono text-text-dim border-b border-border/40 uppercase tracking-wider">
                  {lang}
                </div>
              )}
              <pre className="p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const lines = part.split("\n");
        return (
          <div key={partIdx} className="space-y-1">
            {lines.map((line, lineIdx) => {
              if (!line.trim()) {
                return <div key={lineIdx} className="h-1.5" />;
              }

              const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
              if (headingMatch) {
                const level = headingMatch[1].length;
                const content = headingMatch[2];
                const headingClass =
                  level === 1 ? "font-bold text-base mt-2 mb-1" : level === 2 ? "font-bold text-sm mt-1.5 mb-0.5" : "font-semibold text-xs mt-1 mb-0.5";
                return (
                  <div key={lineIdx} className={headingClass}>
                    {renderInlineTokens(content, isUser)}
                  </div>
                );
              }

              return (
                <div key={lineIdx} className="leading-relaxed">
                  {renderInlineTokens(line, isUser)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
