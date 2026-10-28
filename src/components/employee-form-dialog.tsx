import { useEffect, useState, type FormEvent } from "react";
import { Loader2, UserX, Eye, EyeOff, KeyRound } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_NAMES, type RoleName, type UserSummary } from "@/lib/api/types";

const NO_DEPARTMENT = "__none__";
const NO_MANAGER = "__none__";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserSummary;
}

export function EmployeeFormDialog({ open, onOpenChange, user }: EmployeeFormDialogProps) {
  const isEdit = !!user;
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [role, setRole] = useState<RoleName>("EMPLOYEE");
  const [departmentId, setDepartmentId] = useState<string>(NO_DEPARTMENT);
  const [managerId, setManagerId] = useState<string>(NO_MANAGER);
  const [isActive, setIsActive] = useState(true);
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setShowPassword(false);
    setAvatarUrl(user?.avatarUrl ?? "");
    setRole(user?.role.name ?? "EMPLOYEE");
    setDepartmentId(user?.department?.id ?? NO_DEPARTMENT);
    setManagerId(user?.manager?.id ?? NO_MANAGER);
    setIsActive(user?.isActive ?? true);
    setMonthlyTarget(user?.monthlyTarget != null ? String(user.monthlyTarget) : "");
    setError(null);
  }, [open, user]);

  const saving = createUser.isPending || updateUser.isPending;
  const deactivating = deleteUser.isPending;

  // Only a real Admin can grant the Admin role. HR staff can manage everyone
  // else, so hide ADMIN from the picker for them (the backend enforces this
  // too). Keep it visible when editing someone who is already an Admin so the
  // field still displays their current value.
  const isActorAdmin = useAuthStore((s) => s.user?.role.name === "ADMIN");
  const availableRoles =
    isActorAdmin || user?.role.name === "ADMIN" ? ROLE_NAMES : ROLE_NAMES.filter((r) => r !== "ADMIN");

  // A user can't be their own manager -- exclude self from the picker in edit mode.
  const managerOptions = users?.filter((u) => u.id !== user?.id) ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit && user) {
        if (password.trim() && password.trim().length < 8) {
          setError("New password must be at least 8 characters long");
          return;
        }
        await updateUser.mutateAsync({
          id: user.id,
          input: {
            firstName,
            lastName,
            avatarUrl: avatarUrl.trim() || null,
            role,
            departmentId: departmentId === NO_DEPARTMENT ? null : departmentId,
            managerId: managerId === NO_MANAGER ? null : managerId,
            isActive,
            monthlyTarget: monthlyTarget ? Number(monthlyTarget) : null,
            ...(password.trim() ? { password: password.trim() } : {}),
          },
        });
        toast.success(
          password.trim()
            ? `Updated employee details and password for ${firstName} ${lastName}`
            : `Updated employee details for ${firstName} ${lastName}`,
        );
      } else {
        await createUser.mutateAsync({
          email,
          password,
          firstName,
          lastName,
          avatarUrl: avatarUrl.trim() || undefined,
          role,
          departmentId: departmentId === NO_DEPARTMENT ? undefined : departmentId,
          managerId: managerId === NO_MANAGER ? undefined : managerId,
          monthlyTarget: monthlyTarget ? Number(monthlyTarget) : undefined,
        });
        toast.success(`Employee ${firstName} ${lastName} created successfully`);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save employee");
    }
  }

  async function handleDeactivate() {
    if (!user) return;
    try {
      await deleteUser.mutateAsync(user.id);
      toast.success(`Employee ${user.firstName} ${user.lastName} deactivated`);
      onOpenChange(false);
    } catch {
      setError("Could not deactivate employee");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "New employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-first-name">First name</Label>
              <Input
                id="emp-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-last-name">Last name</Label>
              <Input id="emp-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input
              id="emp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="emp-password">
                {isEdit ? "Change Password" : "Password"}
              </Label>
              {isEdit && (
                <span className="text-[11px] text-text-dim flex items-center gap-1">
                  <KeyRound className="size-3" />
                  Leave blank to keep current
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="emp-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!isEdit}
                minLength={8}
                placeholder={isEdit ? "Enter new password (min. 8 chars) or leave blank" : "Min. 8 characters"}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-text-dim hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleName)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>Unassigned</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reports to</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MANAGER}>None</SelectItem>
                {managerOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-avatar">Avatar URL</Label>
            <Input
              id="emp-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…/photo.png (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-target">Monthly target ($)</Label>
            <Input
              id="emp-target"
              type="number"
              min={0}
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(e.target.value)}
              placeholder="No target set"
            />
          </div>
          {isEdit && (
            <div className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2">
              <Label htmlFor="emp-active" className="cursor-pointer">
                Active
              </Label>
              <Switch id="emp-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
                Deactivate
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
