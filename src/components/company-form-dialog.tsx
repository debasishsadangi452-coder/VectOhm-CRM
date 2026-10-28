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
import { useCreateCompany, useDeleteCompany, useUpdateCompany } from "@/hooks/use-companies";
import type { Company } from "@/lib/api/types";

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
}

export function CompanyFormDialog({ open, onOpenChange, company }: CompanyFormDialogProps) {
  const isEdit = !!company;
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? "");
    setDomain(company?.domain ?? "");
    setIndustry(company?.industry ?? "");
    setNotes(company?.notes ?? "");
    setError(null);
  }, [open, company]);

  const saving = createCompany.isPending || updateCompany.isPending;
  const deleting = deleteCompany.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      name,
      domain: domain || null,
      industry: industry || null,
      notes: notes || null,
    };
    try {
      if (isEdit && company) {
        await updateCompany.mutateAsync({ id: company.id, input });
      } else {
        await createCompany.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save company");
    }
  }

  async function handleDelete() {
    if (!company) return;
    try {
      await deleteCompany.mutateAsync(company.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete company");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit company" : "New company"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Name</Label>
            <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company-domain">Domain</Label>
              <Input id="company-domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-industry">Industry</Label>
              <Input id="company-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-notes">Notes</Label>
            <Textarea id="company-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
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
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
