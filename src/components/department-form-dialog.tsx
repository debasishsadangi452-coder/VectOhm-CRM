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
import { useCreateDepartment, useDeleteDepartment, useUpdateDepartment } from "@/hooks/use-departments";
import { useUsers } from "@/hooks/use-users";
import type { Department } from "@/lib/api/types";

const NO_HEAD = "__none__";

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department;
}

export function DepartmentFormDialog({ open, onOpenChange, department }: DepartmentFormDialogProps) {
  const isEdit = !!department;
  const { data: users } = useUsers();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headId, setHeadId] = useState<string>(NO_HEAD);
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(department?.name ?? "");
    setDescription(department?.description ?? "");
    setHeadId(department?.head?.id ?? NO_HEAD);
    setMonthlyTarget(department?.monthlyTarget != null ? String(department.monthlyTarget) : "");
    setError(null);
  }, [open, department]);

  const saving = createDepartment.isPending || updateDepartment.isPending;
  const deleting = deleteDepartment.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      name,
      description: description || null,
      headId: headId === NO_HEAD ? null : headId,
      monthlyTarget: monthlyTarget ? Number(monthlyTarget) : null,
    };
    try {
      if (isEdit && department) {
        await updateDepartment.mutateAsync({ id: department.id, input });
      } else {
        await createDepartment.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save department");
    }
  }

  async function handleDelete() {
    if (!department) return;
    try {
      await deleteDepartment.mutateAsync(department.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete department");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit department" : "New department"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-description">Description</Label>
            <Textarea
              id="dept-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Head</Label>
            <Select value={headId} onValueChange={setHeadId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_HEAD}>None</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-target">Monthly target ($)</Label>
            <Input
              id="dept-target"
              type="number"
              min={0}
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(e.target.value)}
              placeholder="No target set"
            />
          </div>
          {isEdit && (
            <p className="text-xs text-text-dim">
              Deleting this department will unassign its employees rather than delete them.
            </p>
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
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
