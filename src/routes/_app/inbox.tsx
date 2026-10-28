import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Mail, ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useEmailConnectionStatus } from "@/hooks/use-email-connections";
import {
  useSyncedEmails,
  useMarkSyncedEmailRead,
  useSyncEmails,
} from "@/hooks/use-synced-emails";
import type { SyncedEmail } from "@/lib/api/types";

const CONNECTION_TYPE_LABEL: Record<string, string> = {
  SMTP: "Zoho / IMAP",
  OAUTH_GOOGLE: "Google",
  OAUTH_MICROSOFT: "Microsoft",
  OAUTH_ZOHO: "Zoho",
};

export const Route = createFileRoute("/_app/inbox")({
  component: InboxPage,
});

function InboxPage() {
  useDepartmentGuard("Sales");

  const { data: status, isLoading: statusLoading } = useEmailConnectionStatus();
  const { data: messages, isLoading: messagesLoading } = useSyncedEmails();
  const markRead = useMarkSyncedEmailRead();
  const syncEmails = useSyncEmails();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => messages?.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId],
  );

  function openMessage(message: SyncedEmail) {
    setSelectedId(message.id);
    if (!message.isRead) {
      markRead.mutate(message.id);
    }
  }

  const isConnected = !!status?.connected;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-text-dim" />
        <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
      </div>

      {!statusLoading && !isConnected && (
        <div className="bg-panel border border-border-subtle rounded-xl p-6 text-sm text-text-dim">
          Connect your mailbox with Zoho, Google, or Outlook from{" "}
          <a href="/account" className="text-primary hover:underline">
            My Account
          </a>{" "}
          to see your sent and received mail here.
        </div>
      )}

      {isConnected && (
        <div className="grid md:grid-cols-[340px_1fr] gap-4 items-start">
          <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden md:sticky md:top-4 self-start max-h-[calc(100vh-6rem)] flex flex-col shadow-sm">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between shrink-0 bg-panel z-10">
              <p className="text-xs font-medium text-text-dim truncate mr-2">
                {status?.connectionType ? CONNECTION_TYPE_LABEL[status.connectionType] ?? "Connected" : ""} ·{" "}
                {status?.providerAccountEmail || status?.fromEmail || status?.smtpUsername}
              </p>
              <button
                type="button"
                onClick={() => syncEmails.mutate()}
                disabled={syncEmails.isPending}
                className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-foreground font-medium px-2 py-1 rounded border border-border-subtle hover:bg-canvas/50 transition-colors shrink-0"
                title="Sync emails from server"
              >
                <RefreshCw className={`size-3 ${syncEmails.isPending ? "animate-spin" : ""}`} />
                {syncEmails.isPending ? "Syncing…" : "Sync"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y border-border-subtle min-h-0">
              {messagesLoading && (
                <div className="flex items-center gap-2 text-sm text-text-dim p-4">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              )}
              {!messagesLoading && (messages ?? []).length === 0 && (
                <div className="p-6 text-center space-y-3">
                  <p className="text-sm text-text-dim">
                    No emails synced yet -- mail syncs automatically every 5 minutes.
                  </p>
                  <button
                    type="button"
                    onClick={() => syncEmails.mutate()}
                    disabled={syncEmails.isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle bg-canvas/40 hover:bg-canvas/70 text-text-dim hover:text-foreground transition-colors"
                  >
                    <RefreshCw className={`size-3.5 ${syncEmails.isPending ? "animate-spin" : ""}`} />
                    {syncEmails.isPending ? "Syncing mailbox…" : "Fetch emails now"}
                  </button>
                </div>
              )}
              {(messages ?? []).map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => openMessage(message)}
                  className={`w-full text-left px-4 py-3 hover:bg-canvas/50 transition-colors ${
                    selectedId === message.id ? "bg-canvas/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-text-dim mb-0.5">
                    {message.direction === "SENT" ? (
                      <ArrowUpRight className="size-3 text-primary" />
                    ) : (
                      <ArrowDownLeft className="size-3 text-cyan-400" />
                    )}
                    {new Date(message.occurredAt).toLocaleString()}
                  </div>
                  <p
                    className={`text-xs truncate ${message.isRead ? "text-text-dim" : "font-semibold"}`}
                  >
                    {message.direction === "SENT"
                      ? message.toAddresses.join(", ")
                      : message.fromAddress}
                  </p>
                  <p className="text-xs truncate mt-0.5">{message.subject || "(no subject)"}</p>
                  <p className="text-[11px] text-text-dim truncate">{message.bodyPreview}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-panel border border-border-subtle rounded-xl p-6">
            {!selected ? (
              <p className="text-sm text-text-dim">Select a message to read it.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">{selected.subject || "(no subject)"}</h2>
                  <p className="text-xs text-text-dim mt-1">
                    {selected.direction === "SENT" ? "To" : "From"}:{" "}
                    {selected.direction === "SENT"
                      ? selected.toAddresses.join(", ")
                      : selected.fromAddress}
                  </p>
                  {selected.ccAddresses.length > 0 && (
                    <p className="text-xs text-text-dim">Cc: {selected.ccAddresses.join(", ")}</p>
                  )}
                  <p className="text-xs text-text-dim">
                    {new Date(selected.occurredAt).toLocaleString()}
                  </p>
                </div>
                {selected.bodyHtml ? (
                  <div className="border border-border-subtle rounded-lg bg-white overflow-hidden p-3 mt-3">
                    <iframe
                      title={selected.subject || "Email message"}
                      srcDoc={selected.bodyHtml}
                      className="w-full min-h-[450px] border-0"
                      sandbox="allow-same-origin allow-popups"
                    />
                  </div>
                ) : (
                  <div className="pt-2">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                      {selected.bodyPreview}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
