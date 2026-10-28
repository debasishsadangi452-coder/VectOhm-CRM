import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2, Plus } from "lucide-react";
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
import {
  useCreateSequence,
  useUpdateSequence,
  useDeleteSequence,
  useAddSequenceStep,
  useRemoveSequenceStep,
  useSequence,
} from "@/hooks/use-sequences";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import type { Sequence, SequenceStatus } from "@/lib/api/types";

const SEQUENCE_STATUSES: SequenceStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];

interface SequenceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence?: Sequence;
}

export function SequenceFormDialog({ open, onOpenChange, sequence }: SequenceFormDialogProps) {
  const isEdit = !!sequence;
  const { data: templates } = useEmailTemplates();
  const { data: fullSequence } = useSequence(isEdit ? sequence?.id : undefined);
  const createSequence = useCreateSequence();
  const updateSequence = useUpdateSequence();
  const deleteSequence = useDeleteSequence();
  const addStep = useAddSequenceStep();
  const removeStep = useRemoveSequenceStep();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SequenceStatus>("DRAFT");
  const [error, setError] = useState<string | null>(null);

  const [newStepTemplateId, setNewStepTemplateId] = useState("");
  const [newStepDelay, setNewStepDelay] = useState("3");

  useEffect(() => {
    if (!open) return;
    setName(sequence?.name ?? "");
    setDescription(sequence?.description ?? "");
    setStatus(sequence?.status ?? "DRAFT");
    setError(null);
  }, [open, sequence]);

  const saving = createSequence.isPending || updateSequence.isPending;
  const deleting = deleteSequence.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { name, description: description || undefined, status: isEdit ? status : undefined };
    try {
      if (isEdit && sequence) {
        await updateSequence.mutateAsync({ id: sequence.id, input });
      } else {
        await createSequence.mutateAsync({ name, description: description || undefined });
      }
      onOpenChange(false);
    } catch {
      setError("Could not save sequence");
    }
  }

  async function handleDelete() {
    if (!sequence) return;
    try {
      await deleteSequence.mutateAsync(sequence.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete sequence");
    }
  }

  async function handleAddStep() {
    if (!sequence || !newStepTemplateId) return;
    try {
      await addStep.mutateAsync({
        sequenceId: sequence.id,
        input: { templateId: newStepTemplateId, delayDays: parseInt(newStepDelay, 10) || 0 },
      });
      setNewStepTemplateId("");
      setNewStepDelay("3");
    } catch {
      setError("Could not add step");
    }
  }

  const steps = fullSequence?.steps ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit sequence" : "New sequence"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="seq-name">Name</Label>
            <Input id="seq-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seq-desc">Description</Label>
            <Textarea
              id="seq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SequenceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEQUENCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-text-dim">
                Only ACTIVE sequences send scheduled emails.
              </p>
            </div>
          )}

          {isEdit && sequence && (
            <div className="space-y-2 border-t border-border-subtle pt-4">
              <Label className="text-xs font-semibold text-text-dim">Steps</Label>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {steps.length > 0 ? (
                  steps.map((step, i) => (
                    <div
                      key={step.id}
                      className="flex items-center justify-between gap-2 p-2 rounded bg-canvas/30 border border-border-subtle"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium">
                          Step {i + 1}: {step.template.name}
                        </p>
                        <p className="text-[10px] text-text-dim">
                          {step.delayDays === 0
                            ? "Sent immediately on enrollment"
                            : `${step.delayDays} day${step.delayDays !== 1 ? "s" : ""} after the previous step`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep.mutate({ sequenceId: sequence.id, stepId: step.id })}
                        className="text-text-dim hover:text-destructive transition-colors shrink-0"
                        title="Remove step"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-text-dim py-1">No steps yet — add one below.</p>
                )}
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px]">Template</Label>
                  <Select value={newStepTemplateId} onValueChange={setNewStepTemplateId}>
                    <SelectTrigger className="h-8 text-xs">
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
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-[10px]">Delay (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newStepDelay}
                    onChange={(e) => setNewStepDelay(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddStep}
                  disabled={addStep.isPending || !newStepTemplateId}
                  className="h-8 text-xs"
                >
                  {addStep.isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                </Button>
              </div>
              {templates?.length === 0 && (
                <p className="text-[10px] text-warning">Create an email template first, in the Templates tab.</p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
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
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create sequence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
