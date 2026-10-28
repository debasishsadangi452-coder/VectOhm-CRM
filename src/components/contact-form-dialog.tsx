import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2, Sparkles, Linkedin } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateContact, useDeleteContact, useUpdateContact } from "@/hooks/use-contacts";
import { useCompanies, useCreateCompany } from "@/hooks/use-companies";
import { useEnrichContact } from "@/hooks/use-apollo";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api/client";
import type { Contact, LeadSource } from "@/lib/api/types";

const NO_COMPANY = "__none__";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
}

export function ContactFormDialog({ open, onOpenChange, contact }: ContactFormDialogProps) {
  const isEdit = !!contact;
  const { data: companies } = useCompanies(open);
  const createCompany = useCreateCompany();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const enrichContact = useEnrichContact();
  const currentUser = useAuthStore((s) => s.user);
  const canEnrich =
    currentUser?.role.name === "ADMIN" || currentUser?.department?.name === "Sales";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState<string>(NO_COMPANY);
  const [isCreatingNewCompany, setIsCreatingNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Apollo-derived metadata -- not user-editable, just displayed. Tracked
  // separately from the `contact` prop (a static snapshot from the parent's
  // table) so a successful enrich can update the dialog in place.
  const [source, setSource] = useState<LeadSource>("MANUAL");
  const [enrichedAt, setEnrichedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName(contact?.firstName ?? "");
    setLastName(contact?.lastName ?? "");
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    setTitle(contact?.title ?? "");
    setCompanyId(contact?.companyId ?? NO_COMPANY);
    setLocation(contact?.location ?? "");
    setWebsite(contact?.website ?? "");
    setLinkedinUrl(contact?.linkedinUrl ?? "");
    setCategory(contact?.category ?? "");
    setPriority(contact?.priority ?? "");
    setNotes(contact?.notes ?? "");
    setSource(contact?.source ?? "MANUAL");
    setEnrichedAt(contact?.enrichedAt ?? null);
    setError(null);
  }, [open, contact]);

  const saving = createContact.isPending || updateContact.isPending;
  const deleting = deleteContact.isPending;

  async function handleEnrich() {
    if (!contact) return;
    setError(null);
    try {
      const updated = await enrichContact.mutateAsync(contact.id);
      setEmail(updated.email ?? "");
      setTitle(updated.title ?? "");
      setLinkedinUrl(updated.linkedinUrl ?? "");
      setSource(updated.source);
      setEnrichedAt(updated.enrichedAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not enrich via Apollo");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let finalCompanyId = companyId === NO_COMPANY ? null : companyId;
    if (isCreatingNewCompany && newCompanyName.trim()) {
      try {
        const created = await createCompany.mutateAsync({ name: newCompanyName.trim() });
        finalCompanyId = created.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create company");
        return;
      }
    }

    const input = {
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      title: title || null,
      companyId: finalCompanyId,
      location: location || null,
      website: website || null,
      linkedinUrl: linkedinUrl || null,
      category: category || null,
      priority: priority || null,
      notes: notes || null,
    };
    try {
      if (isEdit && contact) {
        await updateContact.mutateAsync({ id: contact.id, input });
      } else {
        await createContact.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save contact");
    }
  }

  async function handleDelete() {
    if (!contact) return;
    try {
      await deleteContact.mutateAsync(contact.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete contact");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        {isEdit && (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 -mt-2 text-xs text-text-dim">
            <span
              className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                source === "APOLLO"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-canvas/50 border-border-subtle"
              }`}
            >
              {source === "APOLLO" ? "Apollo" : "Manual"}
            </span>
            {enrichedAt && <span>Enriched {new Date(enrichedAt).toLocaleDateString()}</span>}
            {linkedinUrl && (
              <a
                href={/^https?:\/\//i.test(linkedinUrl) ? linkedinUrl : `https://${linkedinUrl}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Linkedin className="size-3" /> Open LinkedIn
              </a>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-first-name">First name</Label>
              <Input
                id="contact-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-last-name">Last name</Label>
              <Input
                id="contact-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-title">Title</Label>
            <Input id="contact-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Company</Label>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNewCompany((prev) => !prev);
                  if (!isCreatingNewCompany) {
                    setCompanyId(NO_COMPANY);
                  }
                }}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                {isCreatingNewCompany ? "Choose existing" : "+ Enter new company"}
              </button>
            </div>
            {isCreatingNewCompany ? (
              <Input
                placeholder="Type company name (e.g. At the Margins)"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                autoFocus
              />
            ) : (
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
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-location">Location</Label>
              <Input id="contact-location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-website">Website</Label>
              <Input id="contact-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-linkedin">LinkedIn URL</Label>
            <Input
              id="contact-linkedin"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="linkedin.com/in/..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-category">Category</Label>
              <Input id="contact-category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-priority">Priority</Label>
              <Input
                id="contact-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="e.g. A+, A, B"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-notes">Notes</Label>
            <Input id="contact-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete
                </Button>
                {canEnrich && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEnrich}
                    disabled={enrichContact.isPending}
                    title="Reveal verified contact info via Apollo"
                  >
                    {enrichContact.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Enrich
                  </Button>
                )}
              </div>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
