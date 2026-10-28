import { useState } from "react";
import {
  Sparkles,
  Mail,
  Check,
  Plus,
  Loader2,
  Copy,
  Briefcase,
  TrendingUp,
  Send,
  Users,
  Building2,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BUSINESS_EMAIL_PRESETS,
  type BusinessTemplatePreset,
} from "@/lib/business-email-templates";
import { useCreateEmailTemplate } from "@/hooks/use-email-templates";
import type { EmailTemplate } from "@/lib/api/types";

interface BusinessTemplatesLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTemplates?: EmailTemplate[];
  onSelectTemplate?: (preset: BusinessTemplatePreset) => void;
}

const CATEGORIES = [
  "All",
  "Cold Outreach",
  "Hiring & Talent",
  "Growth Signals",
  "Follow-Ups",
  "Partnership & Demos",
] as const;

export function BusinessTemplatesLibraryDialog({
  open,
  onOpenChange,
  existingTemplates = [],
  onSelectTemplate,
}: BusinessTemplatesLibraryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activePresetId, setActivePresetId] = useState<string>(BUSINESS_EMAIL_PRESETS[0].id);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const createTemplate = useCreateEmailTemplate();

  const filteredPresets = BUSINESS_EMAIL_PRESETS.filter(
    (p) => selectedCategory === "All" || p.category === selectedCategory
  );

  const activePreset =
    BUSINESS_EMAIL_PRESETS.find((p) => p.id === activePresetId) ||
    BUSINESS_EMAIL_PRESETS[0];

  const existingNames = new Set(existingTemplates.map((t) => t.name.toLowerCase()));

  async function handleAddPreset(preset: BusinessTemplatePreset) {
    setAddingId(preset.id);
    try {
      await createTemplate.mutateAsync({
        name: preset.name,
        subject: preset.subject,
        bodyHtml: preset.bodyHtml,
        appendSignature: preset.appendSignature,
      });
      toast.success(`"${preset.name}" added to your email templates!`);
    } catch {
      toast.error(`Could not add "${preset.name}".`);
    } finally {
      setAddingId(null);
    }
  }

  async function handleAddAllMissing() {
    setIsAddingAll(true);
    let addedCount = 0;
    try {
      for (const preset of BUSINESS_EMAIL_PRESETS) {
        if (!existingNames.has(preset.name.toLowerCase())) {
          await createTemplate.mutateAsync({
            name: preset.name,
            subject: preset.subject,
            bodyHtml: preset.bodyHtml,
            appendSignature: preset.appendSignature,
          });
          addedCount++;
        }
      }
      if (addedCount > 0) {
        toast.success(`Successfully added ${addedCount} business email templates!`);
      } else {
        toast.info("All business templates are already in your library.");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to add all templates.");
    } finally {
      setIsAddingAll(false);
    }
  }

  function handleUseInForm(preset: BusinessTemplatePreset) {
    if (onSelectTemplate) {
      onSelectTemplate(preset);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 gap-5">
        <DialogHeader className="space-y-1.5 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-2xl bg-gradient-to-br from-primary/20 to-indigo-500/20 text-primary flex items-center justify-center border border-primary/30">
                <Sparkles className="size-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                  English Business Email Template Library
                </DialogTitle>
                <DialogDescription className="text-xs text-text-dim">
                  Proven, high-converting B2B sales templates formatted with dynamic merge fields.
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleAddAllMissing}
              disabled={isAddingAll || createTemplate.isPending}
              className="gap-2 text-xs font-bold text-white bg-gradient-to-r from-primary via-primary to-indigo-600 shadow-md shadow-primary/25 rounded-xl h-9 px-4 shrink-0"
            >
              {isAddingAll ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Adding Templates…
                </>
              ) : (
                <>
                  <CheckCheck className="size-3.5" />
                  Add All to Templates
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-xs shadow-primary/25"
                  : "bg-canvas/80 text-text-dim hover:text-foreground hover:bg-card border border-border/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Two Column Layout: Template List + Live Detail & Preview */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 flex-1 overflow-hidden">
          {/* Left Column: List */}
          <ScrollArea className="md:col-span-5 rounded-2xl border border-border/80 bg-canvas/40 p-2 h-[420px]">
            <div className="space-y-2 pr-2">
              {filteredPresets.map((preset) => {
                const isSelected = activePresetId === preset.id;
                const isAlreadyAdded = existingNames.has(preset.name.toLowerCase());
                const isAddingThis = addingId === preset.id;

                return (
                  <div
                    key={preset.id}
                    onClick={() => setActivePresetId(preset.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 text-left ${
                      isSelected
                        ? "bg-card border-primary ring-2 ring-primary/20 shadow-xs"
                        : "bg-card/70 border-border/70 hover:bg-card hover:border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-1">
                        {preset.name}
                      </h4>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-primary/10 text-primary shrink-0 border border-primary/20">
                        {preset.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-dim line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px]">
                      <span className="text-text-muted">Dynamic merge tags</span>
                      {isAlreadyAdded ? (
                        <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                          <Check className="size-3" /> In Library
                        </span>
                      ) : (
                        <span className="text-primary font-bold">Available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Right Column: Preview & Action */}
          <div className="md:col-span-7 flex flex-col rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 h-[420px] overflow-hidden">
            <div className="space-y-1 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">{activePreset.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {activePreset.category}
                </span>
              </div>
              <p className="text-xs text-text-dim">{activePreset.description}</p>
            </div>

            <div className="space-y-1.5 shrink-0 bg-canvas/80 p-3 rounded-xl border border-border/70">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Email Subject
              </span>
              <p className="text-xs font-semibold text-foreground select-all">
                {activePreset.subject}
              </p>
            </div>

            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider shrink-0">
                Email Body Text
              </span>
              <ScrollArea className="flex-1 rounded-xl border border-border/70 bg-canvas/80 p-3">
                <pre className="text-xs font-sans text-foreground whitespace-pre-wrap leading-relaxed select-all">
                  {activePreset.bodyHtml}
                </pre>
              </ScrollArea>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 shrink-0">
              <div className="text-[10px] text-text-dim">
                Merge tags: <code>{"{{firstName}}"}</code>, <code>{"{{companyName}}"}</code>
              </div>

              <div className="flex items-center gap-2">
                {onSelectTemplate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUseInForm(activePreset)}
                    className="text-xs font-bold rounded-xl h-9"
                  >
                    Insert into Form
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => handleAddPreset(activePreset)}
                  disabled={
                    addingId === activePreset.id ||
                    existingNames.has(activePreset.name.toLowerCase())
                  }
                  className={`text-xs font-bold rounded-xl h-9 gap-1.5 ${
                    existingNames.has(activePreset.name.toLowerCase())
                      ? "bg-emerald-600/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-600/20"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  {addingId === activePreset.id ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Adding…
                    </>
                  ) : existingNames.has(activePreset.name.toLowerCase()) ? (
                    <>
                      <Check className="size-3.5" /> In Your Templates
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" /> Add Template
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
