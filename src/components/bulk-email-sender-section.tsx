import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Star,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  useConnectEmail,
  useConnectGoogle,
  useConnectMicrosoft,
  useConnectZoho,
  useDisconnectEmail,
  useEmailConnectionStatus,
  useNetworkDiagnostic,
  useOAuthProviderAvailability,
  useSetDefaultEmailConnection,
  useTestEmailConnection,
} from "@/hooks/use-email-connections";
import { ApiError, isApiError } from "@/lib/api/client";
import type { EmailAccountSummary } from "@/lib/api/types";

const CONNECTION_TYPE_LABEL: Record<string, string> = {
  SMTP: "SMTP",
  OAUTH_GOOGLE: "Google",
  OAUTH_MICROSOFT: "Microsoft",
  OAUTH_ZOHO: "Zoho",
};

// Common providers' SMTP settings, so connecting isn't a "go look it up
// yourself" exercise for the two accounts almost everyone actually has.
// "Custom" clears the preset for anything else (a company mail server,
// Zoho, etc.).
const PROVIDER_PRESETS = [
  { label: "Gmail", host: "smtp.gmail.com", port: 465, secure: true },
  { label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, secure: false },
  { label: "Zoho India (.in)", host: "smtp.zoho.in", port: 465, secure: true },
  { label: "Zoho Global (.com)", host: "smtp.zoho.com", port: 465, secure: true },
  { label: "Yahoo", host: "smtp.mail.yahoo.com", port: 465, secure: true },
] as const;

function StatusBadge({ connected, verified }: { connected: boolean; verified: boolean }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-canvas/50 text-text-dim border-border-subtle">
        <XCircle className="size-3.5" />
        Not connected
      </span>
    );
  }
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-success/15 text-success border-success/20 font-medium">
        <CheckCircle2 className="size-3.5" />
        Connected &amp; verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-destructive/15 text-destructive border-destructive/20 font-medium">
      <AlertCircle className="size-3.5" />
      Connection error
    </span>
  );
}

export function BulkEmailSenderSection() {
  const { data: status, isLoading } = useEmailConnectionStatus();
  const { data: oauthAvailability } = useOAuthProviderAvailability();
  const connectEmail = useConnectEmail();
  const testConnection = useTestEmailConnection();
  const disconnectEmail = useDisconnectEmail();
  const setDefaultConnection = useSetDefaultEmailConnection();
  const networkDiagnostic = useNetworkDiagnostic();
  const connectGoogle = useConnectGoogle();
  const connectMicrosoft = useConnectMicrosoft();
  const connectZoho = useConnectZoho();

  const [editing, setEditing] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const connections: EmailAccountSummary[] =
    status?.connections && status.connections.length > 0
      ? status.connections
      : status?.connected
        ? [
            {
              id: status.activeConnectionId || "primary",
              connectionType: status.connectionType || "SMTP",
              smtpHost: status.smtpHost,
              smtpPort: status.smtpPort,
              smtpSecure: status.smtpSecure,
              smtpUsername: status.smtpUsername,
              providerAccountEmail: status.providerAccountEmail,
              fromName: status.fromName,
              fromEmail: status.fromEmail,
              verified: status.verified,
              lastVerifiedAt: status.lastVerifiedAt,
              lastError: status.lastError,
              isDefault: true,
              label: null,
            },
          ]
        : [];

  const hasConnections = connections.length > 0;
  const activeConnection = connections.find((c) => c.isDefault) ?? connections[0];

  function applyPreset(preset: (typeof PROVIDER_PRESETS)[number]) {
    setSmtpHost(preset.host);
    setSmtpPort(String(preset.port));
    setSmtpSecure(preset.secure);
  }

  function openForm(conn?: EmailAccountSummary) {
    setError(null);
    setTestSuccess(null);
    if (conn) {
      setEditingConnectionId(conn.id);
      setSmtpHost(conn.smtpHost ?? "");
      setSmtpPort(conn.smtpPort ? String(conn.smtpPort) : "465");
      setSmtpSecure(conn.smtpSecure ?? true);
      setSmtpUsername(conn.smtpUsername ?? "");
      setSmtpPassword("");
      setFromName(conn.fromName ?? "");
      setFromEmail(conn.fromEmail ?? "");
    } else {
      setEditingConnectionId(null);
      setSmtpHost("");
      setSmtpPort("465");
      setSmtpSecure(true);
      setSmtpUsername("");
      setSmtpPassword("");
      setFromName("");
      setFromEmail("");
    }
    setShowAddPanel(false);
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setTestSuccess(null);
    try {
      await connectEmail.mutateAsync({
        connectionId: editingConnectionId || undefined,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort),
        smtpSecure,
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword || undefined,
        fromName: fromName.trim() || undefined,
        fromEmail: fromEmail.trim(),
        setAsDefault: editingConnectionId ? undefined : true,
      });
      setEditing(false);
      setEditingConnectionId(null);
    } catch (err) {
      setError(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Could not connect that email account",
      );
    }
  }

  async function handleTest(connectionId?: string) {
    setError(null);
    setTestSuccess(null);
    setTestingId(connectionId || null);
    try {
      const res = await testConnection.mutateAsync(connectionId);
      if (res.verified) {
        setTestSuccess("Connection verified! Outbound mail server responded successfully.");
      } else {
        setError(res.lastError || "Could not verify connection");
      }
    } catch (err) {
      setError(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Could not test the connection",
      );
    } finally {
      setTestingId(null);
    }
  }

  async function handleSetDefault(connectionId: string) {
    setError(null);
    try {
      await setDefaultConnection.mutateAsync(connectionId);
    } catch (err) {
      setError(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Could not change the active sender",
      );
    }
  }

  async function handleDisconnect(conn: EmailAccountSummary) {
    const name = conn.fromName || conn.providerAccountEmail || conn.fromEmail || "this";
    if (
      !confirm(
        `Disconnect ${name} account? Bulk campaigns and sequences will stop sending from this address.`,
      )
    ) {
      return;
    }
    await disconnectEmail.mutateAsync(conn.id);
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-text-dim" />
          <h2 className="text-sm font-semibold">Bulk Email Sender</h2>
          {hasConnections && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              {connections.length} {connections.length === 1 ? "Mailbox" : "Mailboxes"} Connected
            </span>
          )}
        </div>
        {!isLoading && (
          <StatusBadge
            connected={hasConnections}
            verified={activeConnection?.verified ?? false}
          />
        )}
      </div>
      <p className="text-xs text-text-dim -mt-2">
        Connect your mail accounts to send bulk email campaigns and sequences. Add multiple accounts to switch between personal, sales, or company mailboxes from one single panel.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-dim py-4">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {/* Connected Accounts List */}
      {!isLoading && !editing && hasConnections && (
        <div className="space-y-3">
          <div className="space-y-3">
            {connections.map((conn) => {
              const isConnDefault = conn.isDefault || conn.id === activeConnection?.id;
              return (
                <div
                  key={conn.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isConnDefault
                      ? "bg-canvas/40 border-primary/40 shadow-xs ring-1 ring-primary/20"
                      : "bg-canvas/20 border-border-subtle hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-md font-medium border bg-panel border-border-subtle text-foreground">
                        <Mail className="size-3 text-primary" />
                        {CONNECTION_TYPE_LABEL[conn.connectionType] || conn.connectionType}
                      </span>
                      {isConnDefault ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-semibold">
                          <CheckCircle2 className="size-3" />
                          Active Sender (Default)
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs h-6 px-2 text-text-dim hover:text-foreground gap-1"
                          onClick={() => handleSetDefault(conn.id)}
                          disabled={setDefaultConnection.isPending}
                        >
                          <CheckCircle2 className="size-3" />
                          Set as Active
                        </Button>
                      )}
                    </div>

                    <StatusBadge connected={true} verified={conn.verified} />
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs bg-panel/60 border border-border-subtle/80 rounded-lg p-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-text-dim">From</p>
                      <p className="font-medium truncate" title={conn.fromEmail ?? undefined}>
                        {conn.fromName ? `${conn.fromName} <${conn.fromEmail}>` : conn.fromEmail || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-text-dim">
                        {conn.connectionType === "SMTP" ? "SMTP Server" : "Connected Via"}
                      </p>
                      <p className="truncate text-text-dim" title={conn.smtpHost ? `${conn.smtpHost}:${conn.smtpPort}` : undefined}>
                        {conn.connectionType === "SMTP"
                          ? `${conn.smtpHost}:${conn.smtpPort} ${conn.smtpSecure ? "(TLS)" : "(STARTTLS)"}`
                          : conn.connectionType === "OAUTH_GOOGLE"
                            ? "Google Mailbox"
                            : conn.connectionType === "OAUTH_ZOHO"
                              ? "Zoho Web API"
                              : "Microsoft 365"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-text-dim">Account / Mailbox</p>
                      <p className="truncate text-text-dim" title={conn.smtpUsername || conn.providerAccountEmail || undefined}>
                        {conn.smtpUsername || conn.providerAccountEmail || conn.fromEmail || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-text-dim">Last Verified</p>
                      <p className="truncate text-text-dim">
                        {conn.lastVerifiedAt ? new Date(conn.lastVerifiedAt).toLocaleString() : "Never"}
                      </p>
                    </div>
                  </div>

                  {!conn.verified && conn.lastError && (
                    <p className="text-xs text-destructive mt-2">{conn.lastError}</p>
                  )}

                  {conn.connectionType !== "SMTP" && (
                    <p className="text-[11px] text-text-dim mt-2">
                      Sent and received mail from this mailbox syncs automatically into the CRM{" "}
                      <a href="/inbox" className="text-primary hover:underline">
                        Inbox
                      </a>
                      .
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-3">
                    <div className="flex items-center gap-2">
                      {conn.connectionType === "SMTP" && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleTest(conn.id)}
                            disabled={testConnection.isPending && testingId === conn.id}
                            className="gap-1.5 text-xs h-7"
                          >
                            {testConnection.isPending && testingId === conn.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3" />
                            )}
                            Test connection
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openForm(conn)}
                            className="gap-1.5 text-xs h-7"
                          >
                            <Pencil className="size-3" />
                            Edit
                          </Button>
                        </>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive gap-1 text-xs h-7 ml-auto"
                      onClick={() => handleDisconnect(conn)}
                      disabled={disconnectEmail.isPending}
                    >
                      <Trash2 className="size-3" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {testSuccess && (
            <p className="text-xs text-success flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              {testSuccess}
            </p>
          )}

          {!showAddPanel && (
            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddPanel(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="size-3.5" />
                Connect Another Mailbox
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add / Connect Panel (Shown when no accounts connected OR when user clicks "Connect Another Mailbox") */}
      {!isLoading && !editing && (!hasConnections || showAddPanel) && (
        <div className="space-y-3 border border-border-subtle/80 bg-canvas/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
              {hasConnections ? "Connect Additional Mailbox" : "Connect Mailbox"}
            </h3>
            {hasConnections && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddPanel(false)}
                className="text-xs h-6 px-2 text-text-dim hover:text-foreground"
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Button
              type="button"
              variant="outline"
              className="gap-2 justify-center"
              disabled={!oauthAvailability?.google || connectGoogle.isPending}
              onClick={() => connectGoogle.mutate()}
              title={
                oauthAvailability && !oauthAvailability.google
                  ? "Google connect isn't configured on this server yet"
                  : undefined
              }
            >
              {connectGoogle.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Connect with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 justify-center"
              disabled={!oauthAvailability?.microsoft || connectMicrosoft.isPending}
              onClick={() => connectMicrosoft.mutate()}
              title={
                oauthAvailability && !oauthAvailability.microsoft
                  ? "Microsoft connect isn't configured on this server yet"
                  : undefined
              }
            >
              {connectMicrosoft.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Connect with Outlook
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 justify-center"
              disabled={!oauthAvailability?.zoho || connectZoho.isPending}
              onClick={() => connectZoho.mutate()}
              title={
                oauthAvailability && !oauthAvailability.zoho
                  ? "Zoho connect isn't configured on this server yet"
                  : undefined
              }
            >
              {connectZoho.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Connect with Zoho
            </Button>
          </div>

          {oauthAvailability && (!oauthAvailability.google || !oauthAvailability.microsoft) && (
            <p className="text-[11px] text-amber-600">
              {!oauthAvailability.google && !oauthAvailability.microsoft
                ? "Google and Outlook connect aren't set up on this server yet"
                : !oauthAvailability.google
                  ? "Google connect isn't set up on this server yet"
                  : "Outlook connect isn't set up on this server yet"}{" "}
              -- an admin needs to add the OAuth app credentials. Until then, use Connect via SMTP below.
            </p>
          )}
          <p className="text-[11px] text-text-dim">
            Google and Outlook are recommended -- they also sync sent and received mail into the
            CRM, not just outbound sending. Zoho sends over its web API (so it works where SMTP is
            blocked) but is sending only. Nothing else to set up beyond signing in.
          </p>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-[10px] uppercase tracking-wide text-text-dim">or</span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <div className="flex items-center justify-between gap-3 bg-canvas/40 border border-border-subtle rounded-lg p-3">
            <p className="text-xs text-text-dim">
              Connect via custom SMTP or App Password (Zoho SMTP, Gmail App Password, Outlook, etc.).
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openForm()}
              className="gap-1.5 shrink-0 text-xs"
            >
              <Send className="size-3.5" />
              Connect via SMTP
            </Button>
          </div>
        </div>
      )}

      {/* SMTP Edit / Add Form */}
      {editing && (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {editingConnectionId ? "Edit SMTP Connection" : "Connect Email via SMTP"}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setEditingConnectionId(null);
              }}
              className="text-xs h-6 px-2 text-text-dim"
            >
              Cancel
            </Button>
          </div>
          <ConnectHelp />
          <div className="flex flex-wrap gap-1.5">
            {PROVIDER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-[11px] px-2 py-1 rounded-full border border-border-subtle bg-canvas/40 hover:bg-canvas/70 text-text-dim hover:text-foreground transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-host">SMTP host</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5">
            <div>
              <Label htmlFor="smtp-secure" className="text-sm">
                Use TLS
              </Label>
              <p className="text-[11px] text-text-dim">On for port 465, off for 587/STARTTLS.</p>
            </div>
            <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp-username">Username</Label>
            <Input
              id="smtp-username"
              value={smtpUsername}
              onChange={(e) => setSmtpUsername(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-password">Password</Label>
            <Input
              id="smtp-password"
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder={editingConnectionId ? "Leave blank to keep current password" : undefined}
              required={!editingConnectionId}
            />
            <p className="text-[11px] text-text-dim">
              Gmail and Outlook require an app password, not your normal login password, when 2-step
              verification is on.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-from-name">From name (optional)</Label>
              <Input
                id="smtp-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-from-email">From email</Label>
              <Input
                id="smtp-from-email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {error && <NetworkDiagnosticPanel diagnostic={networkDiagnostic} />}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={connectEmail.isPending} className="gap-1.5">
              {connectEmail.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {connectEmail.isPending ? "Verifying…" : editingConnectionId ? "Save & verify" : "Connect & verify"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setEditingConnectionId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Surfaces the raw-TCP diagnostic (see email-connections.controller.ts's
// network-diagnostic endpoint) right next to a Connect/Test failure --
// distinguishes "this server can't reach any mail provider" (a network-level
// block on this host) from "it can reach others fine, just not this one"
// (more likely an account-level block on the provider's side, e.g. an
// unrecognized-IP sign-in block) without needing a developer involved.
function NetworkDiagnosticPanel({
  diagnostic,
}: {
  diagnostic: ReturnType<typeof useNetworkDiagnostic>;
}) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => diagnostic.mutate()}
        disabled={diagnostic.isPending}
        className="gap-1.5"
      >
        {diagnostic.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Wifi className="size-3.5" />
        )}
        Test server network
      </Button>
      {diagnostic.data && (
        <div className="text-xs bg-canvas/30 border border-border-subtle rounded-lg p-3 space-y-1">
          {diagnostic.data.map((r) => (
            <div key={`${r.host}:${r.port}`} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {r.ok ? (
                  <CheckCircle2 className="size-3 text-success shrink-0" />
                ) : (
                  <XCircle className="size-3 text-destructive shrink-0" />
                )}
                {r.label}
              </span>
              <span className="text-text-dim">{r.ok ? `${r.ms}ms` : (r.error ?? "failed")}</span>
            </div>
          ))}
          <p className="text-[11px] text-text-dim pt-1">
            If Zoho fails here but Gmail/Outlook succeed, this server can reach the internet fine --
            it's most likely Zoho blocking this specific connection (check its blocked-sign-in /
            security-alert settings). If everything fails, this server's own outbound network is
            blocked.
          </p>
        </div>
      )}
    </div>
  );
}

// Plain-language walkthroughs for the two accounts almost everyone actually
// has. The password these steps produce is a one-time generated code, not
// the person's real inbox password -- worth spelling out since typing your
// normal password is the instinctive (and wrong) first try.
function ConnectHelp() {
  return (
    <div className="border border-border-subtle rounded-lg bg-canvas/20 px-4">
      <Accordion type="single" collapsible>
        <AccordionItem value="help" className="border-b-0">
          <AccordionTrigger className="text-xs font-medium hover:no-underline py-3">
            <span className="flex items-center gap-1.5 text-text-dim">
              <HelpCircle className="size-3.5" />
              Not sure how to connect your email? Start here.
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-text-dim mb-3">
              You'll need a special{" "}
              <span className="font-medium text-foreground">app password</span> -- a one-time code
              your email provider generates just for this, separate from the password you normally
              sign in with. Your regular password won't work here and Google/Microsoft will reject
              it.
            </p>
            <Accordion type="single" collapsible className="space-y-2">
              <AccordionItem value="gmail" className="border border-border-subtle rounded-lg px-3">
                <AccordionTrigger className="text-xs py-2.5 hover:no-underline">
                  Gmail
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-text-dim">
                    <li>
                      Go to{" "}
                      <span className="font-medium text-foreground">myaccount.google.com</span> and
                      sign in.
                    </li>
                    <li>
                      Click <span className="font-medium text-foreground">Security</span> on the
                      left.
                    </li>
                    <li>
                      Under "How you sign in to Google", turn on{" "}
                      <span className="font-medium text-foreground">2-Step Verification</span> if it
                      isn't on already (Google won't let you make an app password without it).
                    </li>
                    <li>
                      Go back to <span className="font-medium text-foreground">Security</span>, open{" "}
                      <span className="font-medium text-foreground">2-Step Verification</span>{" "}
                      again, and scroll down to{" "}
                      <span className="font-medium text-foreground">App passwords</span>.
                    </li>
                    <li>
                      Type a name like "Venus CRM" and click{" "}
                      <span className="font-medium text-foreground">Create</span>.
                    </li>
                    <li>Google shows you a 16-letter code in a yellow box. Copy it.</li>
                    <li>
                      Back here: <span className="font-medium text-foreground">Username</span> is
                      your full Gmail address,{" "}
                      <span className="font-medium text-foreground">Password</span> is that code you
                      just copied.
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="outlook"
                className="border border-border-subtle rounded-lg px-3"
              >
                <AccordionTrigger className="text-xs py-2.5 hover:no-underline">
                  Outlook / Microsoft 365
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-text-dim">
                    <li>
                      Go to{" "}
                      <span className="font-medium text-foreground">account.microsoft.com</span> and
                      sign in.
                    </li>
                    <li>
                      Click <span className="font-medium text-foreground">Security</span> at the
                      top.
                    </li>
                    <li>
                      Make sure{" "}
                      <span className="font-medium text-foreground">Two-step verification</span> is
                      turned on.
                    </li>
                    <li>
                      Click{" "}
                      <span className="font-medium text-foreground">Advanced security options</span>
                      .
                    </li>
                    <li>
                      Under <span className="font-medium text-foreground">App passwords</span>,
                      click{" "}
                      <span className="font-medium text-foreground">Create a new app password</span>
                      .
                    </li>
                    <li>Microsoft shows you a generated password. Copy it.</li>
                    <li>
                      Back here: <span className="font-medium text-foreground">Username</span> is
                      your full Outlook/Microsoft email address,{" "}
                      <span className="font-medium text-foreground">Password</span> is that code you
                      just copied.
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="other" className="border border-border-subtle rounded-lg px-3">
                <AccordionTrigger className="text-xs py-2.5 hover:no-underline">
                  Using a different email provider (company email, Zoho, etc.)
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-text-dim">
                    Ask whoever set up your email (IT, or the provider's support site) for your{" "}
                    <span className="font-medium text-foreground">
                      SMTP server address and port
                    </span>{" "}
                    and whether an app password is required. If your regular password works, you can
                    use that instead -- just leave the SMTP host/port fields matching what they gave
                    you.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
