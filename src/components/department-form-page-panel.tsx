import React, { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  DollarSign,
  Info,
  Layers,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateDepartment, useDeleteDepartment, useUpdateDepartment, useDepartments } from "@/hooks/use-departments";
import { useUsers } from "@/hooks/use-users";
import type { Department } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

const NO_HEAD = "__none__";

const DEPARTMENT_PRESETS = [
  { name: "Engineering & Technology", code: "ENG", target: 0, color: "from-blue-500/20 to-cyan-500/20", icon: "💻" },
  { name: "Sales & Commercial Accounts", code: "SALES", target: 150000, color: "from-emerald-500/20 to-teal-500/20", icon: "💰" },
  { name: "Recruitment & Talent Acquisition", code: "HR", target: 50000, color: "from-purple-500/20 to-pink-500/20", icon: "👥" },
  { name: "Product Design & UX", code: "PROD", target: 0, color: "from-amber-500/20 to-orange-500/20", icon: "🎨" },
  { name: "Marketing & Growth", code: "MKTG", target: 75000, color: "from-rose-500/20 to-red-500/20", icon: "🚀" },
  { name: "Customer Operations & Support", code: "OPS", target: 30000, color: "from-indigo-500/20 to-violet-500/20", icon: "🛡️" },
];

const TARGET_PRESETS = [25000, 50000, 100000, 250000, 500000];

interface DepartmentFormPagePanelProps {
  onBack: () => void;
  onCreated?: (deptId?: string) => void;
  department?: Department;
  departmentId?: string;
}

export function DepartmentFormPagePanel({
  onBack,
  onCreated,
  department: initialDepartment,
  departmentId,
}: DepartmentFormPagePanelProps) {
  const { data: allDepartments = [] } = useDepartments();
  const department = initialDepartment || allDepartments.find((d) => d.id === departmentId);
  const isEdit = !!department;

  const { data: users = [] } = useUsers();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headId, setHeadId] = useState<string>(NO_HEAD);
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (department) {
      setName(department.name ?? "");
      setDescription(department.description ?? "");
      setHeadId(department.head?.id ?? NO_HEAD);
      setMonthlyTarget(department.monthlyTarget != null ? String(department.monthlyTarget) : "");
    }
  }, [department]);

  const assignedMembers = users.filter((u) => u.department?.id === department?.id);
  const selectedHead = users.find((u) => u.id === headId);

  const saving = createDepartment.isPending || updateDepartment.isPending;

  const handleApplyPreset = (preset: typeof DEPARTMENT_PRESETS[0]) => {
    setName(preset.name);
    if (preset.target > 0) {
      setMonthlyTarget(String(preset.target));
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setError(null);
    const input = {
      name: name.trim(),
      description: description.trim() || null,
      headId: headId === NO_HEAD ? null : headId,
      monthlyTarget: monthlyTarget ? Number(monthlyTarget) : null,
    };

    try {
      if (isEdit && department) {
        await updateDepartment.mutateAsync({ id: department.id, input });
        toast.success("Department updated successfully");
      } else {
        const created = await createDepartment.mutateAsync(input);
        toast.success("Department created successfully");
        if (onCreated) {
          onCreated(created?.id);
        }
      }
      onBack();
    } catch (err: any) {
      const msg = err?.message || "Failed to save department";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleDelete() {
    if (!department) return;
    setIsDeleting(true);
    try {
      await deleteDepartment.mutateAsync(department.id);
      toast.success("Department deleted successfully");
      onBack();
    } catch (err: any) {
      toast.error("Failed to delete department: " + (err?.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-foreground pb-20 selection:bg-primary/20">
      {/* Top sticky header */}
      <div className="sticky top-0 z-30 bg-panel/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 text-text-dim hover:text-foreground -ml-2"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Organization</span>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
              <Briefcase className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                {isEdit ? (department?.name || "Edit Department") : "New Department"}
                {department?.head && (
                  <Badge variant="outline" className="text-xs font-normal text-text-dim">
                    Lead: {department.head.firstName} {department.head.lastName}
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-text-dim">
                {isEdit
                  ? "Configure division leadership, revenue quotas, and member allocations"
                  : "Establish an organizational unit with target metrics and supervisory hierarchy"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {isEdit ? "Save Changes" : "Create Department"}
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Information & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Presets if new */}
            {!isEdit && (
              <div className="rounded-xl border border-border bg-panel/60 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    Quick Standard Templates
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DEPARTMENT_PRESETS.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="p-2.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 text-left transition-all group"
                    >
                      <div className="text-base mb-1">{p.icon}</div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-text-dim mt-0.5 font-mono">
                        {p.target > 0 ? `$${p.target.toLocaleString()} target` : "Operational Unit"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Department Essentials */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Department Identity
                  </h2>
                </div>
                <Badge variant="outline" className="text-[11px] font-medium bg-secondary/50">
                  Required Fields
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dept-name" className="text-xs font-medium text-foreground">
                    Department Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dept-name"
                    placeholder="e.g. Enterprise Sales, Frontend Core Engineering, HR Operations"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="h-10 text-sm font-medium bg-secondary/40 border-border focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dept-description" className="text-xs font-medium text-foreground">
                    Description & Objectives
                  </Label>
                  <Textarea
                    id="dept-description"
                    placeholder="Outline key functions, divisional OKRs, and operating mandate..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="text-sm bg-secondary/40 border-border resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Leadership & Targets */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Leadership & Target Quota
                  </h2>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-primary">
                  <TrendingUp className="size-3.5" />
                  <span>Performance Tracking</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Head Selection */}
                <div className="space-y-2">
                  <Label htmlFor="dept-head" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <UserCheck className="size-3.5 text-text-dim" />
                    Department Head / Leader
                  </Label>
                  <Select value={headId} onValueChange={setHeadId}>
                    <SelectTrigger id="dept-head" className="h-10 text-sm bg-secondary/40 border-border">
                      <SelectValue placeholder="Assign department head..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_HEAD}>
                        <span className="text-text-dim">No head assigned (Vacant)</span>
                      </SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            <span>{u.firstName} {u.lastName}</span>
                            <span className="text-[10px] text-text-dim font-mono">({u.role?.name || "Member"})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-text-dim">
                    The department head will review leave requests and supervise member workloads.
                  </p>
                </div>

                {/* Monthly Quota Target */}
                <div className="space-y-2">
                  <Label htmlFor="dept-target" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-text-dim" />
                    Monthly Revenue / Value Target ($)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-dim font-mono">$</span>
                    <Input
                      id="dept-target"
                      type="number"
                      min={0}
                      placeholder="0 (No target set)"
                      value={monthlyTarget}
                      onChange={(e) => setMonthlyTarget(e.target.value)}
                      className="h-10 pl-7 text-sm font-mono bg-secondary/40 border-border"
                    />
                  </div>
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {TARGET_PRESETS.map((tgt) => (
                      <button
                        key={tgt}
                        type="button"
                        onClick={() => setMonthlyTarget(String(tgt))}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          monthlyTarget === String(tgt)
                            ? "bg-primary/20 border-primary text-primary font-semibold"
                            : "bg-secondary/30 border-border text-text-dim hover:text-foreground hover:bg-secondary/60"
                        }`}
                      >
                        ${tgt / 1000}k
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2.5">
                <X className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Overview Card, Members, and Danger Zone */}
          <div className="space-y-6">
            {/* Live Preview Card */}
            <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Briefcase className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                  Department Summary
                </h3>
              </div>

              <div className="flex items-start gap-4">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-secondary/30 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl shadow-inner shrink-0">
                  {name ? getInitials({ name }) : <Briefcase className="size-7 opacity-50" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-bold text-foreground truncate">
                    {name || "Department Title"}
                  </h4>
                  <p className="text-xs text-text-dim line-clamp-2 mt-0.5">
                    {description || "No description provided."}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-dim flex items-center gap-1.5">
                    <UserCheck className="size-3.5 text-text-dim" /> Department Head
                  </span>
                  <span className="font-medium text-foreground">
                    {selectedHead ? `${selectedHead.firstName} ${selectedHead.lastName}` : "Vacant"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-text-dim flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-emerald-400" /> Monthly Target
                  </span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {monthlyTarget ? `$${Number(monthlyTarget).toLocaleString()}` : "$0 (None)"}
                  </span>
                </div>

                {isEdit && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-dim flex items-center gap-1.5">
                      <Users className="size-3.5 text-primary" /> Active Members
                    </span>
                    <span className="font-semibold text-foreground">{assignedMembers.length} employees</span>
                  </div>
                )}
              </div>
            </div>

            {/* Department Members List (if editing) */}
            {isEdit && (
              <div className="rounded-xl border border-border bg-panel/60 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                      Team Members ({assignedMembers.length})
                    </h3>
                  </div>
                </div>

                {assignedMembers.length === 0 ? (
                  <p className="text-xs text-text-dim italic bg-secondary/20 p-3 rounded-lg text-center">
                    No employees assigned to this department yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {assignedMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-6 shrink-0 border border-border">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials({ firstName: m.firstName, lastName: m.lastName })}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {m.firstName} {m.lastName}
                            </div>
                            <div className="text-[10px] text-text-dim truncate">{m.email}</div>
                          </div>
                        </div>
                        {m.id === headId && (
                          <Badge variant="secondary" className="text-[9px] bg-primary/20 text-primary border-primary/30">
                            Lead
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Danger Zone */}
            {isEdit && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-destructive/20">
                  <Trash2 className="size-4 text-destructive" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                    Danger Zone
                  </h3>
                </div>
                <p className="text-xs text-text-dim leading-relaxed">
                  Deleting this department will unassign all {assignedMembers.length} team member(s) rather than deleting their accounts.
                </p>
                {showDeleteConfirm ? (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-destructive">
                      Are you sure you want to delete this department?
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="w-full text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="w-full text-xs gap-1.5"
                      >
                        {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        Confirm Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Department
                  </Button>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
