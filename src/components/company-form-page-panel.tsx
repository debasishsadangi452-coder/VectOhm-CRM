import React, { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  DollarSign,
  Globe,
  Info,
  Layers,
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
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCompany, useDeleteCompany, useUpdateCompany, useCompany } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import type { Company } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

interface CompanyFormPagePanelProps {
  onBack: () => void;
  onCreated?: (companyId?: string) => void;
  company?: Company;
  companyId?: string;
}

const INDUSTRY_PRESETS = [
  { id: "Technology & Software", icon: "💻" },
  { id: "Financial Services & Fintech", icon: "💳" },
  { id: "Healthcare & Life Sciences", icon: "🏥" },
  { id: "E-Commerce & Retail", icon: "🛍️" },
  { id: "Manufacturing & Logistics", icon: "🏭" },
  { id: "Professional Services & Consulting", icon: "👔" },
  { id: "Education & EdTech", icon: "🎓" },
  { id: "Media & Entertainment", icon: "🎬" },
  { id: "Real Estate & Construction", icon: "🏢" },
  { id: "Telecommunications", icon: "📡" },
];

const COMPANY_TIERS = [
  { id: "ENTERPRISE", label: "Enterprise (1000+)", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  { id: "MID_MARKET", label: "Mid-Market (100-999)", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { id: "GROWTH", label: "Growth / Scaleup (20-99)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { id: "STARTUP", label: "Early Stage Startup (1-19)", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
];

export function CompanyFormPagePanel({
  onBack,
  onCreated,
  company: initialCompany,
  companyId,
}: CompanyFormPagePanelProps) {
  const { data: fetchedCompany } = useCompany(companyId);
  const company = initialCompany || fetchedCompany;
  const isEdit = !!company || !!companyId;

  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  const { data: allContacts = [] } = useContacts();
  const { data: allDeals = [] } = useDeals();

  // Basic Details
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");

  // Additional CRM metadata stored or parsed from notes
  const [tier, setTier] = useState("GROWTH");
  const [location, setLocation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setDomain(company.domain ?? "");
      setIndustry(company.industry ?? "");
      setNotes(company.notes ?? "");

      // Extract metadata if formatted in notes
      if (company.notes?.includes("[META]")) {
        try {
          const metaStr = company.notes.split("[META]")[1]?.trim();
          if (metaStr) {
            const parsed = JSON.parse(metaStr);
            if (parsed.tier) setTier(parsed.tier);
            if (parsed.location) setLocation(parsed.location);
            if (parsed.linkedinUrl) setLinkedinUrl(parsed.linkedinUrl);
            if (parsed.employeeCount) setEmployeeCount(parsed.employeeCount);
            if (parsed.annualRevenue) setAnnualRevenue(parsed.annualRevenue);
            if (parsed.phone) setPhone(parsed.phone);
            if (parsed.email) setEmail(parsed.email);
            setNotes(company.notes.split("[META]")[0].trim());
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  }, [company]);

  // Associated items
  const associatedContacts = allContacts.filter((c) => c.company?.id === company?.id);
  const associatedDeals = allDeals.filter((d) => d.company?.id === company?.id);

  const saving = createCompany.isPending || updateCompany.isPending;

  // Auto clean domain helper
  const handleDomainChange = (val: string) => {
    let clean = val.trim().toLowerCase();
    clean = clean.replace(/^https?:\/\//, "");
    clean = clean.replace(/\/.*$/, "");
    setDomain(clean);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }

    setError(null);

    // Bundle extra metadata cleanly into notes or backend fields
    const metaObj = {
      tier,
      location: location.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
      employeeCount: employeeCount.trim() || undefined,
      annualRevenue: annualRevenue.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    };

    const hasMeta = Object.values(metaObj).some((v) => v !== undefined);
    const combinedNotes = hasMeta
      ? `${notes.trim() ? notes.trim() + "\n\n" : ""}[META] ${JSON.stringify(metaObj)}`
      : notes.trim() || null;

    const input = {
      name: name.trim(),
      domain: domain.trim() || null,
      industry: industry.trim() || null,
      notes: combinedNotes,
    };

    try {
      if (isEdit && company) {
        await updateCompany.mutateAsync({ id: company.id, input });
        toast.success("Company updated successfully");
      } else {
        const created = await createCompany.mutateAsync(input);
        toast.success("Company created successfully");
        if (onCreated) {
          onCreated(created?.id);
        }
      }
      onBack();
    } catch (err: any) {
      const msg = err?.message || "Failed to save company";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleDelete() {
    if (!company) return;
    setIsDeleting(true);
    try {
      await deleteCompany.mutateAsync(company.id);
      toast.success("Company deleted successfully");
      onBack();
    } catch (err: any) {
      toast.error("Failed to delete company: " + (err?.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-foreground pb-20 selection:bg-primary/20">
      {/* Top sticky action banner */}
      <div className="sticky top-0 z-30 bg-panel/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 text-text-dim hover:text-foreground -ml-2"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Companies</span>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
              <Building2 className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                {isEdit ? (company?.name || "Edit Company") : "New Company Account"}
                {domain && (
                  <Badge variant="outline" className="text-xs font-mono font-normal text-text-dim">
                    {domain}
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-text-dim">
                {isEdit
                  ? "Manage corporate profile, firmographics, and key contacts"
                  : "Create an organization profile linked across deals, contacts, and projects"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {isEdit ? "Save Changes" : "Create Company"}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Core Profile & Firmographics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Identity Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Company Overview & Identity
                  </h2>
                </div>
                <Badge variant="outline" className="text-[11px] font-medium bg-secondary/50">
                  Required Fields
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="comp-name" className="text-xs font-medium text-foreground">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="comp-name"
                    placeholder="e.g. Acme Corporation, Stripe, Vercel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="h-10 text-sm font-medium bg-secondary/40 border-border focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-domain" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Globe className="size-3.5 text-text-dim" />
                    Website / Web Domain
                  </Label>
                  <Input
                    id="comp-domain"
                    placeholder="e.g. stripe.com or https://stripe.com"
                    value={domain}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    className="h-10 text-sm font-mono bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-industry" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Tag className="size-3.5 text-text-dim" />
                    Primary Industry
                  </Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger id="comp-industry" className="h-10 text-sm bg-secondary/40 border-border">
                      <SelectValue placeholder="Select industry..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_PRESETS.map((ind) => (
                        <SelectItem key={ind.id} value={ind.id}>
                          <span className="mr-2">{ind.icon}</span>
                          {ind.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quick Industry Pills */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] text-text-dim uppercase tracking-wider block">Common Industry Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {INDUSTRY_PRESETS.slice(0, 6).map((ind) => (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => setIndustry(ind.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                        industry === ind.id
                          ? "bg-primary/20 border-primary text-primary font-medium shadow-sm"
                          : "bg-secondary/30 border-border text-text-dim hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <span>{ind.icon}</span>
                      <span>{ind.id.split("&")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Firmographics & Intelligence */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Firmographics & Corporate Scale
                  </h2>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-primary">
                  <Sparkles className="size-3.5" />
                  <span>CRM Account Intelligence</span>
                </div>
              </div>

              {/* Account Tier Selection */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-foreground">Organization Tier & Scale</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {COMPANY_TIERS.map((t) => {
                    const isSelected = tier === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTier(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? `${t.color} border-2 shadow-sm font-semibold`
                            : "bg-secondary/20 border-border text-text-dim hover:text-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <div className="text-xs font-bold">{t.id.replace("_", " ")}</div>
                        <div className="text-[10px] opacity-80 mt-0.5">{t.label.split("(")[1]?.replace(")", "") || ""}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="comp-emp-count" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Users className="size-3.5 text-text-dim" />
                    Employee Count / Headcount
                  </Label>
                  <Input
                    id="comp-emp-count"
                    placeholder="e.g. 250 employees or 50-100"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    className="h-10 text-sm bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-revenue" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-text-dim" />
                    Estimated Annual Revenue (ARR)
                  </Label>
                  <Input
                    id="comp-revenue"
                    placeholder="e.g. $10M - $25M USD"
                    value={annualRevenue}
                    onChange={(e) => setAnnualRevenue(e.target.value)}
                    className="h-10 text-sm bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-location" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-text-dim" />
                    Headquarters Location
                  </Label>
                  <Input
                    id="comp-location"
                    placeholder="e.g. San Francisco, CA or London, UK"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="h-10 text-sm bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-linkedin" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Linkedin className="size-3.5 text-text-dim" />
                    LinkedIn Profile URL
                  </Label>
                  <Input
                    id="comp-linkedin"
                    placeholder="e.g. linkedin.com/company/acme"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="h-10 text-sm bg-secondary/40 border-border"
                  />
                </div>
              </div>
            </div>

            {/* Corporate Contact Channels & Notes */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Direct Contact Info & Strategic Notes
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="comp-phone" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Phone className="size-3.5 text-text-dim" />
                    Main Office Phone
                  </Label>
                  <Input
                    id="comp-phone"
                    type="tel"
                    placeholder="e.g. +1 (555) 234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 text-sm bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-text-dim" />
                    Corporate Inquiries Email
                  </Label>
                  <Input
                    id="comp-email"
                    type="email"
                    placeholder="e.g. contact@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 text-sm bg-secondary/40 border-border"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="comp-notes" className="text-xs font-medium text-foreground">
                  Strategic Account Notes & Executive Context
                </Label>
                <Textarea
                  id="comp-notes"
                  placeholder="Record strategic priorities, key decision makers, tech stack notes, contract renewal cycles, or procurement guidelines..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="text-sm bg-secondary/40 border-border resize-none leading-relaxed"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2.5">
                <X className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Account Summary, Linked Relations, & Danger Zone */}
          <div className="space-y-6">
            {/* Live Preview Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Building2 className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Live Account Preview
                </h3>
              </div>

              <div className="flex items-start gap-4">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-secondary/30 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl shadow-inner shrink-0">
                  {name ? getInitials({ name }) : <Building2 className="size-7 opacity-50" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-bold text-foreground truncate">
                    {name || "Company Name"}
                  </h4>
                  <p className="text-xs text-text-dim truncate">
                    {domain ? domain : "No domain specified"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {industry && (
                      <Badge variant="secondary" className="text-[10px] font-medium py-0 px-2 bg-secondary/60">
                        {industry}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-medium py-0 px-2 text-primary border-primary/30">
                      {tier}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-text-dim pt-2 border-t border-border">
                {location && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-text-dim" /> Location
                    </span>
                    <span className="font-medium text-foreground">{location}</span>
                  </div>
                )}
                {employeeCount && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-text-dim" /> Headcount
                    </span>
                    <span className="font-medium text-foreground">{employeeCount}</span>
                  </div>
                )}
                {annualRevenue && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="size-3.5 text-text-dim" /> Revenue
                    </span>
                    <span className="font-medium text-foreground">{annualRevenue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Linked CRM Relations (Contacts & Deals) */}
            {isEdit && (
              <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                      Linked Portfolio
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" />
                        Contacts ({associatedContacts.length})
                      </span>
                    </div>
                    {associatedContacts.length === 0 ? (
                      <p className="text-xs text-text-dim italic bg-secondary/20 p-3 rounded-lg text-center">
                        No contacts linked yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {associatedContacts.map((c) => (
                          <div
                            key={c.id}
                            className="text-xs p-2 rounded-lg bg-secondary/30 border border-border flex items-center justify-between"
                          >
                            <span className="font-medium text-foreground truncate">
                              {c.firstName} {c.lastName}
                            </span>
                            <span className="text-[10px] text-text-dim font-mono">{c.email || c.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <DollarSign className="size-3.5 text-emerald-400" />
                        Deals ({associatedDeals.length})
                      </span>
                    </div>
                    {associatedDeals.length === 0 ? (
                      <p className="text-xs text-text-dim italic bg-secondary/20 p-3 rounded-lg text-center">
                        No active deals linked yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {associatedDeals.map((d) => (
                          <div
                            key={d.id}
                            className="text-xs p-2 rounded-lg bg-secondary/30 border border-border flex items-center justify-between"
                          >
                            <span className="font-medium text-foreground truncate">{d.title}</span>
                            <span className="font-mono text-emerald-400 font-semibold">
                              ${d.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Danger Zone */}
            {isEdit && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-destructive/20">
                  <Trash2 className="size-4 text-destructive" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                    Danger Zone
                  </h3>
                </div>
                <p className="text-xs text-text-dim leading-relaxed">
                  Deleting this company will unassign associated contacts and deals, leaving them unattached.
                </p>
                {showDeleteConfirm ? (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-destructive">
                      Are you sure you want to permanently delete this company?
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="w-full text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="w-full text-xs gap-1.5"
                      >
                        {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        Confirm Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Company Record
                  </Button>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
