import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Search,
  Send,
  Loader2,
  Users,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Square,
  CheckSquare,
  UploadCloud,
  Trash2,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Eye,
  RotateCcw,
  UserPlus,
  FileSpreadsheet,
  Building2,
  Bot,
  ListChecks,
} from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useContacts, useImportContacts } from "@/hooks/use-contacts";
import { listContacts } from "@/lib/api/contacts";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { useEmailConnectionStatus } from "@/hooks/use-email-connections";
import {
  useBulkEmailCampaigns,
  useBulkEmailCampaign,
  useCreateBulkEmailCampaign,
  useRunBulkEmailEngine,
  useDeleteBulkEmailCampaign,
  useRetryFailedBulkEmailSends,
  useCancelPendingBulkEmailSends,
} from "@/hooks/use-bulk-email";
import { runBulkEmailEngine } from "@/lib/api/bulk-email";
import { useCampaignMetrics, useEngagementEvents } from "@/hooks/use-engagement";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BulkEmailComposer, type ComposeMode } from "@/components/bulk-email-composer";
import { BulkEmailSenderSection } from "@/components/bulk-email-sender-section";
import { IntentAutomationsPanel } from "@/components/intent-automations-panel";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import { ApiError } from "@/lib/api/client";
import type { BulkEmailCampaign, BulkSendStatus, Contact, FollowUpMode } from "@/lib/api/types";
import { plainTextToHtml } from "@/lib/plain-text-to-html";
import {
  extractEmailsFromSheet,
  parseRawEmails,
  parseSpreadsheetContacts,
  inferCompanyFromEmail,
  type ParsedSpreadsheetContact,
} from "@/lib/bulk-email-parse";

export const Route = createFileRoute("/_app/bulk-email")({
  // ?tab=auto opens the "Auto outreach" tab (the old Intent Hiring > Automations links land here).
  validateSearch: (search: Record<string, unknown>): { tab?: "auto" } => (search.tab === "auto" ? { tab: "auto" } : {}),
  component: BulkEmailPage,
});

// The two ways to send email from this page, named for what you do rather than how they work inside.
const VIEWS: Array<{ id: "send" | "auto"; title: string; hint: string; icon: typeof Send }> = [
  { id: "send", title: "Send to a list", hint: "You pick the recipients and send once: a saved template or a new email.", icon: ListChecks },
  {
    id: "auto",
    title: "Auto outreach",
    hint: "Rules that watch hiring and news signals and write each email for you, on a schedule.",
    icon: Bot,
  },
];

type SourceFilter = "ALL" | "APOLLO" | "IMPORT" | "MANUAL";

const STATUS_STYLES: Record<BulkSendStatus, string> = {
  PENDING: "bg-canvas/50 text-text-dim border-border-subtle",
  SENT: "bg-success/15 text-success border-success/20",
  FAILED: "bg-destructive/15 text-destructive border-destructive/20",
  SKIPPED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
};

function BulkEmailPage() {
  useDepartmentGuard(["Sales", "Recruitment"]);
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const view: "send" | "auto" = tab === "auto" ? "auto" : "send";
  const setView = (next: "send" | "auto") =>
    navigate({ to: "/bulk-email", search: next === "auto" ? { tab: "auto" } : {}, replace: true });
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";

  const queryClient = useQueryClient();
  const { data: templates } = useEmailTemplates();
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const importContacts = useImportContacts();
  const { data: campaigns, isLoading: campaignsLoading } = useBulkEmailCampaigns();
  const { data: emailConnection, isLoading: emailConnectionLoading } = useEmailConnectionStatus();
  const createCampaign = useCreateBulkEmailCampaign();
  const runEngine = useRunBulkEmailEngine();
  const deleteCampaign = useDeleteBulkEmailCampaign();

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [composeMode, setComposeMode] = useState<ComposeMode>("TEMPLATE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [appendSignature, setAppendSignature] = useState(false);
  const [aiPersonalize, setAiPersonalize] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [followUpMode, setFollowUpMode] = useState<FollowUpMode>("MANUAL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [rawEmailsInput, setRawEmailsInput] = useState("");
  const [uploadedBatch, setUploadedBatch] = useState<{
    fileName: string;
    contacts: ParsedSpreadsheetContact[];
    newCount: number;
    matchedCount: number;
  } | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);
  const [showSenderConfig, setShowSenderConfig] = useState(false);
  const [selectedSenderId, setSelectedSenderId] = useState<string>("");

  const connections = emailConnection?.connections ?? [];
  const activeConn = connections.find((c) => c.isDefault) ?? connections[0];
  const smtpReady = !!(activeConn ? activeConn.verified : emailConnection?.connected && emailConnection?.verified);
  const senderReady = smtpReady || !!emailConnection?.httpFallbackAvailable;
  const [viewingCampaign, setViewingCampaign] = useState<BulkEmailCampaign | undefined>(undefined);
  const [contactQuery, setContactQuery] = useState("");

  const eligibleContacts = useMemo(() => {
    const withEmail = (contacts ?? []).filter((c): c is Contact & { email: string } => !!c.email);
    const bySource =
      sourceFilter === "ALL" ? withEmail : withEmail.filter((c) => c.source === sourceFilter);
    const term = contactQuery.trim().toLowerCase();
    if (!term) return bySource;
    return bySource.filter(
      (c) =>
        `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.company?.name ?? "").toLowerCase().includes(term),
    );
  }, [contacts, sourceFilter, contactQuery]);

  const selectedContactIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  const rawEmails = useMemo(() => parseRawEmails(rawEmailsInput), [rawEmailsInput]);

  // Accurately deduplicate selected CRM contacts and raw emails by normalized email
  const dedupedRecipients = useMemo(() => {
    const set = new Set<string>();
    const contactMap = new Map(
      (contacts ?? []).filter((c) => !!c.email).map((c) => [c.id, c.email!.trim().toLowerCase()]),
    );
    for (const id of selectedContactIds) {
      const email = contactMap.get(id);
      if (email) set.add(email);
    }
    for (const email of rawEmails) {
      set.add(email.trim().toLowerCase());
    }
    return set;
  }, [contacts, selectedContactIds, rawEmails]);

  const totalRecipients = dedupedRecipients.size;

  const previewContact = useMemo(
    () => eligibleContacts.find((c) => c.id === selectedContactIds[0]),
    [eligibleContacts, selectedContactIds],
  );

  const hasContent =
    composeMode === "TEMPLATE" ? !!templateId : subject.trim().length > 0 && body.trim().length > 0;

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const tmpl = templates?.find((t) => t.id === id);
    if (tmpl) {
      setAppendSignature(tmpl.appendSignature);
    }
  }

  async function handleRecipientFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    setFileNotice(null);
    setUploadedBatch(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setFileError("The file does not contain any sheets.");
        return;
      }
      const allRows: string[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
          allRows.push(...rows);
        }
      }
      const parsedContacts = parseSpreadsheetContacts(allRows);

      if (parsedContacts.length === 0) {
        setFileError("No valid contacts or email addresses found in that file.");
        return;
      }

      const contactIdByEmail = new Map(
        (contacts ?? []).filter((c) => c.email).map((c) => [c.email!.trim().toLowerCase(), c.id]),
      );
      const newlySelected: Record<string, boolean> = {};
      const unmatched: ParsedSpreadsheetContact[] = [];

      for (const contact of parsedContacts) {
        const contactId = contactIdByEmail.get(contact.email);
        if (contactId) {
          newlySelected[contactId] = true;
        } else {
          unmatched.push(contact);
        }
      }

      setSelected((prev) => ({ ...prev, ...newlySelected }));

      if (unmatched.length > 0) {
        setRawEmailsInput((prev) =>
          Array.from(new Set([...parseRawEmails(prev), ...unmatched.map((c) => c.email)])).join("\n"),
        );
      }

      const matchedCount = parsedContacts.length - unmatched.length;

      setUploadedBatch({
        fileName: file.name,
        contacts: parsedContacts,
        newCount: unmatched.length,
        matchedCount,
      });

      if (unmatched.length > 0) {
        setFileNotice(
          `Loaded ${parsedContacts.length} contact${parsedContacts.length !== 1 ? "s" : ""} from "${file.name}" -- ` +
            `${matchedCount} already in CRM, ${unmatched.length} new. Click "Add to CRM Database" below to save them.`,
        );
      } else {
        setFileNotice(
          `Loaded ${parsedContacts.length} contact${parsedContacts.length !== 1 ? "s" : ""} from "${file.name}" -- ` +
            `all ${matchedCount} already exist in CRM and are selected.`,
        );
      }
    } catch {
      setFileError(
        "Couldn't read that file -- make sure it's a valid .csv, .xlsx, .xls, or .xlsm file.",
      );
    }
  }

  async function handleSaveUploadedToCrm() {
    if (!uploadedBatch || uploadedBatch.newCount === 0) return;
    setFileError(null);
    try {
      const res = await importContacts.mutateAsync({
        fileName: uploadedBatch.fileName,
        rows: uploadedBatch.contacts,
      });

      // Refetch contacts query immediately so the UI has them
      const updatedContacts = await queryClient.fetchQuery({
        queryKey: ["contacts", {}],
        queryFn: () => listContacts(),
      });

      // Auto-select all contacts from the batch in the CRM list
      const batchEmails = new Set(uploadedBatch.contacts.map((c) => c.email.toLowerCase()));
      const newlySelected: Record<string, boolean> = {};
      for (const c of updatedContacts) {
        if (c.email && batchEmails.has(c.email.trim().toLowerCase())) {
          newlySelected[c.id] = true;
        }
      }
      setSelected((prev) => ({ ...prev, ...newlySelected }));

      // Clean out the rawEmailsInput so they are no longer in "Additional emails"
      setRawEmailsInput((prev) => {
        const remaining = parseRawEmails(prev).filter((email) => !batchEmails.has(email.toLowerCase()));
        return remaining.join("\n");
      });

      // Switch to ALL filter tab so they appear right away
      setSourceFilter("ALL");

      setFileNotice(
        `✓ Saved ${res.createdCount} contact${res.createdCount !== 1 ? "s" : ""} to CRM database (${res.updatedCount} updated). They are now saved in the CRM and selected above!`,
      );
      setUploadedBatch(null);
    } catch (err) {
      setFileError(err instanceof ApiError ? err.message : "Could not save contacts to CRM database");
    }
  }

  function toggleSelectAll() {
    if (eligibleContacts.length === 0) return;
    const allSelected = eligibleContacts.every((c) => selected[c.id]);
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of eligibleContacts) {
        if (allSelected) {
          delete next[c.id];
        } else {
          next[c.id] = true;
        }
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected({});
  }

  async function handleSend() {
    if (!hasContent || totalRecipients === 0) return;
    setNotice(null);
    setSendError(null);
    try {
      const campaign = await createCampaign.mutateAsync({
        name: name.trim() || `Bulk send — ${new Date().toLocaleDateString()}`,
        ...(composeMode === "TEMPLATE"
          ? { templateId }
          : { subject: subject.trim(), bodyHtml: plainTextToHtml(body.trim()) }),
        appendSignature,
        aiPersonalize: aiPersonalize || undefined,
        aiInstructions: aiPersonalize ? aiInstructions.trim() || undefined : undefined,
        followUpMode,
        emailConnectionId: selectedSenderId || undefined,
        contactIds: selectedContactIds.length > 0 ? selectedContactIds : undefined,
        rawEmails: rawEmails.length > 0 ? rawEmails : undefined,
      });
      runBulkEmailEngine().catch(() => {});
      setNotice(
        `Queued "${campaign.name}" for ${campaign._count.recipients} recipient${campaign._count.recipients !== 1 ? "s" : ""}. Sending happens in the background over the next few minutes.`,
      );
      setName("");
      setTemplateId("");
      setSubject("");
      setBody("");
      setAiPersonalize(false);
      setAiInstructions("");
      setSelected({});
      setRawEmailsInput("");
      setFileNotice(null);
      setFileError(null);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Could not queue this campaign");
    }
  }

  async function handleRunEngine() {
    setEngineNotice(null);
    try {
      const res = await runEngine.mutateAsync();
      setEngineNotice(`Processed ${res.processed} pending send${res.processed !== 1 ? "s" : ""}.`);
    } catch (err) {
      setEngineNotice(err instanceof ApiError ? err.message : "Error triggering send engine");
    }
  }

  async function handleDeleteCampaign(id: string, campName: string) {
    if (!confirm(`Delete campaign "${campName}"? This will remove its history and stop any pending sends.`)) {
      return;
    }
    try {
      await deleteCampaign.mutateAsync(id);
      if (viewingCampaign?.id === id) {
        setViewingCampaign(undefined);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete this campaign");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
            <Send className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Email Campaigns</h1>
            <p className="text-xs text-text-dim mt-0.5 max-w-2xl">
              All your outbound email in one place. Sends are throttled in the background so campaigns
              stay safe and compliant, and every send shows up in the history below.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSenderConfig(!showSenderConfig)}
          className="gap-1.5 shrink-0 text-xs"
        >
          <Mail className="size-3.5" />
          Sender Settings
          {showSenderConfig ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </div>

      <div role="tablist" aria-label="Email campaign type" className="grid gap-2 sm:grid-cols-2">
        {VIEWS.map(({ id, title, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
              view === id ? "border-primary bg-primary/5" : "border-border-subtle hover:border-primary/40"
            }`}
          >
            <Icon className={`mt-0.5 size-5 shrink-0 ${view === id ? "text-primary" : "text-text-dim"}`} />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-text-dim">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {view === "auto" ? (
        <IntentAutomationsPanel />
      ) : (
      <>
      {showSenderConfig && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              Mailbox &amp; Sender Configuration
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSenderConfig(false)}
              className="text-xs h-7 px-2"
            >
              Close
            </Button>
          </div>
          <BulkEmailSenderSection />
        </div>
      )}

      {!emailConnectionLoading && !senderReady && !showSenderConfig && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-4 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-warning shrink-0" />
            <div>
              <p className="font-semibold">Connect your email to send bulk campaigns.</p>
              <p className="text-text-dim mt-0.5">
                Campaigns send from your own mailbox so replies route directly to you.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowSenderConfig(true)}
            className="gap-1.5 shrink-0"
          >
            <Mail className="size-3.5" />
            Configure Mailbox
          </Button>
        </div>
      )}

      {!emailConnectionLoading && !smtpReady && senderReady && !showSenderConfig && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-4 text-text-dim shrink-0" />
            <p className="text-text-dim">
              No mailbox connected yet; sends will use the shared server address. Connect your own
              mailbox to send directly as yourself.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSenderConfig(true)}
            className="gap-1.5 shrink-0 text-xs"
          >
            Connect Mailbox
          </Button>
        </div>
      )}

      <div className="bg-panel border border-border rounded-xl p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="be-name">Campaign name (optional)</Label>
          <Input
            id="be-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 SaaS founders outreach"
          />
        </div>

        {/* Sender Account Selection */}
        {connections.length > 0 && (
          <div className="space-y-1.5 bg-canvas/30 border border-border-subtle rounded-lg p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="be-sender" className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                Send campaign from mailbox:
              </Label>
              <button
                type="button"
                onClick={() => setShowSenderConfig(true)}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                Manage accounts ({connections.length})
              </button>
            </div>
            {connections.length === 1 ? (
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <span className="font-medium text-foreground">
                  {connections[0].fromName
                    ? `${connections[0].fromName} <${connections[0].fromEmail}>`
                    : connections[0].fromEmail}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-medium">
                  {connections[0].connectionType === "SMTP" ? "SMTP" : "Connected"}
                </span>
              </div>
            ) : (
              <select
                id="be-sender"
                value={selectedSenderId || emailConnection?.activeConnectionId || connections[0]?.id || ""}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full text-xs rounded-md border border-border-subtle bg-canvas px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fromName ? `${c.fromName} <${c.fromEmail}>` : c.fromEmail}
                    {c.isDefault ? " (Default Active Sender)" : ""} — {c.connectionType === "SMTP" ? "SMTP" : c.connectionType === "OAUTH_GOOGLE" ? "Gmail" : c.connectionType === "OAUTH_ZOHO" ? "Zoho" : "Outlook"}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="border-t border-border-subtle pt-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="flex items-center gap-1.5">
              <Users className="size-3.5" /> CRM contacts
              {selectedContactIds.length > 0 && (
                <span className="text-[11px] font-normal text-primary">
                  ({selectedContactIds.length} selected)
                </span>
              )}
            </Label>
            <div className="flex items-center gap-1.5">
              {(["ALL", "APOLLO", "IMPORT", "MANUAL"] as SourceFilter[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={`text-[10px] px-2 py-1 rounded-full border font-medium ${
                    sourceFilter === source
                      ? "bg-primary/15 text-primary border-primary/20"
                      : "bg-canvas/50 text-text-dim border-border-subtle hover:text-foreground"
                  }`}
                >
                  {source === "ALL"
                    ? "All"
                    : source === "APOLLO"
                      ? "From Apollo"
                      : source === "IMPORT"
                        ? "Imported"
                        : "Manual"}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
            <Input
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              placeholder="Search name, email, or company…"
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-48 border border-border-subtle rounded-lg">
            <div className="p-1.5 space-y-0.5">
              {contactsLoading ? (
                <div className="flex items-center gap-2 text-xs text-text-dim p-4 justify-center">
                  <Loader2 className="size-3.5 animate-spin" /> Loading CRM contacts…
                </div>
              ) : eligibleContacts.length === 0 ? (
                <p className="text-[10px] text-text-dim p-2">
                  {contactQuery
                    ? "No contacts match that search."
                    : "No contacts with an email on file match this filter."}
                </p>
              ) : (
                eligibleContacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() =>
                      setSelected((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                    }
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-canvas/40 cursor-pointer text-xs select-none"
                  >
                    <Checkbox
                      checked={!!selected[c.id]}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => ({ ...prev, [c.id]: !!checked }))
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="font-medium truncate min-w-[120px] max-w-[200px]">
                      {c.firstName || ""} {c.lastName || ""}
                    </span>
                    {(c.company?.name || inferCompanyFromEmail(c.email)) && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-text-dim px-2 py-0.5 rounded bg-canvas/60 border border-border-subtle truncate max-w-[180px]">
                        <Building2 className="size-3 text-text-dim shrink-0" />
                        <span className="truncate">
                          {c.company?.name || inferCompanyFromEmail(c.email)}
                        </span>
                      </span>
                    )}
                    <span className="text-text-dim truncate ml-auto max-w-[220px]">{c.email}</span>
                    {c.source === "APOLLO" && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                        Apollo
                      </span>
                    )}
                    {c.source === "IMPORT" && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                        Imported
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={eligibleContacts.length === 0}
              className="text-[10px] text-text-dim hover:text-foreground flex items-center gap-1 disabled:opacity-50"
            >
              {eligibleContacts.length > 0 && eligibleContacts.every((c) => selected[c.id]) ? (
                <CheckSquare className="size-3 text-primary" />
              ) : (
                <Square className="size-3" />
              )}
              Select all visible ({eligibleContacts.length})
            </button>
            {selectedContactIds.length > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-[10px] text-destructive hover:underline"
              >
                Clear selection ({selectedContactIds.length})
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-1.5">
          <Label htmlFor="be-raw-emails">Additional emails (not yet in the CRM)</Label>
          <Textarea
            id="be-raw-emails"
            value={rawEmailsInput}
            onChange={(e) => setRawEmailsInput(e.target.value)}
            placeholder="Paste emails separated by commas, semicolons, or new lines (e.g. john@example.com; jane@example.com)"
            className="min-h-20 text-xs font-mono"
          />
          <p className="text-[10px] text-text-dim">
            {rawEmails.length > 0
              ? `${rawEmails.length} valid email${rawEmails.length !== 1 ? "s" : ""} recognized.`
              : "Paste any external emails. Delimited by commas, semicolons, or newlines."}
          </p>
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-1.5">
          <Label>Or upload a CSV/Excel file of recipients</Label>
          <label className="flex items-center gap-2 border border-dashed border-border-subtle rounded-lg px-3 py-2.5 cursor-pointer hover:border-primary/40 hover:bg-canvas/30 transition-colors text-xs text-text-dim">
            <UploadCloud className="size-4 shrink-0" />
            <span>
              Click to choose a .csv, .xlsx, .xls, or .xlsm file — emails found in it will be matched
              against existing contacts automatically, and any new addresses added above.
            </span>
            <Input
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12,text/csv"
              onChange={handleRecipientFileChange}
              className="hidden"
            />
          </label>
          {fileNotice && (
            <p className="text-[10px] text-success flex items-center gap-1">
              <CheckCircle2 className="size-3" /> {fileNotice}
            </p>
          )}
          {fileError && (
            <p className="text-[10px] text-destructive flex items-center gap-1">
              <AlertCircle className="size-3" /> {fileError}
            </p>
          )}

          {uploadedBatch && uploadedBatch.newCount > 0 && (
            <div className="mt-2.5 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="size-4 text-primary" />
                    <span className="text-xs font-semibold text-text">
                      {uploadedBatch.fileName}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-dim">
                    {uploadedBatch.newCount} contact{uploadedBatch.newCount !== 1 ? "s" : ""} and their company names recognized and ready to be saved into the CRM database.
                    {uploadedBatch.matchedCount > 0 && ` (${uploadedBatch.matchedCount} already in CRM).`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  onClick={handleSaveUploadedToCrm}
                  disabled={importContacts.isPending}
                >
                  {importContacts.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving to CRM...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" />
                      Add {uploadedBatch.newCount} to CRM Database
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-0.5 border-t border-border-subtle/50">
                <span className="text-[10px] text-text-dim font-medium uppercase tracking-wider">
                  Scraped preview:
                </span>
                {uploadedBatch.contacts.slice(0, 4).map((c, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-canvas/80 border border-border-subtle text-foreground"
                  >
                    <span>{c.firstName} {c.lastName}</span>
                    {c.companyName && (
                      <span className="text-text-dim flex items-center gap-0.5">
                        <Building2 className="size-2.5" />
                        {c.companyName}
                      </span>
                    )}
                  </span>
                ))}
                {uploadedBatch.contacts.length > 4 && (
                  <span className="text-[10px] text-text-dim">
                    +{uploadedBatch.contacts.length - 4} more contacts
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <BulkEmailComposer
          mode={composeMode}
          onModeChange={setComposeMode}
          templates={templates}
          templateId={templateId}
          onTemplateIdChange={handleTemplateChange}
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          previewContact={previewContact}
          recipientCount={selectedContactIds.length + rawEmails.length}
          hasUnlinkedRecipients={rawEmails.length > 0}
          appendSignature={appendSignature}
          onAppendSignatureChange={setAppendSignature}
          aiPersonalize={aiPersonalize}
          onAiPersonalizeChange={setAiPersonalize}
          aiInstructions={aiInstructions}
          onAiInstructionsChange={setAiInstructions}
        />

        <div className="border-t border-border-subtle pt-4 space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            Follow-up Automation
          </Label>
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              {
                mode: "MANUAL" as const,
                title: "Manual (Default)",
                desc: "Creates a reminder task when recipient opens the email.",
              },
              {
                mode: "ASSISTED" as const,
                title: "AI Assisted",
                desc: "Generates an AI follow-up draft for your review upon open.",
              },
              {
                mode: "AUTOMATED" as const,
                title: "Automated Send",
                desc: "Automatically sends AI follow-up 24h after first open.",
              },
            ].map((opt) => (
              <div
                key={opt.mode}
                onClick={() => setFollowUpMode(opt.mode)}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors select-none ${
                  followUpMode === opt.mode
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border-subtle bg-canvas/30 text-text-dim hover:text-foreground"
                }`}
              >
                <p className="text-xs font-medium flex items-center justify-between">
                  {opt.title}
                  {followUpMode === opt.mode && (
                    <CheckCircle2 className="size-3 text-primary shrink-0" />
                  )}
                </p>
                <p className="text-[10px] text-text-dim mt-0.5 leading-tight">{opt.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {notice && (
          <div className="flex items-center gap-2 text-sm text-success bg-success/10 border border-success/20 p-3 rounded-lg">
            <CheckCircle2 className="size-4" /> {notice}
          </div>
        )}
        {sendError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            <AlertCircle className="size-4" /> {sendError}
          </div>
        )}

        <div className="border-t border-border-subtle pt-4 flex items-center justify-between">
          <span className="text-xs text-text-dim">
            {totalRecipients} recipient{totalRecipients !== 1 ? "s" : ""} selected
            {selectedContactIds.length > 0 && rawEmails.length > 0 && (
              <span className="text-[10px] ml-1">
                ({selectedContactIds.length} from CRM, {rawEmails.length} external)
              </span>
            )}
          </span>
          <Button
            onClick={handleSend}
            disabled={
              !hasContent || totalRecipients === 0 || createCampaign.isPending || !senderReady
            }
            className="gap-1.5"
          >
            {createCampaign.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send to {totalRecipients > 0 ? totalRecipients : ""}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Campaign history</h2>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunEngine}
              disabled={runEngine.isPending}
              className="gap-1.5"
              title="Manually process pending sends now, instead of waiting for the next scheduled run"
            >
              {runEngine.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PlayCircle className="size-3.5" />
              )}
              Run engine now
            </Button>
          )}
        </div>
        {engineNotice && <p className="text-xs text-success">{engineNotice}</p>}

        <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Template / Content</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignsLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-text-dim py-8">
                    <Loader2 className="size-4 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              )}
              {!campaignsLoading && (!campaigns || campaigns.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-text-dim py-8">
                    No bulk email campaigns yet. Create your first campaign above!
                  </TableCell>
                </TableRow>
              )}
              {campaigns?.map((c) => {
                const sent = c.statusCounts?.SENT ?? 0;
                const failed = c.statusCounts?.FAILED ?? 0;
                const skipped = c.statusCounts?.SKIPPED ?? 0;
                const pending = c.statusCounts?.PENDING ?? 0;
                const hasAnyCounts = sent > 0 || failed > 0 || skipped > 0 || pending > 0;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-canvas/50 transition-colors"
                    onClick={() => setViewingCampaign(c)}
                  >
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="hover:underline">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {c.template?.name ?? (
                        <span className="italic" title={c.subject ?? undefined}>
                          {c.subject ? `One-off: "${c.subject}"` : "One-off email"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">{c._count.recipients}</TableCell>
                    <TableCell className="text-[10px] space-x-1">
                      {sent > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.SENT}`}>
                          {sent} sent
                        </span>
                      )}
                      {pending > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.PENDING}`}
                        >
                          {pending} pending
                        </span>
                      )}
                      {failed > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.FAILED}`}
                        >
                          {failed} failed
                        </span>
                      )}
                      {skipped > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.SKIPPED}`}
                        >
                          {skipped} skipped
                        </span>
                      )}
                      {!hasAnyCounts && (
                        <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.PENDING}`}>
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {c.creator.firstName} {c.creator.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {new Date(c.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {(isAdmin || c.creatorId === currentUser?.id || c.creator?.id === currentUser?.id) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-text-dim hover:text-destructive transition-colors"
                          title="Delete campaign"
                          onClick={() => handleDeleteCampaign(c.id, c.name)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <CampaignDetailDialog
        campaignId={viewingCampaign?.id}
        onOpenChange={(open) => !open && setViewingCampaign(undefined)}
      />
      </>
      )}
    </div>
  );
}

function CampaignDetailDialog({
  campaignId,
  onOpenChange,
}: {
  campaignId: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  const { data: campaign, isLoading } = useBulkEmailCampaign(campaignId);
  const { data: metrics } = useCampaignMetrics(campaignId);
  const retryFailed = useRetryFailedBulkEmailSends();
  const cancelPending = useCancelPendingBulkEmailSends();
  const runEngine = useRunBulkEmailEngine();

  const [activeTab, setActiveTab] = useState<"recipients" | "content">("recipients");
  const [recipientFilter, setRecipientFilter] = useState<"ALL" | BulkSendStatus>("ALL");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | undefined>();
  const [selectedRecipientName, setSelectedRecipientName] = useState<string | undefined>();
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab("recipients");
    setRecipientFilter("ALL");
    setRecipientSearch("");
    setActionNotice(null);
  }, [campaignId]);

  const canManage = isAdmin || campaign?.creatorId === currentUser?.id;
  const pendingCount = campaign?.recipients.filter((r) => r.status === "PENDING").length ?? 0;
  const failedCount = campaign?.recipients.filter((r) => r.status === "FAILED").length ?? 0;

  const filteredRecipients = useMemo(() => {
    if (!campaign?.recipients) return [];
    let list = campaign.recipients;
    if (recipientFilter !== "ALL") {
      list = list.filter((r) => r.status === recipientFilter);
    }
    const q = recipientSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.email.toLowerCase().includes(q) ||
          `${r.contact?.firstName ?? ""} ${r.contact?.lastName ?? ""}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [campaign?.recipients, recipientFilter, recipientSearch]);

  async function handleRetryFailed() {
    if (!campaignId) return;
    setActionNotice(null);
    try {
      const res = await retryFailed.mutateAsync(campaignId);
      await runEngine.mutateAsync();
      setActionNotice(`Queued ${res.count} failed send${res.count !== 1 ? "s" : ""} to retry now.`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not retry failed sends");
    }
  }

  async function handleCancelPending() {
    if (!campaignId) return;
    if (!confirm("Cancel all remaining pending sends for this campaign?")) return;
    setActionNotice(null);
    try {
      const res = await cancelPending.mutateAsync(campaignId);
      setActionNotice(`Cancelled ${res.count} pending send${res.count !== 1 ? "s" : ""}.`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not cancel pending sends");
    }
  }

  return (
    <>
      <Dialog open={!!campaignId} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg">{campaign?.name ?? "Campaign Details"}</DialogTitle>
                {campaign && (
                  <p className="text-xs text-text-dim mt-0.5">
                    Created by {campaign.creator.firstName} {campaign.creator.lastName} on{" "}
                    {new Date(campaign.createdAt).toLocaleString()}
                    {campaign.emailConnection && (
                      <span className="ml-2 font-medium text-foreground">
                        • Sending via: {campaign.emailConnection.fromName ? `${campaign.emailConnection.fromName} <${campaign.emailConnection.fromEmail}>` : campaign.emailConnection.fromEmail}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canManage && failedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryFailed}
                    disabled={retryFailed.isPending}
                    className="text-xs h-8 gap-1.5"
                  >
                    {retryFailed.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Retry Failed ({failedCount})
                  </Button>
                )}
                {canManage && pendingCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelPending}
                    disabled={cancelPending.isPending}
                    className="text-xs h-8 gap-1.5 text-destructive hover:text-destructive"
                  >
                    {cancelPending.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                    Cancel Pending
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-text-dim py-12 justify-center">
              <Loader2 className="size-4 animate-spin" /> Loading campaign data…
            </div>
          )}

          {actionNotice && (
            <div className="text-xs text-success bg-success/10 border border-success/20 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> {actionNotice}
            </div>
          )}

          {campaign && (
            <div className="space-y-4 overflow-y-auto pr-1">
              {metrics && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center p-3 bg-canvas/40 rounded-lg border border-border-subtle text-xs">
                  <div>
                    <p className="text-[10px] text-text-dim uppercase">Delivered</p>
                    <p className="font-semibold text-sm">
                      {metrics.delivered} / {campaign.recipients.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim uppercase">Open Rate</p>
                    <p className="font-semibold text-sm text-success">
                      {metrics.openRate}% ({metrics.opened})
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim uppercase">Click Rate</p>
                    <p className="font-semibold text-sm text-primary">
                      {metrics.clickRate}% ({metrics.clicked})
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim uppercase">Reply Rate</p>
                    <p className="font-semibold text-sm text-cyan-400">
                      {metrics.replyRate}% ({metrics.replied})
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim uppercase">Follow-Ups</p>
                    <p className="font-semibold text-sm">{metrics.followUpsGenerated}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim uppercase">Recipients</p>
                    <p className="font-semibold text-sm">{campaign.recipients.length}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("recipients")}
                  className={`text-xs font-medium pb-1 px-1 border-b-2 transition-colors ${
                    activeTab === "recipients"
                      ? "border-primary text-primary"
                      : "border-transparent text-text-dim hover:text-foreground"
                  }`}
                >
                  Recipients ({campaign.recipients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("content")}
                  className={`text-xs font-medium pb-1 px-1 border-b-2 transition-colors ${
                    activeTab === "content"
                      ? "border-primary text-primary"
                      : "border-transparent text-text-dim hover:text-foreground"
                  }`}
                >
                  Message Content
                </button>
              </div>

              {activeTab === "recipients" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      {(["ALL", "PENDING", "SENT", "FAILED", "SKIPPED"] as const).map((st) => {
                        const count =
                          st === "ALL"
                            ? campaign.recipients.length
                            : campaign.recipients.filter((r) => r.status === st).length;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setRecipientFilter(st)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                              recipientFilter === st
                                ? "bg-primary/15 text-primary border-primary/20"
                                : "bg-canvas/50 text-text-dim border-border-subtle hover:text-foreground"
                            }`}
                          >
                            {st === "ALL" ? "All" : st.toLowerCase()} ({count})
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative w-44">
                      <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-text-dim" />
                      <Input
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="Search recipient…"
                        className="h-7 text-xs pl-7"
                      />
                    </div>
                  </div>

                  <ScrollArea className="h-72">
                    <div className="space-y-1 pr-3">
                      {filteredRecipients.length === 0 ? (
                        <p className="text-xs text-text-dim text-center py-8">
                          No recipients match that filter.
                        </p>
                      ) : (
                        filteredRecipients.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => {
                              setSelectedRecipientId(r.id);
                              setSelectedRecipientName(
                                r.contact
                                  ? `${r.contact.firstName} ${r.contact.lastName}`
                                  : r.email,
                              );
                            }}
                            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded bg-canvas/30 border border-border-subtle hover:bg-accent/40 cursor-pointer transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {r.contact
                                  ? `${r.contact.firstName} ${r.contact.lastName}`
                                  : r.email}
                              </p>
                              {r.contact && (
                                <p className="text-[10px] text-text-dim truncate">{r.email}</p>
                              )}
                              {r.sentAt && (
                                <p className="text-[10px] text-text-dim">
                                  Sent: {new Date(r.sentAt).toLocaleString()}
                                </p>
                              )}
                              {r.errorMessage && (
                                <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
                                  <AlertCircle className="size-2.5" /> {r.errorMessage}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!!r.openCount && r.openCount > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/15 text-success border border-success/20">
                                  Opened ({r.openCount}x)
                                </span>
                              )}
                              {!!r.clickCount && r.clickCount > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                                  Clicked ({r.clickCount}x)
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_STYLES[r.status]}`}
                              >
                                {r.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {activeTab === "content" && (
                <div className="space-y-3">
                  <div className="bg-canvas/40 border border-border-subtle rounded-lg p-3 space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-text-dim">
                        Template
                      </span>
                      <p className="font-medium">
                        {campaign.template ? campaign.template.name : "Custom One-off Email"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-text-dim">
                        Subject
                      </span>
                      <p className="font-medium text-foreground">
                        {campaign.template?.subject ?? campaign.subject ?? "(No subject)"}
                      </p>
                    </div>
                    {campaign.appendSignature && (
                      <p className="text-[10px] text-primary">✓ Sender signature appended</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-text-dim uppercase tracking-wide">
                      Email Body Preview
                    </Label>
                    <div className="border border-border-subtle rounded-lg p-3 bg-canvas/30 max-h-60 overflow-y-auto">
                      <EmailHtmlPreview
                        html={plainTextToHtml(campaign.template?.bodyHtml ?? campaign.bodyHtml ?? "")}
                        className="h-48"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RecipientJourneyDialog
        recipientId={selectedRecipientId}
        recipientName={selectedRecipientName}
        onOpenChange={(open) => !open && setSelectedRecipientId(undefined)}
      />
    </>
  );
}

function RecipientJourneyDialog({
  recipientId,
  recipientName,
  onOpenChange,
}: {
  recipientId: string | undefined;
  recipientName: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const queryFilters = useMemo(() => ({ recipientId }), [recipientId]);
  const { data: events, isLoading } = useEngagementEvents(queryFilters, !!recipientId);

  return (
    <Dialog open={!!recipientId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Recipient Journey: {recipientName}
          </DialogTitle>
        </DialogHeader>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-dim py-8 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading journey timeline…
          </div>
        )}
        {!isLoading && (!events || events.length === 0) && (
          <p className="text-xs text-text-dim py-6 text-center">
            No tracked engagement events yet for this recipient.
          </p>
        )}
        {events && events.length > 0 && (
          <ScrollArea className="max-h-80 pr-2">
            <div className="space-y-3 relative pl-4 border-l border-border-subtle my-2">
              {events.map((evt) => (
                <div key={evt.id} className="relative text-xs">
                  <span className="absolute -left-[21px] top-0.5 size-2.5 rounded-full bg-primary ring-4 ring-canvas" />
                  <p className="font-medium text-xs text-foreground">{evt.type.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-text-dim mt-0.5">
                    {new Date(evt.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
