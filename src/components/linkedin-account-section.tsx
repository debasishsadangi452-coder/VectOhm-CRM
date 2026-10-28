import { useState } from "react";
import {
  ExternalLink,
  Linkedin,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Sliders,
  Unlink,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  PenLine,
  Send,
  UserPlus,
  Clock,
  Check,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useConnectLinkedIn,
  useDisconnectLinkedIn,
  useLinkedInActions,
  useLinkedInStatus,
  useSendLinkedInInvite,
  useSendLinkedInMessage,
  useTestLinkedInConnection,
  useUpdateLinkedInLimits,
} from "@/hooks/use-linkedin";
import { toast } from "sonner";

function ensureExternalUrl(url?: string | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function LinkedInAccountSection() {
  const { data: statusData, isLoading, refetch, isRefetching } = useLinkedInStatus();
  const { data: actionsData, isLoading: actionsLoading } = useLinkedInActions(10);
  const connectMutation = useConnectLinkedIn();
  const testMutation = useTestLinkedInConnection();
  const disconnectMutation = useDisconnectLinkedIn();
  const updateLimitsMutation = useUpdateLinkedInLimits();
  const sendInviteMutation = useSendLinkedInInvite();
  const sendMessageMutation = useSendLinkedInMessage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [testActionDialogOpen, setTestActionDialogOpen] = useState(false);

  // Connection form state
  const [accountEmail, setAccountEmail] = useState("");
  const [accountName, setAccountName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [dailyInviteLimit, setDailyInviteLimit] = useState(20);
  const [dailyMessageLimit, setDailyMessageLimit] = useState(50);

  // Edit limits state
  const [editInviteLimit, setEditInviteLimit] = useState(20);
  const [editMessageLimit, setEditMessageLimit] = useState(50);

  // Quick outreach test state
  const [testActionType, setTestActionType] = useState<"INVITE" | "MESSAGE">("INVITE");
  const [testTargetUrl, setTestTargetUrl] = useState("");
  const [testMessage, setTestMessage] = useState("");

  const connected = statusData?.connected && statusData.connection;
  const connection = statusData?.connection;

  const handleOpenConnect = () => {
    setAccountEmail("");
    setAccountName("");
    setProfileUrl("");
    setAccessToken("");
    setDailyInviteLimit(20);
    setDailyMessageLimit(50);
    setDialogOpen(true);
  };

  const handleOpenEdit = () => {
    if (connection) {
      setAccountEmail(connection.accountEmail);
      setAccountName(connection.accountName || "");
      setProfileUrl(connection.profileUrl || "");
      setAccessToken("");
      setDailyInviteLimit(connection.dailyInviteLimit);
      setDailyMessageLimit(connection.dailyMessageLimit);
      setDialogOpen(true);
    }
  };

  const handleTestConnection = async () => {
    try {
      const res = await testMutation.mutateAsync();
      if (res.success) {
        toast.success(res.message || "LinkedIn connection is active and verified!");
      } else {
        toast.error(res.message || "Connection returned a warning.");
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to test LinkedIn connection.");
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountEmail.trim()) {
      toast.error("Please enter your LinkedIn account email.");
      return;
    }

    try {
      await connectMutation.mutateAsync({
        accountEmail: accountEmail.trim(),
        accountName: accountName.trim() || undefined,
        profileUrl: profileUrl.trim() || undefined,
        accessToken: accessToken.trim() || undefined,
        dailyInviteLimit: Number(dailyInviteLimit) || 20,
        dailyMessageLimit: Number(dailyMessageLimit) || 50,
      });
      toast.success("LinkedIn account connected successfully!");
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to connect LinkedIn account.");
    }
  };

  const handleOpenLimits = () => {
    if (connection) {
      setEditInviteLimit(connection.dailyInviteLimit);
      setEditMessageLimit(connection.dailyMessageLimit);
      setLimitsDialogOpen(true);
    }
  };

  const handleUpdateLimitsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateLimitsMutation.mutateAsync({
        dailyInviteLimit: Number(editInviteLimit),
        dailyMessageLimit: Number(editMessageLimit),
      });
      toast.success("Daily safety limits updated.");
      setLimitsDialogOpen(false);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to update limits.");
    }
  };

  const handleDisconnect = async () => {
    if (confirm("Are you sure you want to disconnect your LinkedIn account? Scheduled sequences will pause.")) {
      try {
        await disconnectMutation.mutateAsync();
        toast.success("LinkedIn account disconnected.");
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to disconnect account.");
      }
    }
  };

  const handleExecuteQuickTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTargetUrl.trim()) {
      toast.error("Please enter a LinkedIn profile URL or vanity username.");
      return;
    }

    try {
      if (testActionType === "INVITE") {
        const res = await sendInviteMutation.mutateAsync({
          targetUrl: testTargetUrl.trim(),
          message: testMessage.trim() || undefined,
        });
        toast.success(res.message);
      } else {
        if (!testMessage.trim()) {
          toast.error("Please enter a message to send.");
          return;
        }
        const res = await sendMessageMutation.mutateAsync({
          targetUrl: testTargetUrl.trim(),
          message: testMessage.trim(),
        });
        toast.success(res.message);
      }
      setTestActionDialogOpen(false);
      setTestTargetUrl("");
      setTestMessage("");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Action failed.");
    }
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-panel p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[#0077b5]/10 border border-[#0077b5]/20 flex items-center justify-center text-[#0077b5] shrink-0">
            <Linkedin className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">LinkedIn Automation Engine</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Zap className="size-2.5 text-blue-400" /> Unipile Powered
              </span>
            </div>
            <p className="text-xs text-text-dim">
              Automated candidate sourcing, 1-click connection invitations, outreach messaging, and unified CRM sync.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="text-xs text-text-dim hover:text-foreground h-8"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-text-dim">
          <Loader2 className="size-4 animate-spin mr-2" /> Loading connection status…
        </div>
      ) : connected && connection ? (
        <div className="space-y-4">
          {/* Connected Profile Card */}
          <div className="rounded-lg border border-border-subtle bg-canvas/40 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                {connection.profilePicUrl ? (
                  <img
                    src={connection.profilePicUrl}
                    alt={connection.accountName || connection.accountEmail}
                    className="size-12 rounded-full object-cover border border-border-subtle"
                  />
                ) : (
                  <div className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                    {(connection.accountName || connection.accountEmail).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#0077b5] flex items-center justify-center text-white border-2 border-panel">
                  <Linkedin className="size-2.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {connection.accountName || connection.accountEmail}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    <UserCheck className="size-3" /> Active & Verified
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-text-dim">
                  <span>{connection.accountEmail}</span>
                  {connection.profileUrl && (
                    <>
                      <span>·</span>
                      <a
                        href={ensureExternalUrl(connection.profileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Profile <ExternalLink className="size-2.5" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
              <Button
                variant="default"
                size="sm"
                onClick={() => setTestActionDialogOpen(true)}
                className="h-8 text-xs gap-1.5 bg-[#0077b5] hover:bg-[#006097] text-white"
              >
                <Send className="size-3" /> Quick Action Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testMutation.isPending}
                className="h-8 text-xs"
              >
                {testMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="size-3 mr-1.5 text-emerald-400" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenEdit}
                className="h-8 text-xs"
              >
                <PenLine className="size-3 mr-1.5" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenLimits}
                className="h-8 text-xs"
              >
                <Sliders className="size-3 mr-1.5" /> Safety Limits
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                ) : (
                  <Unlink className="size-3 mr-1.5" />
                )}
                Disconnect
              </Button>
            </div>
          </div>

          {/* Daily Safety Quotas & Usage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border-subtle bg-canvas/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-dim">Daily Connection Invites</span>
                <span className="font-semibold">
                  {connection.invitesSentToday} / {connection.dailyInviteLimit}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-border-subtle overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (connection.invitesSentToday / connection.dailyInviteLimit) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-text-dim">
                {connection.remainingInvitesToday} invites remaining today (resets at midnight).
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-dim">Daily Direct Messages</span>
                <span className="font-semibold">
                  {connection.messagesSentToday} / {connection.dailyMessageLimit}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-border-subtle overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (connection.messagesSentToday / connection.dailyMessageLimit) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-text-dim">
                {connection.remainingMessagesToday} messages remaining today.
              </p>
            </div>
          </div>

          {/* Recent Automated Actions Log */}
          {actionsData && actionsData.length > 0 && (
            <div className="rounded-lg border border-border-subtle bg-canvas/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-tight">Recent LinkedIn Actions</h3>
                <span className="text-[10px] text-text-dim">Live activity ledger</span>
              </div>
              <div className="space-y-2">
                {actionsData.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between text-xs rounded-md border border-border-subtle bg-panel/60 p-2.5"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {act.actionType === "CONNECTION_REQUEST" ? (
                        <UserPlus className="size-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <Send className="size-3.5 text-emerald-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-medium">
                          {act.actionType === "CONNECTION_REQUEST" ? "Invite Sent" : "Direct Message"}
                        </span>
                        <span className="text-text-dim ml-2 font-mono text-[11px] truncate">
                          {act.targetUrl}
                        </span>
                        {act.messageBody && (
                          <p className="text-[10px] text-text-muted truncate mt-0.5">
                            "{act.messageBody}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {act.status === "SENT" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 font-medium">
                          <Check className="size-2.5" /> Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-destructive/10 text-destructive text-[10px] px-1.5 py-0.5 font-medium">
                          <XCircle className="size-2.5" /> Failed
                        </span>
                      )}
                      <span className="text-[10px] text-text-dim flex items-center gap-1">
                        <Clock className="size-2.5" /> {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Disconnected State Callout */
        <div className="rounded-lg border border-dashed border-border-subtle bg-canvas/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-sm font-semibold">No LinkedIn Account Connected</h3>
            <p className="text-xs text-text-dim max-w-lg">
              Link your LinkedIn account to unlock automated connection requests in sales sequences,
              1-click candidate sourcing for Recruitment OS, and unified two-way messaging in your CRM Inbox.
            </p>
          </div>
          <Button onClick={handleOpenConnect} size="sm" className="shrink-0 h-9">
            <Plus className="size-4 mr-1.5" /> Connect Account
          </Button>
        </div>
      )}

      {/* Safety Notice */}
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 flex items-start gap-2.5">
        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-400" />
        <div className="space-y-0.5">
          <span className="font-semibold">Anti-Ban Protection Active</span>
          <p className="text-[11px] text-amber-200/80">
            Venus CRM automatically injects human randomized delays (60s–180s) between actions and respects daily limits to keep your LinkedIn account safe from platform restrictions.
          </p>
        </div>
      </div>

      {/* Quick Outreach Test Dialog */}
      <Dialog open={testActionDialogOpen} onOpenChange={setTestActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-[#0077b5]" /> Quick LinkedIn Outreach Test
            </DialogTitle>
            <DialogDescription className="text-xs">
              Test sending a connection request or direct message immediately through your live LinkedIn connection.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteQuickTest} className="space-y-3.5 pt-2">
            <div className="flex gap-2 p-1 bg-canvas/50 rounded-lg border border-border-subtle">
              <Button
                type="button"
                variant={testActionType === "INVITE" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTestActionType("INVITE")}
                className="flex-1 h-7 text-xs"
              >
                <UserPlus className="size-3 mr-1" /> Connection Invite
              </Button>
              <Button
                type="button"
                variant={testActionType === "MESSAGE" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTestActionType("MESSAGE")}
                className="flex-1 h-7 text-xs"
              >
                <Send className="size-3 mr-1" /> Direct Message
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-target" className="text-xs font-medium">
                Recipient LinkedIn URL or Vanity Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-target"
                placeholder="e.g. https://www.linkedin.com/in/satyanadella/ or satyanadella"
                value={testTargetUrl}
                onChange={(e) => setTestTargetUrl(e.target.value)}
                required
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-msg" className="text-xs font-medium">
                  {testActionType === "INVITE" ? "Personalized Note (Optional)" : "Message Content *"}
                </Label>
                {testActionType === "INVITE" && (
                  <span className="text-[10px] text-text-dim">{testMessage.length}/300 chars</span>
                )}
              </div>
              <Textarea
                id="quick-msg"
                placeholder={
                  testActionType === "INVITE"
                    ? "Hi! I saw your profile and would love to connect."
                    : "Hi, following up on our recent conversation..."
                }
                value={testMessage}
                maxLength={testActionType === "INVITE" ? 300 : undefined}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTestActionDialogOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={sendInviteMutation.isPending || sendMessageMutation.isPending}
                className="h-8 text-xs bg-[#0077b5] hover:bg-[#006097] text-white"
              >
                {(sendInviteMutation.isPending || sendMessageMutation.isPending) && (
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                )}
                {testActionType === "INVITE" ? "Send Connection Request" : "Send Message"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Connect Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Linkedin className="size-4 text-[#0077b5]" />{" "}
              {connected ? "Edit LinkedIn Connection" : "Connect LinkedIn Account"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {connected
                ? "Update your LinkedIn profile information, credentials, or daily outreach caps."
                : "Enter your LinkedIn account credentials or session token to enable automated outreach and candidate sourcing."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConnectSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="li-email" className="text-xs font-medium">
                LinkedIn Account Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="li-email"
                type="email"
                placeholder="name@company.com"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="li-name" className="text-xs font-medium">
                  Full Name (Optional)
                </Label>
                <Input
                  id="li-name"
                  placeholder="e.g. Pratyush Kumar"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="li-url" className="text-xs font-medium">
                  Profile URL (Optional)
                </Label>
                <Input
                  id="li-url"
                  placeholder="linkedin.com/in/..."
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="li-token" className="text-xs font-medium flex items-center gap-1">
                  <Lock className="size-3 text-text-dim" /> Unipile Token / Session Key (Optional)
                </Label>
                <span className="text-[10px] text-text-dim">Encrypted at rest</span>
              </div>
              <Input
                id="li-token"
                type="password"
                placeholder="Leave blank to use server environment default"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-text-dim">
                Uses the system Unipile engine credentials if left blank.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="li-invites" className="text-xs font-medium">
                  Daily Invite Limit
                </Label>
                <Input
                  id="li-invites"
                  type="number"
                  min={1}
                  max={50}
                  value={dailyInviteLimit}
                  onChange={(e) => setDailyInviteLimit(Number(e.target.value))}
                  className="h-9 text-xs"
                />
                <span className="text-[10px] text-text-dim">Recommended: 20/day</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="li-messages" className="text-xs font-medium">
                  Daily Message Limit
                </Label>
                <Input
                  id="li-messages"
                  type="number"
                  min={1}
                  max={150}
                  value={dailyMessageLimit}
                  onChange={(e) => setDailyMessageLimit(Number(e.target.value))}
                  className="h-9 text-xs"
                />
                <span className="text-[10px] text-text-dim">Recommended: 50/day</span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={connectMutation.isPending}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={connectMutation.isPending}
                className="h-8 text-xs"
              >
                {connectMutation.isPending && <Loader2 className="size-3 animate-spin mr-1.5" />}
                {connected ? "Update Connection" : "Save & Connect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Limits Dialog */}
      <Dialog open={limitsDialogOpen} onOpenChange={setLimitsDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Adjust Safety Limits</DialogTitle>
            <DialogDescription className="text-xs">
              Configure daily maximum caps for connection requests and direct messages.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateLimitsSubmit} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-invites" className="text-xs font-medium">
                Daily Invites Cap (1–50)
              </Label>
              <Input
                id="edit-invites"
                type="number"
                min={1}
                max={50}
                value={editInviteLimit}
                onChange={(e) => setEditInviteLimit(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-messages" className="text-xs font-medium">
                Daily Messages Cap (1–150)
              </Label>
              <Input
                id="edit-messages"
                type="number"
                min={1}
                max={150}
                value={editMessageLimit}
                onChange={(e) => setEditMessageLimit(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLimitsDialogOpen(false)}
                disabled={updateLimitsMutation.isPending}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateLimitsMutation.isPending}
                className="h-8 text-xs"
              >
                {updateLimitsMutation.isPending && <Loader2 className="size-3 animate-spin mr-1.5" />}
                Update Limits
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
