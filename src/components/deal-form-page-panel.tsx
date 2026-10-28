import React, { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  Flame,
  Info,
  Layers,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DealActivityTimeline } from "@/components/deal-activity-timeline";
import { useApproveDeal, useArchiveDeal, useCreateDeal, useRejectDeal, useUpdateDeal } from "@/hooks/use-deals";
import { useCompanies, useCreateCompany } from "@/hooks/use-companies";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type Deal, type DealStage } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

const NO_COMPANY = "__none__";
const NO_CONTACT = "__none__";
const NEW_COMPANY = "__new__";
const NEW_CONTACT = "__new__";

const VALUE_PRESETS = [5000, 15000, 35000, 75000, 150000, 500000];

const STAGE_DESCRIPTIONS: Record<DealStage, string> = {
  NEW_LEAD: "Unvetted incoming lead or discovery prospect",
  QUALIFIED: "Lead vetted for budget, need, and decision authority",
  MEETING_SCHEDULED: "Demo or discovery meeting booked on calendar",
  PROPOSAL_SENT: "Commercial proposal & scope active in client review",
  NEGOTIATION: "Legal, pricing, and contract terms in negotiation",
  WON: "Deal closed and contract successfully signed",
  LOST: "Opportunity discontinued or lost to competitor",
  ARCHIVED: "Archived or cold opportunity preserved for records",
};

interface DealFormPagePanelProps {
  onBack: () => void;
  onCreated?: () => void;
  deal?: Deal;
  defaultStage?: DealStage;
}

export function DealFormPagePanel({ onBack, onCreated, deal, defaultStage }: DealFormPagePanelProps) {
  const isEdit = !!deal;
  const currentUser = useAuthStore((s) => s.user);
  const { data: companies } = useCompanies();
  const { data: contacts } = useContacts();
  const { data: users } = useUsers();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const createCompany = useCreateCompany();
  const createContact = useCreateContact();
  const archiveDeal = useArchiveDeal();
  const approveDeal = useApproveDeal();
  const rejectDeal = useRejectDeal();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("0");
  const [stage, setStage] = useState<DealStage>("NEW_LEAD");
  const [companyId, setCompanyId] = useState<string>(NO_COMPANY);
  const [contactId, setContactId] = useState<string>(NO_CONTACT);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newContactFirstName, setNewContactFirstName] = useState("");
  const [newContactLastName, setNewContactLastName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role.name === "ADMIN";
  const assignableUsers = isAdmin
    ? users
    : users?.filter((u) => u.department?.id === currentUser?.department?.id);

  const canApprove =
    !!deal &&
    deal.approvalStatus === "PENDING" &&
    (isAdmin ||
      (currentUser?.role.name === "MANAGER" &&
        (deal.departmentId === null || deal.departmentId === currentUser?.department?.id)));

  useEffect(() => {
    if (deal) {
      setTitle(deal.title ?? "");
      setValue(String(deal.value ?? 0));
      setStage(deal.stage ?? defaultStage ?? "NEW_LEAD");
      setCompanyId(deal.companyId ?? NO_COMPANY);
      setContactId(deal.contactId ?? NO_CONTACT);
      setNewCompanyName("");
      setNewContactFirstName("");
      setNewContactLastName("");
      setNewContactEmail("");
      setOwnerId(deal.ownerId ?? currentUser?.id ?? "");
      setExpectedCloseDate(deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : "");
      setNotes(deal.notes ?? "");
    } else {
      setTitle("");
      setValue("0");
      setStage(defaultStage ?? "NEW_LEAD");
      setCompanyId(NO_COMPANY);
      setContactId(NO_CONTACT);
      setNewCompanyName("");
      setNewContactFirstName("");
      setNewContactLastName("");
      setNewContactEmail("");
      setOwnerId(currentUser?.id ?? "");
      setExpectedCloseDate("");
      setNotes("");
    }
    setError(null);
  }, [deal, defaultStage, currentUser]);

  const saving =
    createDeal.isPending ||
    updateDeal.isPending ||
    createCompany.isPending ||
    createContact.isPending;
  const archiving = archiveDeal.isPending;

  const addingCompany = companyId === NEW_COMPANY;
  const addingContact = contactId === NEW_CONTACT;

  const selectedCompany = companies?.find((c) => c.id === companyId);
  const selectedContact = contacts?.find((c) => c.id === contactId);
  const selectedOwner = users?.find((u) => u.id === ownerId);

  async function resolveRelatedRecords() {
    let resolvedCompanyId = addingCompany ? null : companyId === NO_COMPANY ? null : companyId;

    if (addingCompany) {
      const trimmedCompany = newCompanyName.trim();
      if (!trimmedCompany) throw new Error("Company name is required");
      const company = await createCompany.mutateAsync({ name: trimmedCompany });
      resolvedCompanyId = company.id;
    }

    let resolvedContactId = addingContact ? null : contactId === NO_CONTACT ? null : contactId;

    if (addingContact) {
      const trimmedFirst = newContactFirstName.trim();
      const trimmedLast = newContactLastName.trim();
      if (!trimmedFirst || !trimmedLast) {
        throw new Error("New contact requires both a first and last name");
      }
      const contact = await createContact.mutateAsync({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: newContactEmail.trim() || undefined,
        companyId: resolvedCompanyId ?? undefined,
      });
      resolvedContactId = contact.id;
    }

    return { resolvedCompanyId, resolvedContactId };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Deal title is required");
      return;
    }

    const numValue = Math.max(0, Math.floor(Number(value) || 0));

    try {
      const { resolvedCompanyId, resolvedContactId } = await resolveRelatedRecords();

      const input = {
        title: trimmedTitle,
        value: numValue,
        stage,
        companyId: resolvedCompanyId,
        contactId: resolvedContactId,
        ownerId: ownerId || undefined,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
        notes: notes.trim() || null,
      };

      if (isEdit && deal) {
        await updateDeal.mutateAsync({ id: deal.id, input });
        toast.success(`Deal "${trimmedTitle}" updated successfully`);
      } else {
        await createDeal.mutateAsync(input);
        toast.success(`Deal "${trimmedTitle}" created in pipeline`);
      }
      onCreated?.();
      onBack();
    } catch (err: any) {
      const msg = err?.message || "Could not save deal";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleArchive() {
    if (!deal) return;
    if (!window.confirm(`Are you sure you want to archive "${deal.title}"?`)) return;
    try {
      await archiveDeal.mutateAsync(deal.id);
      toast.success("Deal archived");
      onCreated?.();
      onBack();
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive deal");
    }
  }

  async function handleApprove() {
    if (!deal) return;
    try {
      await approveDeal.mutateAsync(deal.id);
      toast.success("Deal approved");
      onCreated?.();
      onBack();
    } catch (err: any) {
      toast.error(err?.message || "Could not approve deal");
    }
  }

  async function handleReject() {
    if (!deal) return;
    const reason = window.prompt("Reason for rejection (optional):");
    try {
      // rejectDeal only accepts the deal id -- the backend doesn't have a
      // rejection-reason field yet, so `reason` is captured for the prompt
      // UX but not sent anywhere.
      void reason;
      await rejectDeal.mutateAsync(deal.id);
      toast.success("Deal rejected");
      onCreated?.();
      onBack();
    } catch (err: any) {
      toast.error(err?.message || "Could not reject deal");
    }
  }

  const isFormValid = title.trim().length > 0;

  return (
    <div className="min-h-screen bg-canvas text-foreground pb-20">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-panel/90 backdrop-blur-md border-b border-border-subtle px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-1.5 rounded-xl border-border-subtle bg-canvas/60 hover:bg-canvas text-xs font-semibold"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5">
                  CRM & Sales
                </Badge>
                <span className="text-xs text-text-dim">/</span>
                <span className="text-xs font-medium text-text-dim">
                  {isEdit ? "Edit Deal" : "New Pipeline Deal"}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-0.5">
                {isEdit ? `Edit Deal: ${deal?.title}` : "Create New Pipeline Deal"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              disabled={saving}
              className="text-xs font-semibold text-text-dim hover:text-foreground"
            >
              Cancel
            </Button>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleArchive}
                disabled={archiving || saving}
                className="text-xs font-semibold gap-1.5 rounded-xl"
              >
                {archiving ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                Archive Deal
              </Button>
            )}
            {canApprove && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  className="text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
                >
                  <XCircle className="size-3.5 mr-1" />
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl"
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  Approve Deal
                </Button>
              </>
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !isFormValid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl h-9 px-4 gap-1.5 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  {isEdit ? "Update Deal" : "Create Deal"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* Live Deal Summary Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-r from-panel via-panel/90 to-primary/5 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-2xl bg-primary/10 border-2 border-primary/20 grid place-items-center text-primary shadow-sm font-bold text-xl font-mono">
                ${(Number(value) || 0) >= 1000 ? `${((Number(value) || 0) / 1000).toFixed(0)}k` : Number(value) || 0}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">
                    {title.trim() ? title.trim() : "New Opportunity Deal"}
                  </h2>
                  <Badge className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border-primary/30">
                    {DEAL_STAGE_LABELS[stage]}
                  </Badge>
                  {selectedCompany && (
                    <Badge variant="secondary" className="text-[10px] font-medium gap-1">
                      <Building2 className="size-3" />
                      {selectedCompany.name}
                    </Badge>
                  )}
                  {deal?.approvalStatus === "PENDING" && (
                    <Badge variant="outline" className="text-[10px] font-semibold text-amber-500 border-amber-500/30 bg-amber-500/10">
                      Pending Manager Approval
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-text-dim mt-1 flex-wrap">
                  <span className="text-emerald-500 font-bold font-mono">
                    ${(Number(value) || 0).toLocaleString()} USD
                  </span>
                  {selectedOwner && (
                    <span>• Owner: {selectedOwner.firstName} {selectedOwner.lastName}</span>
                  )}
                  {expectedCloseDate && (
                    <span>• Target Close: {new Date(expectedCloseDate).toLocaleDateString()}</span>
                  )}
                  {selectedContact && (
                    <span>• Lead: {selectedContact.firstName} {selectedContact.lastName}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive flex items-center gap-2">
            <Info className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Deal Title, Value, Stage, and Company/Contact */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deal Identity & Financial Value */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 grid place-items-center text-primary">
                    <DollarSign className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold">Deal Scope & Value</h3>
                </div>
                <span className="text-[11px] text-text-dim font-medium">* Required fields</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Deal Title *</Label>
                <Input
                  placeholder="e.g. Acme Corp Enterprise Cloud Transformation 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="rounded-xl border-border-subtle bg-canvas/60 text-xs font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Estimated Deal Value ($ USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-sm font-mono font-bold text-foreground"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {VALUE_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setValue(String(val))}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        value === String(val)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-canvas/60 text-text-dim border-border-subtle hover:text-foreground"
                      }`}
                    >
                      ${(val / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pipeline Stage Progression Cards */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-indigo-500/10 grid place-items-center text-indigo-500">
                    <TrendingUp className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold">Pipeline Stage</h3>
                </div>
                <span className="text-[11px] text-text-dim font-medium">Controls CRM kanban position</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEAL_STAGES.map((s) => (
                  <div
                    key={s}
                    onClick={() => setStage(s)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      stage === s
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border-subtle bg-canvas/40 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{DEAL_STAGE_LABELS[s]}</span>
                      {stage === s && <Check className="size-3.5 text-primary" />}
                    </div>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      {STAGE_DESCRIPTIONS[s]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Description */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-3 shadow-2xs">
              <Label className="text-xs font-semibold">Deal Notes & Commercial Terms</Label>
              <Textarea
                placeholder="Add background, meeting outcomes, custom contract clauses, or next steps..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="rounded-xl border-border-subtle bg-canvas/60 text-xs leading-relaxed resize-none"
              />
            </div>

            {/* Activity Timeline (Edit Mode) -- DealActivityTimeline fetches
                its own activities via useActivities(dealId), Deal itself
                has no activities field. */}
            {isEdit && deal && (
              <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-3 shadow-2xs">
                <h3 className="text-sm font-bold">Deal Activity Timeline</h3>
                <DealActivityTimeline dealId={deal.id} dealContactId={deal.contactId} />
              </div>
            )}
          </div>

          {/* Right Column: Company, Contact, Owner, Close Date */}
          <div className="space-y-6">
            {/* Account & Contact Relationships */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-emerald-500/10 grid place-items-center text-emerald-500">
                  <Building2 className="size-4" />
                </div>
                <h3 className="text-sm font-bold">Account & Contact</h3>
              </div>

              {/* Company Picker / Inline Create */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Associated Company</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger className="w-full rounded-xl border-border-subtle bg-canvas/60 text-xs">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMPANY}>No company</SelectItem>
                    <SelectItem value={NEW_COMPANY} className="text-primary font-bold">
                      + Create new company inline...
                    </SelectItem>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {addingCompany && (
                  <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-1.5">
                    <Label className="text-[11px] font-semibold text-primary">New Company Name *</Label>
                    <Input
                      placeholder="e.g. Global Tech Solutions Inc."
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      required
                      className="rounded-lg border-border-subtle bg-canvas text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Contact Picker / Inline Create */}
              <div className="space-y-2 pt-1 border-t border-border-subtle">
                <Label className="text-xs font-semibold">Primary Contact / Decision Maker</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger className="w-full rounded-xl border-border-subtle bg-canvas/60 text-xs">
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>No contact</SelectItem>
                    <SelectItem value={NEW_CONTACT} className="text-primary font-bold">
                      + Create new contact inline...
                    </SelectItem>
                    {contacts?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} {c.company?.name ? `(${c.company.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {addingContact && (
                  <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                    <span className="text-[11px] font-bold text-primary block">New Contact Details</span>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="First name *"
                        value={newContactFirstName}
                        onChange={(e) => setNewContactFirstName(e.target.value)}
                        required
                        className="rounded-lg border-border-subtle bg-canvas text-xs"
                      />
                      <Input
                        placeholder="Last name *"
                        value={newContactLastName}
                        onChange={(e) => setNewContactLastName(e.target.value)}
                        required
                        className="rounded-lg border-border-subtle bg-canvas text-xs"
                      />
                    </div>
                    <Input
                      type="email"
                      placeholder="Work email address"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      className="rounded-lg border-border-subtle bg-canvas text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Ownership & Target Close Date */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-amber-500/10 grid place-items-center text-amber-500">
                  <UserCheck className="size-4" />
                </div>
                <h3 className="text-sm font-bold">Ownership & Timeline</h3>
              </div>

              {/* Deal Owner */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Deal Owner</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger className="w-full rounded-xl border-border-subtle bg-canvas/60 text-xs">
                    <SelectValue placeholder="Select sales owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.department?.name ?? "General"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Close Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Expected Close Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                  <Input
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
