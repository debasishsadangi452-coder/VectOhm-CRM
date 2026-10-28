import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  SendHorizontal,
  Mail,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Search,
  PenSquare,
  CheckCircle2,
  Copy,
  ExternalLink,
  User,
  Building,
  Briefcase,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useEmailConnectionStatus } from "@/hooks/use-email-connections";
import { useSyncedEmails, useSyncEmails, useSendEmail, useDeleteSyncedEmail } from "@/hooks/use-synced-emails";
import type { SyncedEmail } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CONNECTION_TYPE_LABEL: Record<string, string> = {
  SMTP: "Zoho / IMAP",
  OAUTH_GOOGLE: "Google",
  OAUTH_MICROSOFT: "Microsoft",
  OAUTH_ZOHO: "Zoho",
};

export const Route = createFileRoute("/_app/sent")({
  component: SentPage,
});

function SentPage() {
  useDepartmentGuard("Sales");

  const { data: status, isLoading: statusLoading } = useEmailConnectionStatus();
  const { data: messages, isLoading: messagesLoading } = useSyncedEmails({ direction: "SENT" });
  const syncEmails = useSyncEmails();
  const sendEmailMutation = useSendEmail();
  const deleteEmailMutation = useDeleteSyncedEmail();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Compose Form State
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subjectInput, setSubjectInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");

  const filteredMessages = useMemo(() => {
    if (!messages) return [];

    // Filter out unwanted empty ghost records (emails with no subject and empty body)
    const valid = messages.filter((m) => {
      const hasSubject = m.subject && m.subject !== "(No Subject)" && m.subject.trim() !== "";
      const hasContent = (m.bodyPreview && m.bodyPreview.trim() !== "") || (m.bodyHtml && m.bodyHtml.trim() !== "");
      return hasSubject || hasContent;
    });

    if (!searchQuery.trim()) return valid;
    const q = searchQuery.toLowerCase().trim();
    return valid.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.toAddresses.some((to) => to.toLowerCase().includes(q)) ||
        m.fromAddress.toLowerCase().includes(q) ||
        m.bodyPreview.toLowerCase().includes(q),
    );
  }, [messages, searchQuery]);

  const selected = useMemo(() => {
    if (selectedId) {
      const found = filteredMessages.find((m) => m.id === selectedId);
      if (found) return found;
    }
    return filteredMessages[0] ?? null;
  }, [filteredMessages, selectedId]);

  function handleDeleteEmail(id: string) {
    if (!confirm("Remove this sent email record from CRM?")) return;
    deleteEmailMutation.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) {
          setSelectedId(null);
        }
      },
    });
  }

  const isConnected = !!status?.connected;
  const connectedEmail =
    status?.providerAccountEmail || status?.fromEmail || status?.smtpUsername || "Zoho Mail";
  const providerLabel = status?.connectionType
    ? CONNECTION_TYPE_LABEL[status.connectionType] ?? "Zoho Mail"
    : "Zoho Mail";

  function handleSendDirect(e: React.FormEvent) {
    e.preventDefault();
    if (!toInput.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }
    if (!subjectInput.trim()) {
      toast.error("Please enter a subject line");
      return;
    }
    if (!bodyInput.trim()) {
      toast.error("Please enter the email body");
      return;
    }

    const ccList = ccInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    sendEmailMutation.mutate(
      {
        to: toInput.trim(),
        cc: ccList.length > 0 ? ccList : undefined,
        subject: subjectInput.trim(),
        bodyText: bodyInput.trim(),
        bodyHtml: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${bodyInput
          .trim()
          .replace(/\n/g, "<br/>")}</div>`,
      },
      {
        onSuccess: (data) => {
          setIsComposeOpen(false);
          setToInput("");
          setCcInput("");
          setShowCc(false);
          setSubjectInput("");
          setBodyInput("");
          if (data?.id) {
            setSelectedId(data.id);
          }
        },
      },
    );
  }

  function copyToClipboard(text: string, label = "Email") {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <SendHorizontal className="size-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Sent</h1>
            {isConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {providerLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-text-dim">
            All emails dispatched from the CRM through your integrated Zoho mail account.
          </p>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => setIsComposeOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <PenSquare className="size-3.5" />
            <span>Compose Email</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => syncEmails.mutate()}
            disabled={syncEmails.isPending}
            className="gap-1.5 border-border-subtle text-xs"
            title="Sync sent items from mail server"
          >
            <RefreshCw className={`size-3.5 ${syncEmails.isPending ? "animate-spin" : ""}`} />
            <span>{syncEmails.isPending ? "Syncing…" : "Sync"}</span>
          </Button>
        </div>
      </div>

      {/* Disconnected State Notice */}
      {!statusLoading && !isConnected && (
        <div className="bg-panel border border-border-subtle rounded-xl p-6 text-sm text-text-dim flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="font-medium text-foreground">Connect your Zoho mailbox</p>
            <p className="text-xs text-text-dim mt-0.5">
              Connect your Zoho Mail account (via SMTP app password or Zoho OAuth) to synchronize all
              outbound CRM emails seamlessly.
            </p>
          </div>
          <a
            href="/bulk-email"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Mail className="size-3.5" />
            Connect Zoho Mail
          </a>
        </div>
      )}

      {/* Connected Sent Interface */}
      {isConnected && (
        <div className="grid md:grid-cols-[360px_1fr] gap-4 items-start">
          {/* Left Column: Sent Messages List */}
          <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden md:sticky md:top-4 self-start max-h-[calc(100vh-7rem)] flex flex-col shadow-sm">
            {/* Header info & Search bar */}
            <div className="p-3 border-b border-border-subtle shrink-0 bg-panel space-y-2.5 z-10">
              <div className="flex items-center justify-between text-xs text-text-dim">
                <span className="font-medium truncate mr-2" title={connectedEmail}>
                  Zoho: {connectedEmail}
                </span>
                <span className="text-[11px] font-mono text-text-dim/80 shrink-0">
                  {filteredMessages.length} sent
                </span>
              </div>

              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search sent emails…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-canvas/40 border border-border-subtle rounded-lg pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-text-dim/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Emails List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border-subtle min-h-0">
              {messagesLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-text-dim p-8">
                  <Loader2 className="size-4 animate-spin text-primary" /> Loading sent emails…
                </div>
              )}

              {!messagesLoading && filteredMessages.length === 0 && (
                <div className="p-8 text-center space-y-3">
                  <div className="size-10 rounded-full bg-canvas/60 border border-border-subtle mx-auto flex items-center justify-center text-text-dim">
                    <SendHorizontal className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">No sent emails found</p>
                    <p className="text-xs text-text-dim max-w-xs mx-auto">
                      {searchQuery
                        ? "No emails matched your search query. Try clearing the filter."
                        : "All emails sent through CRM campaigns, sequences, or Zoho will appear here."}
                    </p>
                  </div>
                  {!searchQuery && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsComposeOpen(true)}
                      className="text-xs gap-1.5"
                    >
                      <PenSquare className="size-3" /> Compose your first email
                    </Button>
                  )}
                </div>
              )}

              {filteredMessages.map((message) => {
                const isSelected = selected?.id === message.id;
                const dateStr = new Date(message.occurredAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });
                const timeStr = new Date(message.occurredAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => setSelectedId(message.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-canvas/40 transition-colors relative group ${
                      isSelected ? "bg-canvas/70 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] text-text-dim mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <ArrowUpRight className="size-3 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate">
                          To: {message.toAddresses.join(", ") || "(No recipient)"}
                        </span>
                      </div>
                      <span className="shrink-0 text-text-dim/80">{dateStr} {timeStr}</span>
                    </div>

                    <p className="text-xs font-medium text-foreground truncate">
                      {message.subject || "(no subject)"}
                    </p>

                    <p className="text-[11px] text-text-dim truncate mt-0.5">
                      {message.bodyPreview || "(no preview available)"}
                    </p>

                    {message.contact && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-dim bg-canvas/50 px-1.5 py-0.5 rounded w-fit border border-border-subtle">
                        <User className="size-2.5 text-primary" />
                        <span>
                          {message.contact.firstName} {message.contact.lastName}
                        </span>
                        {message.contact.company?.name && (
                          <span className="text-text-dim/70">· {message.contact.company.name}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Sent Email Reader */}
          <div className="bg-panel border border-border-subtle rounded-xl p-6 shadow-sm min-h-[500px] flex flex-col">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-text-dim space-y-2">
                <SendHorizontal className="size-10 text-text-dim/40" />
                <p className="text-sm font-medium">Select a sent message to inspect its contents</p>
                <p className="text-xs text-text-dim max-w-sm">
                  Click on any email in the list to view recipient addresses, delivery timestamp,
                  attached CRM links, and full email body.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Email Subject & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border-subtle">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                      {selected.subject || "(no subject)"}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-text-dim">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" /> Dispatched via Zoho
                      </span>
                      <span>·</span>
                      <span>{new Date(selected.occurredAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selected.toAddresses.join(", "), "Recipients")}
                      className="text-xs gap-1.5 h-8 border-border-subtle text-text-dim hover:text-foreground"
                      title="Copy recipient address(es)"
                    >
                      <Copy className="size-3" />
                      <span>Copy To</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEmail(selected.id)}
                      disabled={deleteEmailMutation.isPending}
                      className="text-xs gap-1.5 h-8 border-border-subtle text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30"
                      title="Remove this sent email record"
                    >
                      {deleteEmailMutation.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                {/* Email Metadata Card */}
                <div className="bg-canvas/30 border border-border-subtle rounded-lg p-3.5 space-y-2 text-xs">
                  <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
                    <span className="text-text-dim font-medium">From:</span>
                    <span className="font-mono text-foreground font-medium">
                      {selected.fromAddress || connectedEmail}
                    </span>
                  </div>

                  <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
                    <span className="text-text-dim font-medium">To:</span>
                    <span className="font-mono text-foreground">
                      {selected.toAddresses.join(", ") || "(none)"}
                    </span>
                  </div>

                  {selected.ccAddresses && selected.ccAddresses.length > 0 && (
                    <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
                      <span className="text-text-dim font-medium">Cc:</span>
                      <span className="font-mono text-text-dim">
                        {selected.ccAddresses.join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Linked CRM Entities */}
                  {(selected.contact || selected.deal) && (
                    <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap gap-2 items-center">
                      <span className="text-text-dim text-[11px] font-medium">CRM Link:</span>
                      {selected.contact && (
                        <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[11px] font-medium">
                          <User className="size-3" />
                          <span>
                            {selected.contact.firstName} {selected.contact.lastName}
                          </span>
                          {selected.contact.company?.name && (
                            <span className="opacity-75">({selected.contact.company.name})</span>
                          )}
                        </div>
                      )}
                      {selected.deal && (
                        <div className="inline-flex items-center gap-1.5 bg-canvas/60 text-foreground border border-border-subtle px-2 py-0.5 rounded text-[11px] font-medium">
                          <Briefcase className="size-3 text-cyan-400" />
                          <span>{selected.deal.title}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Email Body Content */}
                <div className="pt-2">
                  {selected.bodyHtml ? (
                    <div className="border border-border-subtle rounded-xl bg-white overflow-hidden shadow-inner">
                      <iframe
                        title={selected.subject || "Email body preview"}
                        srcDoc={selected.bodyHtml}
                        className="w-full min-h-[460px] border-0"
                        sandbox="allow-same-origin allow-popups"
                      />
                    </div>
                  ) : (
                    <div className="bg-canvas/20 border border-border-subtle rounded-xl p-5 min-h-[250px]">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground font-sans">
                        {selected.bodyPreview || "(No text content)"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose Direct Email Modal */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-xl bg-panel border-border-subtle text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <PenSquare className="size-4 text-primary" />
              Compose Email via Integrated Zoho Mail
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSendDirect} className="space-y-4 pt-2">
            {/* Sender notice */}
            <div className="bg-canvas/40 border border-border-subtle rounded-lg px-3 py-2 text-xs flex items-center justify-between text-text-dim">
              <span>Sending from:</span>
              <span className="font-semibold text-foreground font-mono">
                {connectedEmail}
              </span>
            </div>

            {/* Recipient To */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="sent-to" className="text-xs font-semibold text-foreground">
                  To <span className="text-rose-400">*</span>
                </label>
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + Add Cc
                  </button>
                )}
              </div>
              <input
                id="sent-to"
                type="text"
                placeholder="recipient@example.com (comma-separate multiple)"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                disabled={sendEmailMutation.isPending}
                className="w-full bg-canvas/40 border border-border-subtle rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-text-dim/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                required
              />
            </div>

            {/* Recipient Cc */}
            {showCc && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="sent-cc" className="text-xs font-semibold text-foreground">
                    Cc
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCc(false);
                      setCcInput("");
                    }}
                    disabled={sendEmailMutation.isPending}
                    className="text-[11px] text-text-dim hover:text-foreground disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
                <input
                  id="sent-cc"
                  type="text"
                  placeholder="cc@example.com"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  disabled={sendEmailMutation.isPending}
                  className="w-full bg-canvas/40 border border-border-subtle rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-text-dim/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                />
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1.5">
              <label htmlFor="sent-subject" className="text-xs font-semibold text-foreground">
                Subject <span className="text-rose-400">*</span>
              </label>
              <input
                id="sent-subject"
                type="text"
                placeholder="Email subject..."
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                disabled={sendEmailMutation.isPending}
                className="w-full bg-canvas/40 border border-border-subtle rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-text-dim/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                required
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label htmlFor="sent-body" className="text-xs font-semibold text-foreground">
                Message Body <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="sent-body"
                rows={7}
                placeholder="Write your email here..."
                value={bodyInput}
                onChange={(e) => setBodyInput(e.target.value)}
                disabled={sendEmailMutation.isPending}
                className="w-full bg-canvas/40 border border-border-subtle rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-text-dim/60 focus:outline-none focus:ring-1 focus:ring-primary resize-y font-sans leading-relaxed disabled:opacity-60"
                required
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsComposeOpen(false)}
                className="text-xs border-border-subtle"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={sendEmailMutation.isPending}
                className="text-xs gap-1.5"
              >
                {sendEmailMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Sending via Zoho…
                  </>
                ) : (
                  <>
                    <SendHorizontal className="size-3.5" /> Send Email
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
