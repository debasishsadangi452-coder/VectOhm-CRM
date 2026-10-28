import { useState, useMemo, useEffect } from "react";
import {
  Mail,
  Sparkles,
  CheckCircle2,
  Building2,
  Users,
  Search,
  Check,
  Send,
  Loader2,
  FileText,
  AlertCircle,
  Eye,
  ChevronRight,
  ChevronLeft,
  Crown,
  Briefcase,
  MapPin,
  Flame,
  Layers,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { useAutomateIntentEmail } from "@/hooks/use-hiring-signals";
import type { IntentHiringLead } from "@/lib/api/hiring-signals";
import type { EmailTemplate } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

interface IntentEmailAutomateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: IntentHiringLead[];
  defaultSelectedLeadIds?: string[];
  targetRole?: string;
  targetLocation?: string;
}

/**
 * Replaces placeholders {{companyName}}, {{firstName}}, {{lastName}}, {{name}},
 * {{title}}, {{jobTitle}}, {{salary}}, {{location}} with exact lead values.
 */
function interpolateLeadCredentials(templateText: string, lead: IntentHiringLead): string {
  if (!templateText) return "";

  const firstName =
    lead.decisionMaker?.firstName?.trim() ||
    lead.decisionMaker?.name?.trim().split(/\s+/)[0] ||
    "Hiring Manager";
  const lastName =
    lead.decisionMaker?.lastName?.trim() ||
    lead.decisionMaker?.name?.trim().split(/\s+/).slice(1).join(" ") ||
    "";
  const fullName = lead.decisionMaker?.name?.trim() || "Hiring Team";
  const title = lead.decisionMaker?.title?.trim() || "Leadership";
  const companyName = lead.companyName?.trim() || "your organization";
  const jobTitle = lead.jobTitle?.trim() || "the open role";
  const salary = lead.salary?.trim() || "Competitive";
  const location = lead.companyLocation?.trim() || "your office";

  const replacements: Record<string, string> = {
    companyname: companyName,
    company: companyName,
    firstname: firstName,
    lastname: lastName,
    name: fullName,
    title: title,
    jobtitle: jobTitle,
    role: jobTitle,
    salary: salary,
    location: location,
  };

  return templateText.replace(/\{\{\s*(\w+)\s*\}\}/gi, (match, key) => {
    const lowerKey = key.toLowerCase();
    return lowerKey in replacements ? replacements[lowerKey] : match;
  });
}

export function IntentEmailAutomateDialog({
  open,
  onOpenChange,
  leads,
  defaultSelectedLeadIds,
  targetRole,
  targetLocation,
}: IntentEmailAutomateDialogProps) {
  const { data: templates = [], isLoading: templatesLoading } = useEmailTemplates();
  const automateMutation = useAutomateIntentEmail();

  // Wizard Steps: "template" -> "companies" -> "preview"
  const [activeStep, setActiveStep] = useState<"template" | "companies" | "preview">("template");

  // Selected Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSearch, setTemplateSearch] = useState("");

  // Selected Companies
  const [selectedLeadIds, setSelectedLeadIds] = useState<Record<string, boolean>>({});
  const [companySearch, setCompanySearch] = useState("");

  // Preview lead index
  const [previewLeadId, setPreviewLeadId] = useState<string>("");

  // Initialize selected lead IDs when leads or defaultSelectedLeadIds change
  useEffect(() => {
    if (open) {
      if (defaultSelectedLeadIds && defaultSelectedLeadIds.length > 0) {
        const initial: Record<string, boolean> = {};
        for (const id of defaultSelectedLeadIds) {
          initial[id] = true;
        }
        setSelectedLeadIds(initial);
      } else {
        // Select all by default
        const initial: Record<string, boolean> = {};
        for (const l of leads) {
          if (l.decisionMaker?.email) {
            initial[l.id] = true;
          }
        }
        // If none had verified emails, select all anyway
        if (Object.keys(initial).length === 0) {
          for (const l of leads) initial[l.id] = true;
        }
        setSelectedLeadIds(initial);
      }

      // Default to first template if available and not selected
      if (templates.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(templates[0].id);
      }

      setActiveStep("template");
    }
  }, [open, leads, defaultSelectedLeadIds, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    );
  }, [templates, templateSearch]);

  const filteredLeads = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.companyName.toLowerCase().includes(q) ||
        l.jobTitle.toLowerCase().includes(q) ||
        (l.decisionMaker?.name ?? "").toLowerCase().includes(q) ||
        (l.decisionMaker?.email ?? "").toLowerCase().includes(q)
    );
  }, [leads, companySearch]);

  const selectedLeadsList = useMemo(
    () => leads.filter((l) => selectedLeadIds[l.id]),
    [leads, selectedLeadIds]
  );

  const allSelected = useMemo(
    () => leads.length > 0 && leads.every((l) => selectedLeadIds[l.id]),
    [leads, selectedLeadIds]
  );

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedLeadIds({});
    } else {
      const next: Record<string, boolean> = {};
      for (const l of leads) {
        next[l.id] = true;
      }
      setSelectedLeadIds(next);
    }
  }

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  // Active lead for personalized preview
  const currentPreviewLead = useMemo(() => {
    if (previewLeadId) {
      const found = selectedLeadsList.find((l) => l.id === previewLeadId);
      if (found) return found;
    }
    return selectedLeadsList[0] || leads[0];
  }, [selectedLeadsList, leads, previewLeadId]);

  // Interpolated preview strings
  const renderedSubject = useMemo(() => {
    if (!selectedTemplate || !currentPreviewLead) return "";
    return interpolateLeadCredentials(selectedTemplate.subject, currentPreviewLead);
  }, [selectedTemplate, currentPreviewLead]);

  const renderedBodyHtml = useMemo(() => {
    if (!selectedTemplate || !currentPreviewLead) return "";
    return interpolateLeadCredentials(selectedTemplate.bodyHtml, currentPreviewLead);
  }, [selectedTemplate, currentPreviewLead]);

  // Execute Send
  async function handleSendAutomatedEmails() {
    if (!selectedTemplateId) {
      toast.error("Please select an email template.");
      setActiveStep("template");
      return;
    }

    if (selectedLeadsList.length === 0) {
      toast.error("Please select at least one company to email.");
      setActiveStep("companies");
      return;
    }

    try {
      const leadsPayload = selectedLeadsList.map((l) => ({
        companyName: l.companyName,
        companyDomain: l.companyDomain,
        companyLocation: l.companyLocation,
        jobTitle: l.jobTitle,
        jobUrl: l.jobUrl,
        salary: l.salary,
        decisionMaker: l.decisionMaker
          ? {
              name: l.decisionMaker.name,
              firstName: l.decisionMaker.firstName,
              lastName: l.decisionMaker.lastName,
              title: l.decisionMaker.title,
              email: l.decisionMaker.email,
              linkedinUrl: l.decisionMaker.linkedinUrl,
            }
          : undefined,
      }));

      const res = await automateMutation.mutateAsync({
        templateId: selectedTemplateId,
        campaignName: `Intent leads: ${targetRole || "Hiring Roles"} (${new Date().toLocaleDateString()})`,
        appendSignature: true,
        leads: leadsPayload,
      });

      toast.success(
        `Emails queued for ${res.totalRecipients} companies. Follow progress in Email Campaigns.`
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to automate and send emails."
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-3xl border-border/80 shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-gradient-to-r from-card via-card to-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center shadow-md shadow-primary/25 shrink-0">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  Email selected leads
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {selectedLeadsList.length} Selected
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-text-dim mt-0.5">
                  Pick a template, choose the companies, and send once. It is queued as a campaign you can follow in Email Campaigns.
                </DialogDescription>
              </div>
            </div>

            {/* Step Navigation Tabs */}
            <div className="flex items-center gap-1 bg-canvas/80 p-1 rounded-xl border border-border/70 text-xs font-bold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveStep("template")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStep === "template"
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-dim hover:text-foreground hover:bg-card"
                }`}
              >
                1. Template
              </button>
              <button
                type="button"
                onClick={() => setActiveStep("companies")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStep === "companies"
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-dim hover:text-foreground hover:bg-card"
                }`}
              >
                2. Companies ({selectedLeadsList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveStep("preview")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeStep === "preview"
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-dim hover:text-foreground hover:bg-card"
                }`}
              >
                3. Live Preview
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ─── Step 1: Template Selection ─── */}
          {activeStep === "template" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-foreground">Select Outreach Template</h3>
                  <p className="text-xs text-text-dim">
                    Choose a template from your library. Variables like <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">{"{{companyName}}"}</code> and <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">{"{{jobTitle}}"}</code> will be filled automatically.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <Input
                    placeholder="Search templates…"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-xl"
                  />
                </div>
              </div>

              {templatesLoading ? (
                <div className="py-12 flex items-center justify-center text-text-dim gap-2">
                  <Loader2 className="size-5 animate-spin text-primary" /> Loading templates…
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border border-dashed border-border p-6 space-y-2">
                  <FileText className="size-8 mx-auto text-text-muted/60" />
                  <p className="text-sm font-semibold text-foreground">No templates found</p>
                  <p className="text-xs text-text-dim">
                    Create email templates under the Templates panel in Outreach to use them here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTemplates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                            : "border-border/80 bg-card hover:border-primary/40 hover:bg-card/90"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-xs font-bold text-foreground truncate block">
                              {tpl.name}
                            </span>
                            <span className="text-[11px] text-text-dim font-medium truncate block">
                              Subject: {tpl.subject}
                            </span>
                          </div>
                          <div
                            className={`size-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-primary text-white"
                                : "border border-border/80 text-transparent"
                            }`}
                          >
                            <Check className="size-3 stroke-[3]" />
                          </div>
                        </div>

                        {/* Preview Snippet */}
                        <div className="text-[11px] text-text-dim bg-canvas/70 p-2.5 rounded-xl border border-border-subtle line-clamp-2 leading-relaxed">
                          {tpl.bodyHtml.replace(/<[^>]+>/g, " ")}
                        </div>

                        {/* Tags for Detected Placeholders */}
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          {["companyName", "jobTitle", "firstName", "location"].map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-canvas border border-border-subtle text-text-muted"
                            >
                              {`{{${tag}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 2: Company Selection ─── */}
          {activeStep === "companies" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-foreground">Select Target Companies</h3>
                  <p className="text-xs text-text-dim">
                    Check the companies you wish to send emails to. Only checked companies will be emailed.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <Input
                      placeholder="Filter companies…"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="h-8 pl-8 text-xs rounded-xl"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-8 text-xs font-bold rounded-xl shrink-0"
                  >
                    {allSelected ? "Deselect All" : `Select All (${leads.length})`}
                  </Button>
                </div>
              </div>

              {/* Company List Table / Cards */}
              <div className="rounded-2xl border border-border-subtle bg-card overflow-hidden shadow-xs">
                <ScrollArea className="max-h-[440px]">
                  <div className="divide-y divide-border/60 pb-2">
                    {filteredLeads.map((lead) => {
                      const isChecked = Boolean(selectedLeadIds[lead.id]);
                      const hasEmail = Boolean(lead.decisionMaker?.email);
                      return (
                        <div
                          key={lead.id}
                          onClick={() => toggleLead(lead.id)}
                          className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer transition-colors ${
                            isChecked ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-canvas/50"
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleLead(lead.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-md mt-0.5 sm:mt-0"
                            />
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground">
                                  {lead.companyName}
                                </span>
                                {lead.companyDomain && (
                                  <span className="text-[11px] text-primary/80 font-medium font-mono">
                                    • {lead.companyDomain}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-text-dim flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                  <Briefcase className="size-3 text-amber-500 shrink-0" />
                                  {lead.jobTitle}
                                </span>
                                {lead.companyLocation && (
                                  <span className="text-text-muted">({lead.companyLocation})</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Decision Maker & Email Badge */}
                          <div className="flex flex-col sm:items-end items-start pl-7 sm:pl-0 gap-1 shrink-0">
                            {lead.decisionMaker ? (
                              <div className="flex items-center gap-1.5 sm:text-right">
                                <span className="text-xs font-semibold text-foreground">
                                  {lead.decisionMaker.name}
                                </span>
                                <span className="text-[10px] text-text-dim font-medium">
                                  ({lead.decisionMaker.title})
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] italic text-text-muted">
                                Leadership Team
                              </span>
                            )}

                            {hasEmail ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                                <Mail className="size-3" /> {lead.decisionMaker!.email}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                <AlertCircle className="size-3" /> No Direct Email
                              </span>
                            )}

                            {lead.decisionMaker?.phone && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 font-mono">
                                <Phone className="size-2.5" /> {lead.decisionMaker.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* ─── Step 3: Live Personalized Preview ─── */}
          {activeStep === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-foreground">Personalized Email Preview</h3>
                  <p className="text-xs text-text-dim">
                    Inspect how the chosen template automatically personalizes with exact company and decision maker credentials.
                  </p>
                </div>

                {/* Company Switcher Pill selector */}
                {selectedLeadsList.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text-dim shrink-0">Preview for:</span>
                    <select
                      value={currentPreviewLead?.id || ""}
                      onChange={(e) => setPreviewLeadId(e.target.value)}
                      className="h-8 text-xs font-semibold bg-canvas border border-border/80 rounded-xl px-2.5 text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      {selectedLeadsList.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.companyName} ({l.decisionMaker?.name || "Hiring Manager"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!selectedTemplate ? (
                <div className="p-8 text-center rounded-2xl border border-warning/30 bg-warning/5 text-warning space-y-2">
                  <AlertCircle className="size-6 mx-auto" />
                  <p className="text-xs font-bold">No template chosen yet</p>
                  <Button size="sm" onClick={() => setActiveStep("template")} className="text-xs font-bold h-8">
                    Select Template
                  </Button>
                </div>
              ) : !currentPreviewLead ? (
                <div className="p-8 text-center rounded-2xl border border-warning/30 bg-warning/5 text-warning space-y-2">
                  <AlertCircle className="size-6 mx-auto" />
                  <p className="text-xs font-bold">No companies selected</p>
                  <Button size="sm" onClick={() => setActiveStep("companies")} className="text-xs font-bold h-8">
                    Select Companies
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Email Headers Card */}
                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-muted">TO:</span>
                        <span className="font-semibold text-foreground">
                          {currentPreviewLead.decisionMaker?.name || "Hiring Manager"}
                        </span>
                        <span className="text-text-dim font-mono">
                          &lt;{currentPreviewLead.decisionMaker?.email || `outreach@${currentPreviewLead.companyDomain || "company.com"}`}&gt;
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {currentPreviewLead.companyName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-bold text-text-muted">SUBJECT:</span>
                      <span className="font-bold text-foreground text-sm">
                        {renderedSubject}
                      </span>
                    </div>
                  </div>

                  {/* Rendered Body Preview */}
                  <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="text-xs font-bold text-text-dim uppercase tracking-wider">
                        Rendered Body
                      </span>
                      <span className="text-[11px] text-text-dim">
                        Template: <span className="font-bold text-foreground">{selectedTemplate.name}</span>
                      </span>
                    </div>

                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-foreground"
                      dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border/60 bg-canvas flex items-center justify-between gap-3">
          <div>
            {activeStep !== "template" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setActiveStep(activeStep === "preview" ? "companies" : "template")
                }
                className="gap-1.5 text-xs font-bold rounded-xl h-9"
              >
                <ChevronLeft className="size-3.5" /> Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs font-semibold text-text-dim"
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeStep === "template" && (
              <Button
                type="button"
                disabled={!selectedTemplateId}
                onClick={() => setActiveStep("companies")}
                className="gap-1.5 text-xs font-bold rounded-xl h-9"
              >
                Next: Choose Companies <ChevronRight className="size-3.5" />
              </Button>
            )}

            {activeStep === "companies" && (
              <Button
                type="button"
                disabled={selectedLeadsList.length === 0}
                onClick={() => setActiveStep("preview")}
                className="gap-1.5 text-xs font-bold rounded-xl h-9"
              >
                Next: Live Preview <ChevronRight className="size-3.5" />
              </Button>
            )}

            <Button
              type="button"
              disabled={
                automateMutation.isPending ||
                !selectedTemplateId ||
                selectedLeadsList.length === 0
              }
              onClick={handleSendAutomatedEmails}
              className="gap-2 text-xs font-black text-white rounded-xl h-9 px-4 shadow-md shadow-primary/25 bg-gradient-to-r from-primary via-primary to-indigo-600 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              {automateMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending Emails…
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send to {selectedLeadsList.length} Companies
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
