import React, { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  Globe,
  Info,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCreateContact, useDeleteContact, useUpdateContact } from "@/hooks/use-contacts";
import { useCompanies, useCreateCompany } from "@/hooks/use-companies";
import { useEnrichContact } from "@/hooks/use-apollo";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api/client";
import type { Contact, LeadSource } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

const NO_COMPANY = "__none__";

const PRIORITY_PRESETS = [
  { label: "A+ / Urgent", value: "A+", tone: "text-rose-500 border-rose-500/30 bg-rose-500/10" },
  { label: "A / High", value: "A", tone: "text-amber-500 border-amber-500/30 bg-amber-500/10" },
  { label: "B / Normal", value: "B", tone: "text-blue-500 border-blue-500/30 bg-blue-500/10" },
  { label: "C / Low", value: "C", tone: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
];

const CATEGORY_PRESETS = [
  "Executive / C-Level",
  "Decision Maker",
  "Technical Lead",
  "Procurement / Buyer",
  "Champion / Influencer",
  "Inbound Lead",
];

interface ContactFormPagePanelProps {
  onBack: () => void;
  onCreated?: () => void;
  contact?: Contact;
}

export function ContactFormPagePanel({ onBack, onCreated, contact }: ContactFormPagePanelProps) {
  const isEdit = !!contact;
  const { data: companies } = useCompanies();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const enrichContact = useEnrichContact();
  const createCompany = useCreateCompany();

  const currentUser = useAuthStore((s) => s.user);
  const canEnrich = currentUser?.role.name === "ADMIN" || currentUser?.department?.name === "Sales";

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
  const [source, setSource] = useState<LeadSource>("MANUAL");
  const [enrichedAt, setEnrichedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contact) {
      setFirstName(contact.firstName ?? "");
      setLastName(contact.lastName ?? "");
      setEmail(contact.email ?? "");
      setPhone(contact.phone ?? "");
      setTitle(contact.title ?? "");
      setCompanyId(contact.companyId ?? NO_COMPANY);
      setLocation(contact.location ?? "");
      setWebsite(contact.website ?? "");
      setLinkedinUrl(contact.linkedinUrl ?? "");
      setCategory(contact.category ?? "");
      setPriority(contact.priority ?? "");
      setNotes(contact.notes ?? "");
      setSource(contact.source ?? "MANUAL");
      setEnrichedAt(contact.enrichedAt ?? null);
    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setTitle("");
      setCompanyId(NO_COMPANY);
      setLocation("");
      setWebsite("");
      setLinkedinUrl("");
      setCategory("");
      setPriority("");
      setNotes("");
      setSource("MANUAL");
      setEnrichedAt(null);
    }
    setError(null);
  }, [contact]);

  const saving = createContact.isPending || updateContact.isPending;
  const deleting = deleteContact.isPending;

  const selectedCompany = companies?.find((c) => c.id === companyId);

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
      toast.success("Contact successfully enriched via Apollo Intelligence.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not enrich contact via Apollo";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError("First and last name are required");
      return;
    }

    let finalCompanyId = companyId === NO_COMPANY ? null : companyId;
    if (isCreatingNewCompany && newCompanyName.trim()) {
      try {
        const created = await createCompany.mutateAsync({
          name: newCompanyName.trim(),
          domain: website.trim() ? website.replace(/^https?:\/\//i, "").split("/")[0] : null,
        });
        finalCompanyId = created.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not create company. Please check the name.";
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    const input = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: email.trim() || null,
      phone: phone.trim() || null,
      title: title.trim() || null,
      companyId: finalCompanyId,
      location: location.trim() || null,
      website: website.trim() || null,
      linkedinUrl: linkedinUrl.trim() || null,
      category: category.trim() || null,
      priority: priority.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (isEdit && contact) {
        await updateContact.mutateAsync({ id: contact.id, input });
        toast.success(`Contact ${trimmedFirst} ${trimmedLast} updated successfully`);
      } else {
        await createContact.mutateAsync(input);
        toast.success(`Contact ${trimmedFirst} ${trimmedLast} added to CRM`);
      }
      onCreated?.();
      onBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save contact. Please check your inputs.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleDelete() {
    if (!contact) return;
    if (!window.confirm(`Are you sure you want to delete ${contact.firstName} ${contact.lastName}?`)) {
      return;
    }
    try {
      await deleteContact.mutateAsync(contact.id);
      toast.success("Contact deleted from CRM");
      onCreated?.();
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete contact");
    }
  }

  const isFormValid = firstName.trim().length > 0 && lastName.trim().length > 0;

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
                  {isEdit ? "Edit Contact" : "Add New Contact"}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-0.5">
                {isEdit ? `Edit Contact: ${contact?.firstName} ${contact?.lastName}` : "Add New Contact to CRM"}
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
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="text-xs font-semibold gap-1.5 rounded-xl"
                >
                  {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Delete Contact
                </Button>
                {canEnrich && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnrich}
                    disabled={enrichContact.isPending || saving}
                    className="text-xs font-semibold gap-1.5 rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
                  >
                    {enrichContact.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Enrich with Apollo
                  </Button>
                )}
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
                  {isEdit ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
                  {isEdit ? "Update Contact" : "Create Contact"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* Live Contact Preview Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-r from-panel via-panel/90 to-primary/5 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 rounded-2xl border-2 border-primary/20 shadow-sm">
                <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-bold text-lg">
                  {firstName || lastName
                    ? getInitials({ firstName: firstName || "N", lastName: lastName || "C" })
                    : "NC"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">
                    {firstName.trim() || lastName.trim()
                      ? `${firstName.trim()} ${lastName.trim()}`
                      : "New Contact Name"}
                  </h2>
                  {title && (
                    <Badge variant="secondary" className="text-[10px] font-medium gap-1">
                      <Briefcase className="size-3" />
                      {title}
                    </Badge>
                  )}
                  {selectedCompany && (
                    <Badge variant="outline" className="text-[10px] font-medium gap-1 border-border-subtle">
                      <Building2 className="size-3" />
                      {selectedCompany.name}
                    </Badge>
                  )}
                  {priority && (
                    <Badge className="text-[10px] font-bold bg-amber-500/15 text-amber-500 border-amber-500/30">
                      {priority}
                    </Badge>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      source === "APOLLO"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-canvas/60 text-text-dim border border-border-subtle"
                    }`}
                  >
                    {source === "APOLLO" ? "Apollo Verified" : "Manual Entry"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-dim mt-1 flex-wrap">
                  {email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3 text-primary" />
                      {email}
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3 text-emerald-500" />
                      {phone}
                    </span>
                  )}
                  {location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3 text-text-dim" />
                      {location}
                    </span>
                  )}
                  {enrichedAt && (
                    <span className="text-[10px] text-primary">
                      • Enriched {new Date(enrichedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {linkedinUrl && (
              <a
                href={/^https?:\/\//i.test(linkedinUrl) ? linkedinUrl : `https://${linkedinUrl}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 px-3 py-1.5 rounded-xl transition-colors"
              >
                <Linkedin className="size-3.5" />
                View LinkedIn
                <ExternalLink className="size-3 opacity-70" />
              </a>
            )}
          </div>
        </div>

        {/* Error Callout */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive flex items-center gap-2">
            <Info className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Identity, Contact Details, Company */}
          <div className="lg:col-span-2 space-y-6">
            {/* Identity & Basic Info */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 grid place-items-center text-primary">
                    <User className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold">Contact Identity & Role</h3>
                </div>
                <span className="text-[11px] text-text-dim font-medium">* Required fields</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">First Name *</Label>
                  <Input
                    placeholder="e.g. David"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Last Name *</Label>
                  <Input
                    placeholder="e.g. Feinberg"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Job Title / Designation</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                  <Input
                    placeholder="e.g. Chairman & CEO / Head of Operations"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Reach & Communication */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-emerald-500/10 grid place-items-center text-emerald-500">
                  <Mail className="size-4" />
                </div>
                <h3 className="text-sm font-bold">Direct Communication Channels</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                    <Input
                      type="email"
                      placeholder="david.feinberg@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Phone / Direct Dial</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                    <Input
                      type="tel"
                      placeholder="+1 (555) 234-5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">LinkedIn Profile URL</Label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                    <Input
                      placeholder="linkedin.com/in/username"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Location / Geographic Region</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                    <Input
                      placeholder="e.g. Austin, Texas, USA"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Internal Notes & History */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-3 shadow-2xs">
              <Label className="text-xs font-semibold">Internal Relationship Notes & Background</Label>
              <Textarea
                placeholder="Add contextual notes, key conversation takeaways, or special relationship background for this prospect..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="rounded-xl border-border-subtle bg-canvas/60 text-xs leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Right Column: Company, Classification, Intelligence */}
          <div className="space-y-6">
            {/* Account / Company Assignment */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-indigo-500/10 grid place-items-center text-indigo-500">
                  <Building2 className="size-4" />
                </div>
                <h3 className="text-sm font-bold">Company & Organization</h3>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Associated Company</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewCompany((prev) => !prev);
                      if (!isCreatingNewCompany) {
                        setCompanyId(NO_COMPANY);
                      }
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {isCreatingNewCompany ? "Choose from existing list" : "+ Enter new company"}
                  </button>
                </div>

                {isCreatingNewCompany ? (
                  <div className="space-y-1.5">
                    <Input
                      placeholder="Type company name (e.g. At the Margins)"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="rounded-xl border-border-subtle bg-canvas/60 text-xs"
                      autoFocus
                    />
                    <p className="text-[10px] text-text-dim">
                      Will create and link &quot;{newCompanyName.trim() || "new company"}&quot; to this contact.
                    </p>
                  </div>
                ) : (
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger className="w-full rounded-xl border-border-subtle bg-canvas/60 text-xs">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COMPANY}>No company / Individual account</SelectItem>
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.industry ? `(${c.industry})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Corporate Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                  <Input
                    placeholder="https://company.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Lead Classification & Priority */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-amber-500/10 grid place-items-center text-amber-500">
                  <Flame className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Classification & Priority</h3>
                  <p className="text-[10px] text-text-dim">Used for lead scoring and triage</p>
                </div>
              </div>

              {/* Priority Chips */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Priority Tier</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left flex items-center justify-between ${
                        priority === p.value
                          ? `${p.tone} shadow-xs ring-1 ring-primary/30`
                          : "border-border-subtle bg-canvas/40 text-text-dim hover:text-foreground"
                      }`}
                    >
                      <span>{p.label}</span>
                      {priority === p.value && <Check className="size-3.5" />}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Or custom priority tag..."
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="rounded-xl border-border-subtle bg-canvas/60 text-xs mt-1"
                />
              </div>

              {/* Category selector */}
              <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                <Label className="text-xs font-semibold">Contact Category / Role Type</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full rounded-xl border-border-subtle bg-canvas/60 text-xs">
                    <SelectValue placeholder="Select lead category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_PRESETS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Or custom category..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border-border-subtle bg-canvas/60 text-xs mt-1"
                />
              </div>
            </div>

            {/* Verification & Intelligence Card */}
            <div className="rounded-2xl border border-border-subtle bg-canvas/40 p-4 space-y-2">
              <span className="text-[11px] font-bold text-foreground block">Data Integrity & Sync</span>
              <div className="space-y-1.5 text-[11px] text-text-dim">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`size-3.5 ${firstName && lastName ? "text-emerald-500" : "text-slate-400"}`} />
                  <span>Contact Full Name verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`size-3.5 ${email ? "text-emerald-500" : "text-slate-400"}`} />
                  <span>Direct email populated</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`size-3.5 ${selectedCompany ? "text-emerald-500" : "text-slate-400"}`} />
                  <span>Account / Company attached</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
