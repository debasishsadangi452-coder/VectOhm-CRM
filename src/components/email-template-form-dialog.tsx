import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, Loader2, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useUpdateEmailTemplate,
} from "@/hooks/use-email-templates";
import { renderMergeFields } from "@/lib/merge-fields";
import { plainTextToHtml } from "@/lib/plain-text-to-html";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignature } from "@/hooks/use-email-signature";
import { BUSINESS_EMAIL_PRESETS } from "@/lib/business-email-templates";
import type { EmailTemplate, EmailTemplateVisibility } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth-store";
import { AiTemplateWriterDialog } from "@/components/email-ai/ai-template-writer-dialog";
import { AiImproveMenu, AiSubjectSuggest, AiWriteButton } from "@/components/email-ai/ai-email-tools";

// Who can use a template besides the person who made it.
const VISIBILITY_OPTIONS: Array<{ value: EmailTemplateVisibility; label: string; hint: string }> = [
  { value: "PRIVATE", label: "Only me", hint: "Only you can see and use it." },
  { value: "DEPARTMENT", label: "My department", hint: "Everyone in your department can use it; only you can edit it." },
  { value: "EVERYONE", label: "Everyone", hint: "All Sales and Recruitment users can use it; only you can edit it." },
];

const PREVIEW_SAMPLE = {
  firstName: "Jordan",
  lastName: "Lee",
  title: "VP of Sales",
  companyName: "Acme Inc.",
};

interface EmailTemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EmailTemplate;
}

export function EmailTemplateFormDialog({
  open,
  onOpenChange,
  template,
}: EmailTemplateFormDialogProps) {
  const isEdit = !!template;
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [appendSignature, setAppendSignature] = useState(false);
  const [visibility, setVisibility] = useState<EmailTemplateVisibility>("PRIVATE");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const { data: signature } = useSignature();
  // Someone else's shared template can be used but not changed; they can make their own copy instead.
  const canEdit = !template || currentUser?.role.name === "ADMIN" || template.creatorId === currentUser?.id;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setSubject(template?.subject ?? "");
    setBodyHtml(template?.bodyHtml ?? "");
    setAppendSignature(template?.appendSignature ?? false);
    setVisibility(template?.visibility ?? "PRIVATE");
    setAiGenerated(template?.aiGenerated ?? false);
    setError(null);
  }, [open, template]);

  const previewSubject = useMemo(() => renderMergeFields(subject, PREVIEW_SAMPLE), [subject]);
  // Rendered exactly the way the server will send it: merge fields first,
  // then the plain-text-to-HTML pass, then the signature. What you see here is
  // what lands in the recipient's client.
  const previewBody = useMemo(() => {
    const merged = renderMergeFields(bodyHtml, PREVIEW_SAMPLE);
    const html = plainTextToHtml(merged);
    return appendSignature && signature?.html
      ? `${html}<div style="margin-top:1.5em">${signature.html}</div>`
      : html;
  }, [bodyHtml, appendSignature, signature]);

  const saving = createTemplate.isPending || updateTemplate.isPending;
  const deleting = deleteTemplate.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { name, subject, bodyHtml, appendSignature, visibility, aiGenerated };
    try {
      if (isEdit && template) {
        await updateTemplate.mutateAsync({ id: template.id, input });
      } else {
        await createTemplate.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save template");
    }
  }

  async function handleDelete() {
    if (!template) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete template");
    }
  }

  // A private copy of a template someone else shared, which the person is then free to change.
  async function handleMakeCopy() {
    try {
      await createTemplate.mutateAsync({
        name: `Copy of ${name}`,
        subject,
        bodyHtml,
        appendSignature,
        visibility: "PRIVATE",
        aiGenerated,
      });
      toast.success("Saved a copy you can edit");
      onOpenChange(false);
    } catch {
      setError("Could not copy template");
    }
  }

  function handleApplyPreset(presetId: string) {
    const preset = BUSINESS_EMAIL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setName(preset.name);
    setSubject(preset.subject);
    setBodyHtml(preset.bodyHtml);
    setAppendSignature(preset.appendSignature);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>{isEdit ? "Edit template" : "New template"}</DialogTitle>
            {canEdit && <AiWriteButton onClick={() => setWriterOpen(true)} />}
            {!isEdit && (
              <div className="flex items-center gap-2">
                <Select onValueChange={handleApplyPreset}>
                  <SelectTrigger className="h-8 text-xs font-semibold bg-primary/10 border-primary/25 text-primary rounded-lg w-[200px]">
                    <Sparkles className="size-3 text-amber-500 mr-1.5" />
                    <SelectValue placeholder="Load English Preset…" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_EMAIL_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!canEdit && (
            <p className="rounded-lg border border-border-subtle bg-panel-elevated px-3 py-2 text-xs text-text-dim">
              Shared by {template?.creator.firstName} {template?.creator.lastName}. You can use this template, but only
              they (or an Admin) can change it. Make your own copy to edit it.
            </p>
          )}
          <fieldset disabled={!canEdit} className="contents">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Editor */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cold intro"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Subject</Label>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Quick question, {{firstName}}"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="tpl-body">Body</Label>
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AiSubjectSuggest subject={subject} body={bodyHtml} onPick={setSubject} />
                      <AiImproveMenu
                        subject={subject}
                        body={bodyHtml}
                        onApply={(res) => {
                          if (res.subject !== undefined) setSubject(res.subject);
                          setBodyHtml(res.body);
                        }}
                      />
                    </div>
                  )}
                </div>
                <Textarea
                  id="tpl-body"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="Hi {{firstName}}, noticed {{companyName}} is..."
                  rows={10}
                  className="font-mono text-xs"
                  required
                />
                <p className="text-[10px] text-text-dim">
                  Merge fields: <code>{"{{firstName}}"}</code> <code>{"{{lastName}}"}</code>{" "}
                  <code>{"{{title}}"}</code> <code>{"{{companyName}}"}</code>
                </p>
                <p className="text-[10px] text-text-dim">
                  Line breaks and blank lines are kept when the email goes out — write it the way
                  you want it read.
                </p>
                <div className="space-y-1.5 pt-1">
                  <Label className="text-[11px]">Who can use this template</Label>
                  <Select value={visibility} onValueChange={(v) => setVisibility(v as EmailTemplateVisibility)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-text-dim">
                    {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
                  </p>
                </div>
                <label className="flex cursor-pointer items-start gap-2 pt-1">
                  <Checkbox
                    checked={appendSignature}
                    onCheckedChange={(checked) => setAppendSignature(!!checked)}
                    className="mt-0.5"
                  />
                  <span className="text-[11px] leading-snug">
                    Append the sender's signature
                    <span className="block text-[10px] text-text-dim">
                      Each rep's own signature is used, so a shared template signs off correctly.
                      {!signature?.html &&
                        " You haven't set one up yet (Account → Email signature)."}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Live preview */}
            <div className="space-y-1.5">
              <Label>Preview (sample recipient)</Label>
              <div className="rounded-lg border border-border-subtle bg-canvas/40 p-3 space-y-2 h-full">
                <p className="text-[10px] text-text-dim">
                  To: {PREVIEW_SAMPLE.firstName} {PREVIEW_SAMPLE.lastName} · {PREVIEW_SAMPLE.title}{" "}
                  at {PREVIEW_SAMPLE.companyName}
                </p>
                <p className="text-sm font-semibold border-b border-border-subtle pb-2">
                  {previewSubject || <span className="text-text-dim italic">(no subject)</span>}
                </p>
                {previewBody ? (
                  <EmailHtmlPreview html={previewBody} className="h-64" />
                ) : (
                  <p className="text-xs italic text-text-dim">(empty body)</p>
                )}
              </div>
            </div>
          </div>

          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit && canEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete
              </Button>
            ) : (
              <span />
            )}
            {!canEdit ? (
              <Button type="button" onClick={handleMakeCopy} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                Make my own copy
              </Button>
            ) : (
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create template"
              )}
            </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
      <AiTemplateWriterDialog
        open={writerOpen}
        onOpenChange={setWriterOpen}
        onUse={(draft) => {
          setName(draft.name);
          setSubject(draft.subject);
          setBodyHtml(draft.body);
          setAiGenerated(true);
        }}
      />
    </Dialog>
  );
}
