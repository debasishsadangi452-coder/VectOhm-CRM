import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { DealActivityTimeline } from "@/components/deal-activity-timeline";
import { ProposalUploadDialog } from "@/components/proposal-upload-dialog";
import { CallButton } from "@/components/telephony/call-button";
import { EngagementBadge } from "@/components/engagement-badge";
import {
  useApproveDeal,
  useArchiveDeal,
  useDeal,
  useRejectDeal,
  useUpdateDeal,
} from "@/hooks/use-deals";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useUsers } from "@/hooks/use-users";
import { useDealDocuments, useDeleteDealDocument } from "@/hooks/use-deal-documents";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { downloadDealDocument } from "@/lib/api/deal-documents";
import { formatFileSize } from "@/lib/format-file-size";
import { useAuthStore } from "@/stores/auth-store";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from "@/lib/api/types";

export const Route = createFileRoute("/_app/deals/$id")({
  component: DealDetailPage,
});

const NO_COMPANY = "__none__";
const NO_CONTACT = "__none__";

const STAGE_TONE: Record<DealStage, string> = {
  NEW_LEAD: "bg-panel-elevated text-text-dim border-border-subtle",
  QUALIFIED: "bg-info/15 text-info border-info/20",
  MEETING_SCHEDULED: "bg-violet/15 text-violet border-violet/20",
  PROPOSAL_SENT: "bg-primary/15 text-primary border-primary/20",
  NEGOTIATION: "bg-warning/15 text-warning border-warning/20",
  WON: "bg-success/15 text-success border-success/20",
  LOST: "bg-destructive/15 text-destructive border-destructive/20",
  ARCHIVED: "bg-panel-elevated text-text-dim border-border-subtle",
};

function DealDetailPage() {
  useDepartmentGuard("Sales");
  const { id } = useParams({ from: "/_app/deals/$id" });
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const { data: deal, isLoading } = useDeal(id);
  const { data: companies } = useCompanies();
  const { data: contacts } = useContacts();
  const { data: users } = useUsers();
  const updateDeal = useUpdateDeal();
  const archiveDeal = useArchiveDeal();
  const approveDeal = useApproveDeal();
  const rejectDeal = useRejectDeal();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("0");
  const [stage, setStage] = useState<DealStage>("NEW_LEAD");
  const [companyId, setCompanyId] = useState<string>(NO_COMPANY);
  const [contactId, setContactId] = useState<string>(NO_CONTACT);
  const [ownerId, setOwnerId] = useState<string>("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalPrompted, setProposalPrompted] = useState(false);

  const { data: documents } = useDealDocuments(id);
  const deleteDocument = useDeleteDealDocument(id);

  // Re-seed whenever the fetched deal changes -- covers the first load and any
  // refetch after a mutation elsewhere (e.g. an approval).
  useEffect(() => {
    if (!deal) return;
    setTitle(deal.title);
    setValue(String(deal.value));
    setStage(deal.stage);
    setCompanyId(deal.companyId ?? NO_COMPANY);
    setContactId(deal.contactId ?? NO_CONTACT);
    setOwnerId(deal.ownerId);
    setExpectedCloseDate(deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : "");
    setFollowUpAt(deal.followUpAt ? deal.followUpAt.slice(0, 10) : "");
    setNotes(deal.notes ?? "");
  }, [deal]);

  const isAdmin = currentUser?.role.name === "ADMIN";
  const assignableUsers = isAdmin
    ? users
    : users?.filter((u) => u.department?.id === currentUser?.department?.id);

  // Same rule as the backend's assertCanApprove: no owner branch, so the
  // Employee who requested approval can't approve their own request.
  const canApprove =
    !!deal &&
    deal.approvalStatus === "PENDING" &&
    (isAdmin ||
      (currentUser?.role.name === "MANAGER" &&
        (deal.departmentId === null || deal.departmentId === currentUser?.department?.id)));

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const result = await updateDeal.mutateAsync({
        id,
        input: {
          title,
          value: Number(value) || 0,
          stage,
          companyId: companyId === NO_COMPANY ? null : companyId,
          contactId: contactId === NO_CONTACT ? null : contactId,
          ownerId: ownerId || undefined,
          notes: notes || null,
          expectedCloseDate: expectedCloseDate || null,
          followUpAt: followUpAt || null,
        },
      });
      if (result.approvalStatus === "PENDING" && deal?.approvalStatus !== "PENDING") {
        setNotice(
          "Submitted for manager approval — this deal will move to Closed Won once approved.",
        );
        return;
      }
      setNotice("Changes saved.");
      // Moving into Proposal Sent is the moment to capture what was actually
      // sent -- but only ask when nothing is attached yet, so re-saving an
      // already-documented deal does not nag.
      if (
        result.stage === "PROPOSAL_SENT" &&
        deal?.stage !== "PROPOSAL_SENT" &&
        (documents?.length ?? 0) === 0
      ) {
        setProposalPrompted(true);
        setProposalOpen(true);
      }
    } catch {
      setError("Could not save this deal");
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this deal? It stays in history but leaves the active pipeline.")) return;
    try {
      await archiveDeal.mutateAsync(id);
      navigate({ to: "/crm" });
    } catch {
      setError("Could not archive this deal");
    }
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-32">
        <Loader2 className="size-5 animate-spin text-text-dim" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-text-dim">This deal doesn't exist or you can't access it.</p>
        <Link to="/crm" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to pipeline
        </Link>
      </div>
    );
  }

  const saving = updateDeal.isPending;

  return (
    <div className="mx-auto max-w-[1800px] space-y-5 p-6">
      <Link
        to="/crm"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to pipeline
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{deal.title}</h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${STAGE_TONE[deal.stage]}`}
            >
              {DEAL_STAGE_LABELS[deal.stage]}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-text-dim">
            ${deal.value.toLocaleString()}
            {deal.company && ` · ${deal.company.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleArchive}
            disabled={archiveDeal.isPending}
          >
            {archiveDeal.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Archive
          </Button>
          <Button type="submit" form="deal-detail-form" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </div>

      {deal.approvalStatus === "PENDING" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <span className="text-sm text-warning">
            This deal is pending approval to close as Won.
          </span>
          {canApprove && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => rejectDeal.mutate(id)}
                disabled={approveDeal.isPending || rejectDeal.isPending}
              >
                Reject
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => approveDeal.mutate(id)}
                disabled={approveDeal.isPending || rejectDeal.isPending}
              >
                {approveDeal.isPending ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <form
          id="deal-detail-form"
          onSubmit={handleSave}
          className="space-y-4 rounded-xl border border-border-subtle bg-panel p-5 lg:col-span-2"
        >
          <p className="text-xs font-medium text-text-dim">Deal details</p>

          <div className="space-y-1.5">
            <Label htmlFor="deal-title">Title</Label>
            <Input
              id="deal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-value">Value ($)</Label>
              <Input
                id="deal-value"
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as DealStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {DEAL_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-close-date">Expected close</Label>
              <Input
                id="deal-close-date"
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal-follow-up">Follow-up reminder</Label>
            <div className="flex items-center gap-2">
              <Input
                id="deal-follow-up"
                type="date"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="max-w-[200px]"
              />
              {followUpAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-text-dim"
                  onClick={() => setFollowUpAt("")}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-text-dim">
              {deal.owner.firstName} gets an in-app reminder and an email once this date arrives.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>No company</SelectItem>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CONTACT}>No contact</SelectItem>
                  {contacts?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea
              id="deal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </div>

          {notice && <p className="text-sm text-warning">{notice}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <div className="space-y-3 rounded-xl border border-border-subtle bg-panel p-5">
          <p className="text-xs font-medium text-text-dim">Summary</p>
          <SummaryRow icon={UserCircle2} label="Owner">
            <span className="flex items-center gap-1.5">
              <Avatar className="size-5">
                <AvatarFallback className="text-[9px]">
                  {getInitials(deal.owner)}
                </AvatarFallback>
              </Avatar>
              {deal.owner.firstName} {deal.owner.lastName}
            </span>
          </SummaryRow>
          <SummaryRow icon={Building2} label="Company">
            {deal.company?.name ?? "—"}
          </SummaryRow>
          <SummaryRow icon={UserCircle2} label="Contact">
            {deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : "—"}
            {deal.contact && (
              <EngagementBadge
                tier={deal.contact.engagementTier}
                score={deal.contact.engagementScore}
                className="ml-1.5 align-middle"
              />
            )}
            {deal.contact?.phone && (
              <CallButton
                toNumber={deal.contact.phone}
                displayName={`${deal.contact.firstName} ${deal.contact.lastName}`}
                contactId={deal.contact.id}
                companyId={deal.companyId ?? undefined}
                dealId={deal.id}
                size="icon"
                className="ml-1.5 size-6 align-middle"
              />
            )}
          </SummaryRow>
          <SummaryRow icon={CalendarClock} label="Expected close">
            {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "—"}
          </SummaryRow>
          <SummaryRow icon={CalendarClock} label="Closed at">
            {deal.closedAt ? new Date(deal.closedAt).toLocaleDateString() : "—"}
          </SummaryRow>
          <SummaryRow icon={CalendarClock} label="Created">
            {new Date(deal.createdAt).toLocaleDateString()}
          </SummaryRow>
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Proposal documents</p>
            <p className="mt-0.5 text-xs text-text-dim">
              What was actually sent to the customer, kept on the deal.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setProposalPrompted(false);
              setProposalOpen(true);
            }}
          >
            <Paperclip className="size-3.5" />
            Attach proposal
          </Button>
        </div>

        {documents && documents.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
            <table className="w-full border-collapse text-left">
              <thead className="bg-panel-elevated">
                <tr className="text-[10px] uppercase tracking-wide text-text-dim">
                  <th className="border-b border-r border-border-subtle px-3 py-2 font-medium">
                    File
                  </th>
                  <th className="w-32 border-b border-r border-border-subtle px-3 py-2 font-medium">
                    Note
                  </th>
                  <th className="w-20 border-b border-r border-border-subtle px-3 py-2 font-medium">
                    Size
                  </th>
                  <th className="w-28 border-b border-r border-border-subtle px-3 py-2 font-medium">
                    Attached by
                  </th>
                  <th className="w-28 border-b border-r border-border-subtle px-3 py-2 font-medium">
                    Date
                  </th>
                  <th className="w-20 border-b border-border-subtle" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, i) => (
                  <tr key={doc.id} className={i % 2 === 1 ? "bg-canvas/40" : ""}>
                    <td className="border-b border-r border-border-subtle px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate">{doc.originalName}</span>
                      </span>
                    </td>
                    <td className="border-b border-r border-border-subtle px-3 py-2 text-xs text-text-dim">
                      {doc.note ?? "-"}
                    </td>
                    <td className="border-b border-r border-border-subtle px-3 py-2 font-mono text-[11px] text-text-dim">
                      {formatFileSize(doc.sizeBytes)}
                    </td>
                    <td className="border-b border-r border-border-subtle px-3 py-2 text-xs text-text-dim">
                      {doc.uploader.firstName} {doc.uploader.lastName}
                    </td>
                    <td className="border-b border-r border-border-subtle px-3 py-2 font-mono text-[11px] text-text-dim">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="border-b border-border-subtle px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => downloadDealDocument(doc.id, doc.originalName)}
                          className="text-text-dim transition-colors hover:text-foreground"
                          aria-label="Download document"
                        >
                          <Download className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm("Remove this document from the deal?")) return;
                            deleteDocument.mutate(doc.id);
                          }}
                          disabled={deleteDocument.isPending}
                          className="text-text-dim transition-colors hover:text-destructive"
                          aria-label="Delete document"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-border-subtle px-3 py-6 text-center text-xs text-text-dim">
            {deal.stage === "PROPOSAL_SENT"
              ? "This deal is in Proposal Sent but has no proposal attached yet."
              : "No proposal attached yet."}
          </p>
        )}
      </div>

      <ProposalUploadDialog
        dealId={id}
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        prompted={proposalPrompted}
      />

      {/* Full width -- this is what the dialog never had room for. */}
      <div className="rounded-xl border border-border-subtle bg-panel p-5">
        <DealActivityTimeline dealId={id} dealContactId={deal.contactId} />
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserCircle2;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2.5 last:border-0 last:pb-0">
      <span className="flex items-center gap-1.5 text-xs text-text-dim">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="truncate text-right text-xs">{children}</span>
    </div>
  );
}
