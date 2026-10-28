import React, { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  DollarSign,
  Eye,
  EyeOff,
  Github,
  Image as ImageIcon,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  Mail,
  Clock,
  Moon,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateUser, useDeleteUser, usePermanentlyDeleteUser, useUpdateUser, useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import { ModuleAccessCard } from "@/components/module-access-card";
import { useShiftTemplates } from "@/hooks/use-work-session";
import { FALLBACK_SHIFT_PRESETS } from "@/lib/shift-templates";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE_LABELS, ROLE_NAMES, type RoleName, type UserSummary } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

const NO_DEPARTMENT = "__none__";
const NO_MANAGER = "__none__";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
];

const TARGET_PRESETS = [5000, 15000, 30000, 50000, 100000];

interface UserFormPagePanelProps {
  onBack: () => void;
  onCreated?: () => void;
  user?: UserSummary;
}

export function UserFormPagePanel({ onBack, onCreated, user }: UserFormPagePanelProps) {
  const isEdit = !!user;
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const permanentlyDeleteUser = usePermanentlyDeleteUser();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [role, setRole] = useState<RoleName>("EMPLOYEE");
  const [departmentId, setDepartmentId] = useState<string>(NO_DEPARTMENT);
  const [managerId, setManagerId] = useState<string>(NO_MANAGER);
  const [isActive, setIsActive] = useState(true);
  const [screenRecording, setScreenRecording] = useState(true);
  const [canSignOut, setCanSignOut] = useState(false);
  const [modulesCustomized, setModulesCustomized] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [shiftStart, setShiftStart] = useState("10:00");
  const [shiftEnd, setShiftEnd] = useState("19:00");
  // HR's saved templates (e.g. "9–6 Sales"); the built-in presets until they have made any.
  const { data: shiftTemplates } = useShiftTemplates();
  const shiftPresets = shiftTemplates && shiftTemplates.length > 0 ? shiftTemplates : FALLBACK_SHIFT_PRESETS;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setEmail(user.email ?? "");
      setPassword("");
      setShowPassword(false);
      setAvatarUrl(user.avatarUrl ?? "");
      setGithubUsername(user.githubUsername ?? "");
      setRole(user.role.name ?? "EMPLOYEE");
      setDepartmentId(user.department?.id ?? NO_DEPARTMENT);
      setManagerId(user.manager?.id ?? NO_MANAGER);
      setIsActive(user.isActive ?? true);
      setScreenRecording(user.screenRecordingEnabled ?? true);
      setCanSignOut(user.canSignOut ?? false);
      setModulesCustomized(user.modulesCustomized ?? false);
      setModules(user.modules ?? []);
      setMonthlyTarget(user.monthlyTarget != null ? String(user.monthlyTarget) : "");
      setShiftStart(user.shiftStart ?? "10:00");
      setShiftEnd(user.shiftEnd ?? "19:00");
    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setAvatarUrl("");
      setGithubUsername("");
      setRole("EMPLOYEE");
      setDepartmentId(NO_DEPARTMENT);
      setManagerId(NO_MANAGER);
      setIsActive(true);
      setModulesCustomized(false);
      setModules([]);
      setMonthlyTarget("");
      setShiftStart("10:00");
      setShiftEnd("19:00");
    }
    setError(null);
  }, [user]);

  const saving = createUser.isPending || updateUser.isPending;
  const deactivating = deleteUser.isPending;

  const isActorAdmin = useAuthStore((s) => s.user?.role.name === "ADMIN");
  const availableRoles =
    isActorAdmin || user?.role.name === "ADMIN" ? ROLE_NAMES : ROLE_NAMES.filter((r) => r !== "ADMIN");

  const managerOptions = users?.filter((u) => u.id !== user?.id) ?? [];
  const selectedDepartment = departments?.find((d) => d.id === departmentId);
  const selectedManager = users?.find((u) => u.id === managerId);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function processImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, JPEG, WEBP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size must be under 10MB");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.88);
          setAvatarUrl(compressedDataUrl);
          toast.success("Profile photo uploaded and processed.");
        } else {
          setAvatarUrl(event.target?.result as string);
        }
        setIsUploading(false);
      };
      img.onerror = () => {
        setIsUploading(false);
        toast.error("Failed to decode image file");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
    let gen = "";
    for (let i = 0; i < 12; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(gen);
    setShowPassword(true);
    toast.success("Secure password generated and filled.");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError("First and last name are required");
      return;
    }

    if (!isEdit && !trimmedEmail) {
      setError("Email address is required");
      return;
    }

    if (!isEdit && (!password || password.length < 8)) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (isEdit && password.trim() && password.trim().length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    try {
      if (isEdit && user) {
        await updateUser.mutateAsync({
          id: user.id,
          input: {
            firstName: trimmedFirst,
            lastName: trimmedLast,
            avatarUrl: avatarUrl.trim() || null,
            githubUsername: githubUsername.trim() || null,
            role,
            departmentId: departmentId === NO_DEPARTMENT ? null : departmentId,
            managerId: managerId === NO_MANAGER ? null : managerId,
            isActive,
            // The server refuses this from anyone but an Admin; don't even send it otherwise.
            ...(isActorAdmin
              ? {
                  screenRecordingEnabled: screenRecording,
                  canSignOut,
                  modulesCustomized,
                  modules: modulesCustomized ? modules : [],
                }
              : {}),
            monthlyTarget: monthlyTarget ? Number(monthlyTarget) : null,
            shiftStart,
            shiftEnd,
            ...(password.trim() ? { password: password.trim() } : {}),
          },
        });
        toast.success(`User ${trimmedFirst} ${trimmedLast} updated successfully`);
        onCreated?.();
        onBack();
      } else {
        await createUser.mutateAsync({
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
          password: password.trim(),
          avatarUrl: avatarUrl.trim() || null,
          githubUsername: githubUsername.trim() || null,
          role,
          departmentId: departmentId === NO_DEPARTMENT ? null : departmentId,
          managerId: managerId === NO_MANAGER ? null : managerId,
          monthlyTarget: monthlyTarget ? Number(monthlyTarget) : null,
          shiftStart,
          shiftEnd,
          // The server refuses this from anyone but an Admin; don't even send it otherwise.
          ...(isActorAdmin ? { modulesCustomized, modules: modulesCustomized ? modules : [] } : {}),
        });
        toast.success(`User ${trimmedFirst} ${trimmedLast} added to CRM`);
        onCreated?.();
        onBack();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save user account. Please check your inputs.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleDeactivate() {
    if (!user) return;
    if (!window.confirm(`Are you sure you want to deactivate ${user.firstName} ${user.lastName}?`)) {
      return;
    }
    try {
      await deleteUser.mutateAsync(user.id);
      toast.success("User account deactivated");
      onCreated?.();
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate user");
    }
  }

  // Permanent, irreversible -- unlike Deactivate above. The server refuses
  // (and says exactly why) if this account still owns deals, leads, tasks or
  // projects, or has other records linked to it elsewhere in the CRM, so
  // nothing is ever silently destroyed; HR reassigns those first, then can
  // retry. Gated behind the Dialog below, which requires typing the person's
  // email -- a plain confirm() is too easy to click through for something
  // that can't be undone.
  async function handlePermanentDelete() {
    if (!user) return;
    try {
      await permanentlyDeleteUser.mutateAsync(user.id);
      toast.success(`${user.firstName} ${user.lastName}'s account was permanently deleted`);
      setDeleteDialogOpen(false);
      onCreated?.();
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    (isEdit || (email.trim().length > 0 && password.length >= 8));

  return (
    <div className="min-h-screen bg-canvas text-foreground pb-20">
      {/* Top Sticky Bar */}
      <div className="sticky top-0 z-30 bg-panel/90 backdrop-blur-md border-b border-border-subtle px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-1.5 rounded-xl border-border-subtle bg-canvas/60 hover:bg-canvas text-xs font-semibold"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5">
                  CRM & HR Directory
                </Badge>
                <span className="text-xs text-text-dim">/</span>
                <span className="text-xs font-medium text-text-dim">
                  {isEdit ? "Edit User Account" : "Add New User"}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-0.5">
                {isEdit ? `Edit User: ${user?.firstName} ${user?.lastName}` : "Add New User to CRM"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              disabled={saving}
              className="text-xs font-semibold text-text-dim hover:text-foreground"
            >
              Cancel
            </Button>
            {isEdit && user?.isActive && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeactivate}
                disabled={deactivating || saving}
                className="text-xs font-semibold gap-1.5 rounded-xl"
              >
                {deactivating ? <Loader2 className="size-3.5 animate-spin" /> : <UserX className="size-3.5" />}
                Deactivate User
              </Button>
            )}
            {isEdit && user && !user.isActive && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteConfirmEmail("");
                  setDeleteDialogOpen(true);
                }}
                className="text-xs font-semibold gap-1.5 rounded-xl bg-destructive/80 hover:bg-destructive"
                title="Permanently erase this account -- cannot be undone"
              >
                <Trash2 className="size-3.5" />
                Delete Permanently
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !isFormValid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl h-9 px-4 gap-1.5 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {isEdit ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
                  {isEdit ? "Update User" : "Create CRM User"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* Live Profile Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-r from-panel via-panel/90 to-primary/5 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="size-16 rounded-2xl border-2 border-primary/20 shadow-sm">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={firstName} /> : null}
                  <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-bold text-lg">
                    {firstName || lastName
                      ? getInitials({ firstName: firstName || "U", lastName: lastName || "S" })
                      : "US"}
                  </AvatarFallback>
                </Avatar>
                {isActive ? (
                  <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 border-2 border-panel ring-1 ring-emerald-500/20" />
                ) : (
                  <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-slate-400 border-2 border-panel" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">
                    {firstName.trim() || lastName.trim()
                      ? `${firstName.trim()} ${lastName.trim()}`
                      : "New Team Member"}
                  </h2>
                  <Badge className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border-primary/30">
                    {ROLE_LABELS[role] ?? role}
                  </Badge>
                  {selectedDepartment && (
                    <Badge variant="secondary" className="text-[10px] font-medium gap-1">
                      <Building2 className="size-3" />
                      {selectedDepartment.name}
                    </Badge>
                  )}
                  {monthlyTarget && Number(monthlyTarget) > 0 && (
                    <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 border-emerald-500/30 bg-emerald-500/5 gap-0.5">
                      <DollarSign className="size-3" />
                      {Number(monthlyTarget).toLocaleString()}/mo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-text-dim mt-0.5 flex items-center gap-2">
                  <Mail className="size-3 text-text-dim" />
                  {email || "email@company.com"}
                  {selectedManager && (
                    <>
                      <span>•</span>
                      <span>Reports to {selectedManager.firstName} {selectedManager.lastName}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] font-semibold text-text-dim block">Account Status</span>
                <span className={`text-xs font-bold ${isActive ? "text-emerald-500" : "text-slate-400"}`}>
                  {isActive ? "Active in CRM" : "Inactive / Suspended"}
                </span>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {isEdit && isActorAdmin && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-text-dim block">Screen Recording</span>
                  <span className={`text-xs font-bold ${screenRecording ? "text-emerald-500" : "text-slate-400"}`}>
                    {screenRecording ? "On" : "Off"}
                  </span>
                </div>
                <Switch checked={screenRecording} onCheckedChange={setScreenRecording} aria-label="Screen recording" />
              </div>
            )}

            {isEdit && isActorAdmin && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-text-dim block">Allow Sign Out</span>
                  <span className={`text-xs font-bold ${canSignOut ? "text-amber-500" : "text-slate-400"}`}>
                    {canSignOut ? "Allowed" : "Locked in"}
                  </span>
                </div>
                <Switch checked={canSignOut} onCheckedChange={setCanSignOut} aria-label="Allow sign out" />
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Identity & Role */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Details & Credentials */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 grid place-items-center text-primary">
                    <User className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold">Personal & Login Credentials</h3>
                </div>
                <span className="text-[11px] text-text-dim font-medium">* Required for authentication</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">First Name *</Label>
                  <Input
                    placeholder="e.g. Sarah"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Last Name *</Label>
                  <Input
                    placeholder="e.g. Jenkins"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Work Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                  <Input
                    type="email"
                    placeholder="sarah.jenkins@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isEdit}
                    required
                    className="pl-9 rounded-xl border-border-subtle bg-canvas/60 text-xs"
                  />
                </div>
                {isEdit && (
                  <p className="text-[10px] text-text-dim">
                    Login email addresses cannot be altered once created to preserve system audit logs.
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    {isEdit ? "Reset Password (optional)" : "Password *"}
                  </Label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="size-3" />
                    Auto-Generate Password
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={isEdit ? "Leave blank to keep current password" : "Minimum 8 characters"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isEdit}
                    className="pl-9 pr-10 rounded-xl border-border-subtle bg-canvas/60 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-text-dim">
                  Must be at least 8 characters with a mix of letters and numbers.
                </p>
              </div>

              {/* Profile Photo Upload Component */}
              <div className="space-y-3 pt-2 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Camera className="size-3.5 text-primary" />
                    Profile Photo
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-[11px] font-medium text-text-dim hover:text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <LinkIcon className="size-3" />
                    {showUrlInput ? "Hide URL input" : "Paste URL instead"}
                  </button>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                {/* Upload & Preview Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`rounded-xl border-2 border-dashed p-4 transition-all ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-border-subtle bg-canvas/40 hover:border-border hover:bg-canvas/60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Avatar Circle with upload status */}
                    <div className="relative shrink-0">
                      <Avatar className="size-16 rounded-2xl border-2 border-border shadow-xs">
                        {avatarUrl ? <AvatarImage src={avatarUrl} alt="Preview" className="object-cover" /> : null}
                        <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-bold text-base">
                          {firstName || lastName
                            ? getInitials({ firstName: firstName || "U", lastName: lastName || "S" })
                            : <Camera className="size-6 text-text-dim" />}
                        </AvatarFallback>
                      </Avatar>
                      {isUploading && (
                        <div className="absolute inset-0 bg-background/80 rounded-2xl grid place-items-center">
                          <Loader2 className="size-5 animate-spin text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Controls & Actions */}
                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl border-border-subtle bg-panel hover:bg-canvas text-xs font-semibold gap-1.5 h-8 px-3 cursor-pointer shadow-2xs"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Upload className="size-3.5 text-primary" />
                              {avatarUrl ? "Replace Photo" : "Upload Profile Photo"}
                            </>
                          )}
                        </Button>

                        {avatarUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAvatarUrl("");
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2.5 gap-1 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            Remove
                          </Button>
                        )}
                      </div>

                      <p className="text-[11px] text-text-dim">
                        Drag and drop your image here, or click to browse (PNG, JPG, WEBP up to 10MB).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Collapsible URL Input fallback */}
                {showUrlInput && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] text-text-dim font-medium">Or enter image URL</Label>
                    <Input
                      placeholder="https://images.unsplash.com/... or hosted image URL"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="rounded-xl border-border-subtle bg-canvas/60 text-xs"
                    />
                  </div>
                )}

                {/* Sample Presets */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-text-dim font-medium">Sample Presets:</span>
                  <div className="flex items-center gap-1.5">
                    {PRESET_AVATARS.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAvatarUrl(url)}
                        title={`Sample Preset ${i + 1}`}
                        className={`size-6 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                          avatarUrl === url ? "border-primary scale-110 shadow-xs" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={url} alt={`Preset ${i + 1}`} className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Role & Permissions Selector */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-indigo-500/10 grid place-items-center text-indigo-500">
                    <Shield className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold">Role & Permissions Tier</h3>
                </div>
                <span className="text-[11px] text-text-dim font-medium">Determines CRM access scope</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Employee Card */}
                <div
                  onClick={() => setRole("EMPLOYEE")}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    role === "EMPLOYEE"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border-subtle bg-canvas/40 hover:border-border"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] font-bold text-blue-500 border-blue-500/30">
                        Employee
                      </Badge>
                      {role === "EMPLOYEE" && <Check className="size-4 text-primary" />}
                    </div>
                    <h4 className="text-xs font-bold text-foreground">Standard Staff</h4>
                    <p className="text-[11px] text-text-dim mt-1 leading-relaxed">
                      Access to deals, contacts, personal sprint tasks, attendance, and team chat.
                    </p>
                  </div>
                  <span className="text-[10px] text-text-dim mt-3 block font-mono">Scope: Assigned Records</span>
                </div>

                {/* Manager Card */}
                <div
                  onClick={() => setRole("MANAGER")}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    role === "MANAGER"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border-subtle bg-canvas/40 hover:border-border"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] font-bold text-amber-500 border-amber-500/30">
                        Manager
                      </Badge>
                      {role === "MANAGER" && <Check className="size-4 text-primary" />}
                    </div>
                    <h4 className="text-xs font-bold text-foreground">Team Lead</h4>
                    <p className="text-[11px] text-text-dim mt-1 leading-relaxed">
                      Department oversight, pipeline reviews, task assignments, and leave approvals.
                    </p>
                  </div>
                  <span className="text-[10px] text-text-dim mt-3 block font-mono">Scope: Department Wide</span>
                </div>

                {/* Admin Card */}
                <div
                  onClick={() => {
                    if (isActorAdmin || user?.role.name === "ADMIN") {
                      setRole("ADMIN");
                    } else {
                      toast.error("Only current Admins can grant Administrator privileges.");
                    }
                  }}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                    !(isActorAdmin || user?.role.name === "ADMIN")
                      ? "opacity-50 cursor-not-allowed border-dashed border-border-subtle"
                      : "cursor-pointer"
                  } ${
                    role === "ADMIN"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border-subtle bg-canvas/40 hover:border-border"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] font-bold text-rose-500 border-rose-500/30">
                        Admin
                      </Badge>
                      {role === "ADMIN" && <Check className="size-4 text-primary" />}
                    </div>
                    <h4 className="text-xs font-bold text-foreground">Full Authority</h4>
                    <p className="text-[11px] text-text-dim mt-1 leading-relaxed">
                      System-wide access, financial configurations, security audit logs, and directory controls.
                    </p>
                  </div>
                  <span className="text-[10px] text-text-dim mt-3 block font-mono">Scope: Full Platform</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Organization, Sales Quota, and Integrations */}
          <div className="space-y-6">
            {/* Hierarchy & Department */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-emerald-500/10 grid place-items-center text-emerald-500">
                  <Building2 className="size-4" />
                </div>
                <h3 className="text-sm font-bold">Department & Hierarchy</h3>
              </div>

              {/* Department Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="w-full rounded-xl border-border-subtle bg-canvas/60 text-xs">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEPARTMENT}>Unassigned / General</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} {d.head ? `(Head: ${d.head.firstName} ${d.head.lastName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reports to Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reports To (Direct Manager)</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger className="w-full rounded-xl border-border-subtle bg-canvas/60 text-xs">
                    <SelectValue placeholder="Select direct manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MANAGER}>None / Self-Managing</SelectItem>
                    {managerOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({ROLE_LABELS[u.role.name] ?? u.role.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sales Target Quota */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-amber-500/10 grid place-items-center text-amber-500">
                  <DollarSign className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Monthly Sales Target ($)</h3>
                  <p className="text-[10px] text-text-dim">Used for sales quota & commission tracking</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="No target set"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(e.target.value)}
                    className="pl-8 rounded-xl border-border-subtle bg-canvas/60 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {TARGET_PRESETS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setMonthlyTarget(String(amount))}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                        monthlyTarget === String(amount)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-canvas/60 text-text-dim border-border-subtle hover:text-foreground"
                      }`}
                    >
                      ${(amount / 1000).toFixed(0)}k
                    </button>
                  ))}
                  {monthlyTarget && (
                    <button
                      type="button"
                      onClick={() => setMonthlyTarget("")}
                      className="text-[10px] text-text-dim hover:text-destructive px-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Working hours */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-sky-500/10 grid place-items-center text-sky-500">
                  <Clock className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Working Hours</h3>
                  <p className="text-[10px] text-text-dim">
                    Clocking in after the start (10 min grace) or out before the end asks for a reason
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shift-start" className="text-xs">Log in time</Label>
                  <Input
                    id="shift-start"
                    type="time"
                    required
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="rounded-xl border-border-subtle bg-canvas/60 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-end" className="text-xs">Log out time</Label>
                  <Input
                    id="shift-end"
                    type="time"
                    required
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="rounded-xl border-border-subtle bg-canvas/60 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {shiftPresets.map((t) => (
                  <button
                    key={`${t.name}-${t.shiftStart}-${t.shiftEnd}`}
                    type="button"
                    title={`${t.shiftStart}–${t.shiftEnd}`}
                    onClick={() => {
                      setShiftStart(t.shiftStart);
                      setShiftEnd(t.shiftEnd);
                    }}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                      shiftStart === t.shiftStart && shiftEnd === t.shiftEnd
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-canvas/60 text-text-dim border-border-subtle hover:text-foreground"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {shiftEnd <= shiftStart && (
                <p className="text-[10px] text-sky-500 flex items-center gap-1">
                  <Moon className="size-3 shrink-0" />
                  Overnight shift (crosses midnight) — this saves correctly. Late arrival, early clock-out, no-show
                  and forgotten-clock-out checks all work for it; the shift counts on the date it starts.
                </p>
              )}
            </div>

            {/* Module access: which modules this person can open (Admin only) */}
            {isActorAdmin && (
              <ModuleAccessCard
                customized={modulesCustomized}
                onCustomizedChange={setModulesCustomized}
                selected={modules}
                onSelectedChange={setModules}
                role={role}
                departmentName={selectedDepartment?.name}
              />
            )}

            {/* Developer Integration */}
            <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <div className="size-7 rounded-lg bg-slate-500/10 grid place-items-center text-slate-400">
                  <Github className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Developer Integration</h3>
                  <p className="text-[10px] text-text-dim">Link GitHub handle for commit & sprint sync</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">GitHub Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-dim font-mono">@</span>
                  <Input
                    placeholder="octocat"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    className="pl-7 rounded-xl border-border-subtle bg-canvas/60 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Provisioning Checklist */}
            <div className="rounded-2xl border border-border-subtle bg-canvas/40 p-4 space-y-2">
              <span className="text-[11px] font-bold text-foreground block">Provisioning Checklist</span>
              <div className="space-y-1.5 text-[11px] text-text-dim">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`size-3.5 ${firstName && lastName ? "text-emerald-500" : "text-slate-400"}`} />
                  <span>Full name populated</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`size-3.5 ${isEdit || (email && password.length >= 8) ? "text-emerald-500" : "text-slate-400"}`} />
                  <span>Authentication credentials prepared</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`size-3.5 ${role ? "text-emerald-500" : "text-slate-400"}`} />
                  <span>Role permissions assigned ({ROLE_LABELS[role]})</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              Permanently delete {user?.firstName} {user?.lastName}?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-left">
                <p>
                  This cannot be undone. Their account, login, and all their own activity data (screen
                  recordings, activity history, notifications, chat history) are erased for good.
                </p>
                <p>
                  If they still own any deals, leads, tasks, or projects, or have other records linked to
                  them elsewhere in the CRM, this will be refused -- reassign those to someone else first.
                </p>
                <p className="text-foreground">
                  Type <span className="font-mono font-semibold">{user?.email}</span> to confirm.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            placeholder={user?.email}
            autoComplete="off"
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteConfirmEmail.trim().toLowerCase() !== user?.email.toLowerCase() || permanentlyDeleteUser.isPending}
              onClick={handlePermanentDelete}
              className="gap-1.5"
            >
              {permanentlyDeleteUser.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
