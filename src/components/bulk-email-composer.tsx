import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, PenLine, Info, Users } from "lucide-react";
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
import { renderMergeFields } from "@/lib/merge-fields";
import { plainTextToHtml } from "@/lib/plain-text-to-html";
import { inferCompanyFromEmail } from "@/lib/bulk-email-parse";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignature } from "@/hooks/use-email-signature";
import type { Contact, EmailTemplate } from "@/lib/api/types";
import { AiTemplateWriterDialog } from "@/components/email-ai/ai-template-writer-dialog";
import { AiImproveMenu, AiSubjectSuggest, AiWriteButton } from "@/components/email-ai/ai-email-tools";
import { AiPersonalizeCard } from "@/components/email-ai/ai-personalize-card";

export type ComposeMode = "TEMPLATE" | "INLINE";

// What each placeholder resolves to at send time. Supports both {{first_name}}
// and {{firstName}} formats seamlessly.
const MERGE_FIELDS: Array<{ token: string; label: string; source: string }> = [
  { token: "{{first_name}}", label: "First name", source: "Contact’s first name" },
  { token: "{{last_name}}", label: "Last name", source: "Contact’s last name" },
  { token: "{{company_name}}", label: "Company", source: "Name of the company linked to that contact" },
  { token: "{{title}}", label: "Job title", source: "Contact’s title, e.g. “VP of Sales”" },
  { token: "{{email}}", label: "Email", source: "Recipient’s email address" },
];

// Stand-in used for the preview when no CRM contact is selected yet -- same
// sample the Templates editor previews against, so both read alike.
const SAMPLE_CONTACT = {
  firstName: "Jordan",
  lastName: "Lee",
  title: "VP of Sales",
  companyName: "Acme Inc.",
  email: "jordan.lee@acme.com",
};

interface BulkEmailComposerProps {
  mode: ComposeMode;
  onModeChange: (mode: ComposeMode) => void;
  templates: EmailTemplate[] | undefined;
  templateId: string;
  onTemplateIdChange: (id: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  // First selected recipient, so the preview shows a person actually on this
  // send rather than an invented sample.
  previewContact?: Contact;
  // Total number of recipients selected (CRM + unlinked)
  recipientCount?: number;
  // Whether any recipient on this send is a pasted email with no CRM contact
  // behind it -- those get blank merge fields, which is worth warning about
  // before the send, not after.
  hasUnlinkedRecipients: boolean;
  appendSignature: boolean;
  onAppendSignatureChange: (value: boolean) => void;
  // Rewrite each recipient's email with AI at send time (optional guidance in aiInstructions).
  aiPersonalize: boolean;
  onAiPersonalizeChange: (value: boolean) => void;
  aiInstructions: string;
  onAiInstructionsChange: (value: string) => void;
}

export function BulkEmailComposer({
  mode,
  onModeChange,
  templates,
  templateId,
  onTemplateIdChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  previewContact,
  recipientCount = 0,
  hasUnlinkedRecipients,
  appendSignature,
  onAppendSignatureChange,
  aiPersonalize,
  onAiPersonalizeChange,
  aiInstructions,
  onAiInstructionsChange,
}: BulkEmailComposerProps) {
  const { data: signature } = useSignature();
  const [writerOpen, setWriterOpen] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Which field a merge-field chip drops into -- whichever was focused last,
  // defaulting to the body since that's where most of them go.
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");

  // When multiple recipients are selected, default to "raw" tags view so the user
  // sees {{first_name}} and {{company_name}} rather than a misleading single contact's name.
  const isMultiRecipient = recipientCount > 1;
  const [viewMode, setViewMode] = useState<"raw" | "sample">(isMultiRecipient ? "raw" : "sample");

  useEffect(() => {
    if (recipientCount > 1) {
      setViewMode("raw");
    } else {
      setViewMode("sample");
    }
  }, [recipientCount]);

  const selectedTemplate = templates?.find((t) => t.id === templateId);
  const previewSource = useMemo(
    () =>
      previewContact
        ? {
            firstName: previewContact.firstName ?? "",
            lastName: previewContact.lastName ?? "",
            title: previewContact.title ?? undefined,
            companyName:
              previewContact.company?.name ||
              inferCompanyFromEmail(previewContact.email) ||
              undefined,
            email: previewContact.email ?? undefined,
          }
        : SAMPLE_CONTACT,
    [previewContact],
  );

  const rawSubject = mode === "TEMPLATE" ? (selectedTemplate?.subject ?? "") : subject;
  const rawBody = mode === "TEMPLATE" ? (selectedTemplate?.bodyHtml ?? "") : body;

  const previewSubject = useMemo(
    () => (viewMode === "raw" ? rawSubject : renderMergeFields(rawSubject, previewSource)),
    [rawSubject, viewMode, previewSource],
  );

  const previewBody = useMemo(() => {
    const content =
      viewMode === "raw" ? rawBody : renderMergeFields(rawBody, previewSource);
    const html = plainTextToHtml(content);
    return appendSignature && signature?.html
      ? `${html}<div style="margin-top:1.5em">${signature.html}</div>`
      : html;
  }, [rawBody, viewMode, previewSource, appendSignature, signature]);

  function insertToken(token: string) {
    if (lastFocused === "subject") {
      onSubjectChange(spliceAtCursor(subjectRef.current, subject, token));
    } else {
      onBodyChange(spliceAtCursor(bodyRef.current, body, token));
    }
  }

  function copyTemplateToInline() {
    if (!selectedTemplate) return;
    onSubjectChange(selectedTemplate.subject);
    onBodyChange(htmlToPlainText(selectedTemplate.bodyHtml));
    onModeChange("INLINE");
  }

  return (
    <div className="border-t border-border-subtle pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label>Email content</Label>
        <div className="flex items-center gap-1">
          <ModeTab
            active={mode === "TEMPLATE"}
            onClick={() => onModeChange("TEMPLATE")}
            icon={<FileText className="size-3" />}
            label="Saved template"
          />
          <ModeTab
            active={mode === "INLINE"}
            onClick={() => onModeChange("INLINE")}
            icon={<PenLine className="size-3" />}
            label="Write a new email"
          />
        </div>
      </div>

      {mode === "TEMPLATE" ? (
        <div className="space-y-1.5">
          <Select value={templateId || undefined} onValueChange={onTemplateIdChange}>
            <SelectTrigger id="be-template">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate && (
            <div className="flex items-center justify-between text-[11px] text-text-dim pt-0.5">
              <span>Selected: <span className="text-foreground font-medium">{selectedTemplate.name}</span></span>
              <button
                type="button"
                onClick={copyTemplateToInline}
                className="text-primary hover:underline font-medium"
              >
                Customize as one-off email →
              </button>
            </div>
          )}
          {templates?.length === 0 && (
            <p className="text-[10px] text-text-dim">
              No templates yet — create one under Outreach → Templates, or switch to “Write a new
              email” above.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <AiWriteButton onClick={() => setWriterOpen(true)} />
            <AiSubjectSuggest subject={subject} body={body} onPick={onSubjectChange} />
            <AiImproveMenu
              subject={subject}
              body={body}
              onApply={(res) => {
                if (res.subject !== undefined) onSubjectChange(res.subject);
                onBodyChange(res.body);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="be-subject">Subject</Label>
            <Input
              id="be-subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              onFocus={() => setLastFocused("subject")}
              placeholder="Quick question, {{firstName}}"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="be-body">Body</Label>
            <Textarea
              id="be-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              onFocus={() => setLastFocused("body")}
              placeholder={
                "Hi {{firstName}},\n\nNoticed {{companyName}} is hiring across sales — worth a quick chat?\n\nBest,\nJon"
              }
              rows={9}
              className="text-xs font-mono"
            />
            <p className="text-[10px] text-text-dim">
              Plain text is fine — line breaks and blank lines are kept when the email goes out.
              This email is used only for this send; it isn’t added to the shared Templates list.
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-canvas/30 p-3 space-y-2">
            <p className="text-[10px] font-medium flex items-center gap-1.5">
              <Info className="size-3 text-primary" />
              Personalize it — click a field to drop it in where your cursor is
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_FIELDS.map((field) => (
                <button
                  key={field.token}
                  type="button"
                  onClick={() => insertToken(field.token)}
                  title={field.source}
                  className="text-[10px] font-mono px-2 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {field.token}
                </button>
              ))}
            </div>
            <ul className="space-y-0.5 pt-1">
              {MERGE_FIELDS.map((field) => (
                <li key={field.token} className="text-[10px] text-text-dim">
                  <code className="text-foreground">{field.token}</code> → {field.source}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-text-dim border-t border-border-subtle pt-2">
              Each recipient gets their own values filled in. A field with nothing behind it comes
              out empty, so write greetings that survive it —{" "}
              <code className="text-foreground">Hi {"{{firstName}}"},</code> reads as “Hi ,” for
              anyone without a name on file.
              {hasUnlinkedRecipients && (
                <>
                  {" "}
                  <span className="text-warning">
                    Some recipients on this send are pasted emails with no CRM contact, so every
                    field above will be blank for them.
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div
        onClick={() => onAppendSignatureChange(!appendSignature)}
        className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-subtle bg-canvas/30 p-3 select-none"
      >
        <Checkbox
          checked={appendSignature}
          onCheckedChange={(checked) => onAppendSignatureChange(!!checked)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />
        <span className="text-[11px] leading-snug">
          Append my signature
          <span className="block text-[10px] text-text-dim">
            {signature?.html
              ? "Added below the message when this campaign sends."
              : "You haven’t set one up yet — Account → Email signature."}
          </span>
        </span>
      </div>

      <AiPersonalizeCard
        enabled={aiPersonalize}
        onEnabledChange={onAiPersonalizeChange}
        instructions={aiInstructions}
        onInstructionsChange={onAiInstructionsChange}
        subject={rawSubject}
        body={mode === "TEMPLATE" ? htmlToPlainText(rawBody) : rawBody}
        sampleRecipient={previewSource}
        recipientCount={recipientCount}
      />

      <AiTemplateWriterDialog
        open={writerOpen}
        onOpenChange={setWriterOpen}
        onUse={(draft) => {
          onSubjectChange(draft.subject);
          onBodyChange(draft.body);
        }}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-[10px] text-text-dim uppercase tracking-wide">
            {isMultiRecipient ? (
              <span>
                Preview &middot; {recipientCount} recipients selected{" "}
                <span className="text-primary font-semibold">
                  ({viewMode === "raw" ? "Raw tags view" : "Sample preview"})
                </span>
              </span>
            ) : previewContact ? (
              `Preview as ${previewContact.firstName} ${previewContact.lastName}`
            ) : (
              "Preview (sample recipient)"
            )}
          </Label>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                viewMode === "raw"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-canvas/50 text-text-dim hover:text-foreground border border-border-subtle"
              }`}
            >
              Raw tags ({"{{first_name}}"})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("sample")}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                viewMode === "sample"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-canvas/50 text-text-dim hover:text-foreground border border-border-subtle"
              }`}
            >
              Sample preview ({previewContact ? previewContact.firstName : "Jordan"})
            </button>
          </div>
        </div>

        {isMultiRecipient && viewMode === "raw" && (
          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/25 text-[11px] text-text-dim flex items-start gap-2">
            <Users className="size-3.5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-foreground font-medium text-xs">
                Personalization active for {recipientCount} recipients
              </p>
              <p className="text-[11px] text-text-dim leading-relaxed">
                When sent, each recipient will automatically receive their own email customized with
                their respective name ({"{{first_name}}"}) and company name ({"{{company_name}}"}) matching their email address.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border-subtle bg-canvas/40 p-3 space-y-2">
          <p className="text-sm font-semibold border-b border-border-subtle pb-2">
            {previewSubject || (
              <span className="text-text-dim italic font-normal">(no subject)</span>
            )}
          </p>
          {previewBody ? (
            <EmailHtmlPreview html={previewBody} className="h-56" />
          ) : (
            <p className="text-xs italic text-text-dim">(empty body)</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] px-2 py-1 rounded-full border font-medium flex items-center gap-1 ${
        active
          ? "bg-primary/15 text-primary border-primary/20"
          : "bg-canvas/50 text-text-dim border-border-subtle hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Inserts at the caret rather than appending, so clicking {{firstName}} while
// mid-sentence lands it where the writer is actually typing.
function spliceAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  token: string,
): string {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + token + value.slice(end);
  const newPos = start + token.length;
  requestAnimationFrame(() => {
    if (el) {
      el.focus();
      try {
        el.setSelectionRange(newPos, newPos);
      } catch {
        // Fallback for non-supporting inputs
      }
    }
  });
  return next;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
