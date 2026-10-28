import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DealActivityTimeline } from "@/components/deal-activity-timeline";
import { useApproveDeal, useArchiveDeal, useCreateDeal, useRejectDeal, useUpdateDeal } from "@/hooks/use-deals";
import { useCompanies, useCreateCompany } from "@/hooks/use-companies";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type Deal, type DealStage } from "@/lib/api/types";

const NO_COMPANY = "__none__";
const NO_CONTACT = "__none__";
// Sentinel Select values that swap the dropdown for an inline mini-form, so a
// rep logging a fresh lead can name the company and person here instead of
// abandoning the deal to go create them on the Companies/Contacts tabs first.
// The records are only actually created on submit -- cancelling this dialog
// leaves nothing behind.
const NEW_COMPANY = "__new__";
const NEW_CONTACT = "__new__";

interface DealFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal;
  defaultStage?: DealStage;
}

export function DealFormDialog({ open, onOpenChange, deal, defaultStage }: DealFormDialogProps) {
  const isEdit = !!deal;
  const currentUser = useAuthStore((s) => s.user);
  const { data: companies } = useCompanies(open);
  const { data: contacts } = useContacts(undefined, open);
  const { data: users } = useUsers(open);
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
  const [notice, setNotice] = useState<string | null>(null);

  // Non-Admins only get to reassign within their own department -- an Admin
  // legitimately needs to pick anyone from anywhere.
  const isAdmin = currentUser?.role.name === "ADMIN";
  const assignableUsers = isAdmin
    ? users
    : users?.filter((u) => u.department?.id === currentUser?.department?.id);

  // Deliberately narrower than "who can edit this deal" (assertCanMutate) --
  // no owner branch, matching the backend's assertCanApprove: the Employee
  // who requested the approval can't approve their own request.
  const canApprove =
    !!deal &&
    deal.approvalStatus === "PENDING" &&
    (isAdmin ||
      (currentUser?.role.name === "MANAGER" &&
        (deal.departmentId === null || deal.departmentId === currentUser?.department?.id)));

  useEffect(() => {
    if (!open) return;
    setTitle(deal?.title ?? "");
    setValue(String(deal?.value ?? 0));
    setStage(deal?.stage ?? defaultStage ?? "NEW_LEAD");
    setCompanyId(deal?.companyId ?? NO_COMPANY);
    setContactId(deal?.contactId ?? NO_CONTACT);
    setNewCompanyName("");
    setNewContactFirstName("");
    setNewContactLastName("");
    setNewContactEmail("");
    setOwnerId(deal?.ownerId ?? currentUser?.id ?? "");
    setExpectedCloseDate(deal?.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : "");
    setNotes(deal?.notes ?? "");
    setError(null);
    setNotice(null);
  }, [open, deal, defaultStage, currentUser]);

  const saving =
    createDeal.isPending ||
    updateDeal.isPending ||
    createCompany.isPending ||
    createContact.isPending;
  const archiving = archiveDeal.isPending;

  const addingCompany = companyId === NEW_COMPANY;
  const addingContact = contactId === NEW_CONTACT;

  // Creates whatever the rep typed inline, then hands back the ids the deal
  // should point at. Runs before the deal is saved, and the company is
  // resolved first so a new contact can be attached to it in the same pass.
  async function resolveRelatedRecords() {
    let resolvedCompanyId = addingCompany ? null : companyId === NO_COMPANY ? null : companyId;

    if (addingCompany) {
      const company = await createCompany.mutateAsync({ name: newCompanyName.trim() });
      resolvedCompanyId = company.id;
    }

    let resolvedContactId = addingContact ? null : contactId === NO_CONTACT ? null : contactId;

    if (addingContact) {
      const contact = await createContact.mutateAsync({
        firstName: newContactFirstName.trim(),
        lastName: newContactLastName.trim(),
        email: newContactEmail.trim() || null,
        // Link the person to whichever company this deal ended up on, new or
        // existing -- otherwise the rep has to go back and pair them by hand.
        companyId: resolvedCompanyId,
      });
      resolvedContactId = contact.id;
    }

    return { resolvedCompanyId, resolvedContactId };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (addingCompany && !newCompanyName.trim()) {
      setError("Enter a name for the new company, or pick one from the list.");
      return;
    }
    if (addingContact && !(newContactFirstName.trim() && newContactLastName.trim())) {
      setError("Enter a first and last name for the new contact, or pick one from the list.");
      return;
    }

    let related: { resolvedCompanyId: string | null; resolvedContactId: string | null };
    try {
      related = await resolveRelatedRecords();
    } catch {
      // Deliberately distinct from the deal-save error below: if this is what
      // failed, the deal was never attempted and nothing was written.
      setError("Could not create the new company or contact -- the deal wasn't saved.");
      return;
    }

    const input = {
      title,
      value: Number(value) || 0,
      stage,
      companyId: related.resolvedCompanyId,
      contactId: related.resolvedContactId,
      ownerId: ownerId || undefined,
      notes: notes || null,
      expectedCloseDate: expectedCloseDate || null,
    };
    try {
      if (isEdit && deal) {
        const result = await updateDeal.mutateAsync({ id: deal.id, input });
        // Value above the approval threshold from a plain Employee -- the
        // backend withheld the stage change instead of closing it directly.
        if (result.approvalStatus === "PENDING" && deal.approvalStatus !== "PENDING") {
          setNotice("Submitted for manager approval -- this deal will move to Closed Won once approved.");
          return;
        }
      } else {
        await createDeal.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save deal");
    }
  }

  async function handleArchive() {
    if (!deal) return;
    try {
      await archiveDeal.mutateAsync(deal.id);
      onOpenChange(false);
    } catch {
      setError("Could not archive deal");
    }
  }

  async function handleApprove() {
    if (!deal) return;
    try {
      await approveDeal.mutateAsync(deal.id);
      onOpenChange(false);
    } catch {
      setError("Could not approve this deal");
    }
  }

  async function handleReject() {
    if (!deal) return;
    try {
      await rejectDeal.mutateAsync(deal.id);
      onOpenChange(false);
    } catch {
      setError("Could not reject this deal");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Creation only in practice -- opening an existing deal navigates to
          /deals/$id, where the activity log has room to be a real table. */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit deal" : "New deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">Title</Label>
            <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 h-5">
                <Label>Company</Label>
                {addingCompany && (
                  <button
                    type="button"
                    onClick={() => setCompanyId(NO_COMPANY)}
                    className="text-[10px] text-text-dim hover:text-foreground flex items-center gap-0.5"
                  >
                    <X className="size-3" /> pick existing
                  </button>
                )}
              </div>
              {addingCompany ? (
                <Input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="New company name"
                  autoFocus
                />
              ) : (
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMPANY}>No company</SelectItem>
                    <SelectItem value={NEW_COMPANY}>+ Add new company</SelectItem>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 h-5">
                <Label>Contact</Label>
                {addingContact && (
                  <button
                    type="button"
                    onClick={() => setContactId(NO_CONTACT)}
                    className="text-[10px] text-text-dim hover:text-foreground flex items-center gap-0.5"
                  >
                    <X className="size-3" /> pick existing
                  </button>
                )}
              </div>
              {addingContact ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input
                      value={newContactFirstName}
                      onChange={(e) => setNewContactFirstName(e.target.value)}
                      placeholder="First name"
                      autoFocus
                    />
                    <Input
                      value={newContactLastName}
                      onChange={(e) => setNewContactLastName(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                  <Input
                    type="email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="Email (optional)"
                  />
                </div>
              ) : (
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>No contact</SelectItem>
                    <SelectItem value={NEW_CONTACT}>+ Add new contact</SelectItem>
                    {contacts?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          {(addingCompany || addingContact) && (
            <p className="text-[10px] text-text-dim -mt-2">
              {addingCompany && addingContact
                ? "The company and contact are created when you save this deal, and the contact is filed under the new company."
                : addingCompany
                  ? "The company is created when you save this deal."
                  : "The contact is created when you save this deal, filed under the company above."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
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
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea id="deal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {isEdit && deal && <DealActivityTimeline dealId={deal.id} />}

          {isEdit && deal?.approvalStatus === "PENDING" && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-xs text-warning">Pending approval to close as Won.</span>
              {canApprove && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleReject}
                    disabled={approveDeal.isPending || rejectDeal.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApprove}
                    disabled={approveDeal.isPending || rejectDeal.isPending}
                  >
                    {approveDeal.isPending ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {notice && <p className="text-sm text-warning">{notice}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Archive
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
