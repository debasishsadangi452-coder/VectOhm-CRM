import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { useCandidates, useCreateOffer, useUpdateOffer, useDeleteOffer } from "@/hooks/use-recruitment";
import { OFFER_STATUSES, OFFER_STATUS_LABELS, type Offer, type OfferStatus } from "@/lib/api/recruitment";

interface OfferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer?: Offer;
  candidateId?: string;
  candidateName?: string;
}

export function OfferFormDialog({ open, onOpenChange, offer, candidateId, candidateName }: OfferFormDialogProps) {
  const isEdit = !!offer;
  const { data: candidates } = useCandidates();
  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();
  const deleteOffer = useDeleteOffer();

  const [selectedCandidateId, setSelectedCandidateId] = useState(candidateId ?? "");
  const [salary, setSalary] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState<OfferStatus>("DRAFT");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedCandidateId(offer?.candidateId ?? candidateId ?? "");
    setSalary(String(offer?.salary ?? 0));
    setStartDate(offer?.startDate ? offer.startDate.slice(0, 10) : "");
    setStatus(offer?.status ?? "DRAFT");
    setNotes(offer?.notes ?? "");
    setError(null);
    setNotice(null);
  }, [open, offer, candidateId]);

  const saving = createOffer.isPending || updateOffer.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!selectedCandidateId) return;

    try {
      if (isEdit && offer) {
        await updateOffer.mutateAsync({
          id: offer.id,
          input: {
            salary: Number(salary) || 0,
            startDate: startDate || undefined,
            status,
            notes: notes || undefined,
          },
        });
        if (status === "ACCEPTED" && offer.status !== "ACCEPTED") {
          setNotice("Offer marked accepted -- candidate moved to Hired.");
        } else if (status === "DECLINED" && offer.status !== "DECLINED") {
          setNotice("Offer marked declined -- candidate moved to Rejected.");
        }
      } else {
        await createOffer.mutateAsync({
          candidateId: selectedCandidateId,
          salary: Number(salary) || 0,
          startDate: startDate || undefined,
          status,
          notes: notes || undefined,
        });
      }
      if (!notice) {
        onOpenChange(false);
      }
    } catch {
      setError("Could not save offer");
    }
  }

  async function handleDelete() {
    if (!offer) return;
    try {
      await deleteOffer.mutateAsync(offer.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete offer");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit offer" : "New offer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {candidateId ? (
            <div className="space-y-1.5">
              <Label>Candidate</Label>
              <p className="text-sm font-medium">{candidateName}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Candidate</Label>
              <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId} disabled={isEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} — {c.jobPosting.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offer-salary">Salary ($)</Label>
              <Input
                id="offer-salary"
                type="number"
                min={0}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-start">Start date</Label>
              <Input id="offer-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OfferStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {OFFER_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-notes">Notes</Label>
            <Textarea id="offer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {notice && (
            <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-xs text-success">{notice}</span>
              <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
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
                disabled={deleteOffer.isPending}
              >
                {deleteOffer.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving || !selectedCandidateId || !!notice}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create offer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
