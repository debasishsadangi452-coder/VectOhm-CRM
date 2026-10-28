import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Users2,
  CalendarDays,
  ClipboardList,
  Check,
  X,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Building2,
  KeyRound,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeFormDialog } from "@/components/employee-form-dialog";
import { UserFormPagePanel } from "@/components/user-form-page-panel";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { DepartmentFormPagePanel } from "@/components/department-form-page-panel";
import { LeaveRequestFormDialog } from "@/components/leave-request-form-dialog";
import { LeaveRequestDetailsDialog } from "@/components/leave-request-details-dialog";
import { LeaveCalendar } from "@/components/leave-calendar";
import { useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import { useLeaveRequests, useUpdateLeaveRequest } from "@/hooks/use-leave-requests";
import { useLoginEvents, useLastLogins } from "@/hooks/use-login-events";
import { useAuthStore } from "@/stores/auth-store";
import { getRoleLabel } from "@/lib/role-label";
import { getInitials } from "@/lib/utils";
import {
  ROLE_LABELS,
  ROLE_NAMES,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPES,
  type Department,
  type RoleName,
  type UserSummary,
  type LeaveStatus,
  type LeaveRequest,
} from "@/lib/api/types";

// "3 hours ago" style relative time, with an absolute fallback for older dates.
export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "Just now";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Condense a raw user-agent into a short "Browser · OS" label.
export function formatDevice(ua: string | null): string {
  if (!ua) return "—";
  const browser =
    /edg/i.test(ua) ? "Edge"
    : /chrome|crios/i.test(ua) ? "Chrome"
    : /firefox|fxios/i.test(ua) ? "Firefox"
    : /safari/i.test(ua) ? "Safari"
    : "Browser";
  const os =
    /windows/i.test(ua) ? "Windows"
    : /mac os|macintosh/i.test(ua) ? "macOS"
    : /android/i.test(ua) ? "Android"
    : /iphone|ipad|ios/i.test(ua) ? "iOS"
    : /linux/i.test(ua) ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}

const ALL = "__all__";

const ROLE_TONE: Record<RoleName, string> = {
  ADMIN: "text-violet font-semibold",
  MANAGER: "text-blue-600 font-semibold",
  EMPLOYEE: "text-slate-600 font-medium",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  REJECTED: "bg-rose-500/15 text-rose-600 border-rose-500/20",
  CANCELLED: "bg-muted text-text-dim border-border-subtle",
};

export interface HrmsPortalPanelProps {
  showHeader?: boolean;
  defaultTab?: "employees" | "departments" | "leave-requests" | "leave-calendar" | "activity";
}

export function HrmsPortalPanel({ showHeader = true, defaultTab = "employees" }: HrmsPortalPanelProps) {
  const canManage = useAuthStore(
    (s) => s.user?.role.name === "ADMIN" || s.user?.department?.name === "HR",
  );
  const isAdmin = useAuthStore((s) => s.user?.role.name === "ADMIN");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 grid place-items-center text-blue-600 shrink-0">
              <Users2 className="size-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">HR / Team</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Departments, reporting lines, employee directory, and leave management.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLeaveDialogOpen(true)}
            className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-10 px-4 cursor-pointer shadow-sm"
          >
            <CalendarDays className="size-4" />
            Request Leave
          </Button>
        </div>
      )}

      <LeaveRequestFormDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen} />

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <TabsList className="w-full justify-start bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto flex-nowrap">
          <TabsTrigger value="employees" className="rounded-xl font-bold text-xs">
            <Users2 className="size-3.5 mr-1.5 text-blue-600" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="departments" className="rounded-xl font-bold text-xs">
            <Building2 className="size-3.5 mr-1.5 text-indigo-600" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="leave-requests" className="rounded-xl font-bold text-xs">
            <ClipboardList className="size-3.5 mr-1.5 text-amber-600" />
            Leave Requests
          </TabsTrigger>
          <TabsTrigger value="leave-calendar" className="rounded-xl font-bold text-xs">
            <CalendarDays className="size-3.5 mr-1.5 text-emerald-600" />
            Leave Calendar
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="activity" className="rounded-xl font-bold text-xs">
              <Clock className="size-3.5 mr-1.5 text-purple-600" />
              Login Activity
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="mt-5">
          <EmployeesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="departments" className="mt-5">
          <DepartmentsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="leave-requests" className="mt-5">
          <LeaveRequestsTab isHrOrAdmin={!!(canManage || isAdmin)} />
        </TabsContent>
        <TabsContent value="leave-calendar" className="mt-5">
          <LeaveCalendarTab isHrOrAdmin={!!(canManage || isAdmin)} />
        </TabsContent>
        {canManage && (
          <TabsContent value="activity" className="mt-5">
            <ActivityTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Leave Requests Tab ───────────────────────────────────────────────────────

function LeaveRequestsTab({ isHrOrAdmin }: { isHrOrAdmin: boolean }) {
  if (isHrOrAdmin) {
    return <AdminLeaveRequestsView />;
  }
  return <EmployeeLeaveRequestsView />;
}

function AdminLeaveRequestsView() {
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [userFilter, setUserFilter] = useState<string>(ALL);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>(ALL);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  const { data: leaves, isLoading } = useLeaveRequests(
    statusFilter !== ALL ? { status: statusFilter as LeaveStatus } : undefined,
  );
  const { data: users } = useUsers();
  const { data: departments } = useDepartments();
  const updateLeave = useUpdateLeaveRequest();

  const filtered = useMemo(() => {
    return (leaves ?? []).filter((l) => {
      if (userFilter !== ALL && l.userId !== userFilter) return false;
      if (leaveTypeFilter !== ALL && l.type !== leaveTypeFilter) return false;
      return true;
    });
  }, [leaves, userFilter, leaveTypeFilter]);

  async function handleAction(id: string, action: "APPROVED" | "REJECTED", note?: string) {
    await updateLeave.mutateAsync({ id, input: { status: action, reviewNote: note } });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 rounded-xl border-slate-200 bg-white text-xs font-semibold">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-44 rounded-xl border-slate-200 bg-white text-xs font-semibold">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {(users ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
          <SelectTrigger className="w-44 rounded-xl border-slate-200 bg-white text-xs font-semibold">
            <SelectValue placeholder="Leave type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {LEAVE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {LEAVE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-slate-50/80">
              <TableHead className="font-extrabold text-xs text-slate-600">Employee</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Type</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">From</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">To</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Days</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Status</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Reason / Message</TableHead>
              <TableHead className="text-right font-extrabold text-xs text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  <Loader2 className="size-4 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8 text-xs font-medium">
                  No leave requests match these filters.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((leave) => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

              return (
                <TableRow
                  key={leave.id}
                  onClick={() => setSelectedLeave(leave)}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  title="Click to view full message & details"
                >
                  {/* Employee */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 border border-slate-200">
                        <AvatarFallback className="text-[10px] font-bold bg-blue-50 text-blue-700">
                          {getInitials(leave.user)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {leave.user.firstName} {leave.user.lastName}
                      </span>
                    </div>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: LEAVE_TYPE_COLORS[leave.type] }}
                      />
                      {LEAVE_TYPE_LABELS[leave.type]}
                    </span>
                  </TableCell>

                  {/* Dates */}
                  <TableCell className="text-xs text-slate-600">
                    {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-800">{days}d</TableCell>

                  {/* Status */}
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[leave.status]}`}>
                      {leave.status === "PENDING" && <Clock className="size-3" />}
                      {leave.status === "APPROVED" && <Check className="size-3" />}
                      {leave.status === "REJECTED" && <X className="size-3" />}
                      {LEAVE_STATUS_LABELS[leave.status]}
                    </span>
                  </TableCell>

                  {/* Reason */}
                  <TableCell className="text-xs text-slate-600 max-w-[200px]">
                    <div className="truncate group-hover:text-blue-700 font-medium">
                      {leave.reason ?? "—"}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    {leave.status === "PENDING" ? (
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionButton
                          leaveId={leave.id}
                          action="APPROVED"
                          onConfirm={handleAction}
                          isPending={updateLeave.isPending}
                        />
                        <ActionButton
                          leaveId={leave.id}
                          action="REJECTED"
                          onConfirm={handleAction}
                          isPending={updateLeave.isPending}
                        />
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">
                        {leave.reviewedBy
                          ? `By ${leave.reviewedBy.firstName} ${leave.reviewedBy.lastName}`
                          : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Leave Details Modal for Admin to view full message & act */}
      <LeaveRequestDetailsDialog
        leave={selectedLeave}
        open={!!selectedLeave}
        onOpenChange={(open) => {
          if (!open) setSelectedLeave(null);
        }}
        canReview={true}
        onAction={handleAction}
        isActionPending={updateLeave.isPending}
        departments={departments}
      />
    </div>
  );
}

function ActionButton({
  leaveId,
  action,
  onConfirm,
  isPending,
}: {
  leaveId: string;
  action: "APPROVED" | "REJECTED";
  onConfirm: (id: string, action: "APPROVED" | "REJECTED", note?: string) => Promise<void>;
  isPending: boolean;
}) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const isApprove = action === "APPROVED";

  async function handleConfirm() {
    await onConfirm(leaveId, action, note.trim() || undefined);
    setOpen(false);
    setNote("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={isApprove ? "default" : "outline"}
          className={`h-7 px-2.5 text-xs font-bold rounded-lg gap-1 cursor-pointer ${
            isApprove
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "text-rose-600 border-rose-200 hover:bg-rose-50"
          }`}
          disabled={isPending}
          onClick={(e) => e.stopPropagation()}
        >
          {isApprove ? <Check className="size-3" /> : <X className="size-3" />}
          {isApprove ? "Approve" : "Reject"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 space-y-3 bg-white border-slate-200 rounded-2xl shadow-xl"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-extrabold text-slate-800">
          {isApprove ? "Approve this leave request?" : "Reject this leave request?"}
        </p>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-600">
            Note <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isApprove ? "Any note for the employee…" : "Reason for rejection…"}
            rows={2}
            className="text-xs rounded-xl border-slate-200"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className={`flex-1 text-xs font-bold rounded-xl h-8 cursor-pointer ${
              isApprove ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
            }`}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : "Confirm"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs font-bold rounded-xl h-8 cursor-pointer border-slate-200"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmployeeLeaveRequestsView() {
  const currentUser = useAuthStore((s) => s.user);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const { data: leaves, isLoading } = useLeaveRequests(
    currentUser?.id ? { userId: currentUser.id } : undefined,
  );
  const updateLeave = useUpdateLeaveRequest();

  const myLeaves = leaves ?? [];
  const pending = myLeaves.filter((l) => l.status === "PENDING").length;
  const approved = myLeaves.filter((l) => l.status === "APPROVED").length;
  const rejected = myLeaves.filter((l) => l.status === "REJECTED").length;

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    await updateLeave.mutateAsync({ id, input: { status: "CANCELLED" } });
  }

  return (
    <div className="space-y-6">
      {/* Leave Request Dialog */}
      <LeaveRequestFormDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen} />

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Pending Review",
            value: pending,
            icon: Clock,
            color: "text-amber-600 bg-amber-50 border-amber-200/80",
          },
          {
            label: "Approved",
            value: approved,
            icon: Check,
            color: "text-emerald-600 bg-emerald-50 border-emerald-200/80",
          },
          {
            label: "Rejected",
            value: rejected,
            icon: X,
            color: "text-rose-600 bg-rose-50 border-rose-200/80",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs"
          >
            <div className={`size-10 rounded-xl grid place-items-center shrink-0 border ${color}`}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{value}</p>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Leave History</h2>
          <p className="text-xs text-slate-500 font-medium">Click on any request to view full details and notes</p>
        </div>
        <Button
          size="sm"
          onClick={() => setLeaveDialogOpen(true)}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-9 px-4 cursor-pointer shadow-sm"
        >
          <Plus className="size-3.5" />
          Request Leave
        </Button>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-slate-50/80">
              <TableHead className="font-extrabold text-xs text-slate-600">Type</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">From</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">To</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Days</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Status</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Reviewer Note / Reason</TableHead>
              <TableHead className="text-right font-extrabold text-xs text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                  <Loader2 className="size-4 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && myLeaves.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8 text-xs font-medium">
                  No leave requests yet. Click "Request Leave" to submit your first request.
                </TableCell>
              </TableRow>
            )}
            {myLeaves.map((leave) => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

              return (
                <TableRow
                  key={leave.id}
                  onClick={() => setSelectedLeave(leave)}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  title="Click to view full message & details"
                >
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: LEAVE_TYPE_COLORS[leave.type] }}
                      />
                      {LEAVE_TYPE_LABELS[leave.type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-800">{days}d</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[leave.status]}`}>
                      {leave.status === "PENDING" && <Clock className="size-3" />}
                      {leave.status === "APPROVED" && <Check className="size-3" />}
                      {leave.status === "REJECTED" && <X className="size-3" />}
                      {LEAVE_STATUS_LABELS[leave.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[220px]">
                    <div className="truncate group-hover:text-blue-700 font-medium">
                      {leave.reviewNote ? `Note: ${leave.reviewNote}` : leave.reason ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {leave.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg cursor-pointer"
                          onClick={() => handleCancel(leave.id)}
                          disabled={updateLeave.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* My Leave Calendar */}
      <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">My Leave Calendar</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Showing your approved leaves on the calendar</p>
        </div>
        <LeaveCalendar leaves={myLeaves} showEmployee={false} />
      </div>

      {/* Leave Details Modal */}
      <LeaveRequestDetailsDialog
        leave={selectedLeave}
        open={!!selectedLeave}
        onOpenChange={(open) => {
          if (!open) setSelectedLeave(null);
        }}
        canReview={false}
      />
    </div>
  );
}

// ─── Leave Calendar Tab ───────────────────────────────────────────────────────

function LeaveCalendarTab({ isHrOrAdmin }: { isHrOrAdmin: boolean }) {
  const { data: leaves, isLoading } = useLeaveRequests();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8 text-xs font-medium">
        <Loader2 className="size-4 animate-spin text-blue-600" />
        Loading calendar…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isHrOrAdmin && (
        <p className="text-xs text-slate-500 font-medium">
          Showing all approved leaves across your organisation.
        </p>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <LeaveCalendar leaves={leaves ?? []} showEmployee={isHrOrAdmin} />
      </div>
    </div>
  );
}

// ─── Existing Employees Tab ───────────────────────────────────────────────────

function EmployeesTab({ canManage }: { canManage: boolean }) {
  const [departmentId, setDepartmentId] = useState<string>(ALL);
  const [role, setRole] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | undefined>(undefined);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserSummary | undefined>(undefined);

  const { data: users, isLoading } = useUsers();
  const { data: departments } = useDepartments();
  const { data: lastLogins } = useLastLogins({ enabled: canManage });

  const lastLoginByUser = useMemo(() => {
    const m = new Map<string, string | null>();
    (lastLogins ?? []).forEach((l) => m.set(l.userId, l.lastLoginAt));
    return m;
  }, [lastLogins]);

  const colCount = canManage ? 8 : 6;

  const filtered = useMemo(() => {
    return (users ?? []).filter((u) => {
      if (departmentId !== ALL && u.department?.id !== departmentId) return false;
      if (role !== ALL && u.role.name !== role) return false;
      if (status === "active" && !u.isActive) return false;
      if (status === "inactive" && u.isActive) return false;
      return true;
    });
  }, [users, departmentId, role, status]);

  function openCreate() {
    setEditingUser(undefined);
    setIsCreatingUser(true);
  }

  function openEdit(user: UserSummary) {
    setEditingUser(user);
    setIsCreatingUser(false);
  }

  function openChangePassword(user: UserSummary) {
    setPasswordUser(user);
    setChangePasswordOpen(true);
  }

  if (isCreatingUser || editingUser) {
    return (
      <div className="pt-2">
        <UserFormPagePanel
          user={editingUser}
          onBack={() => {
            setEditingUser(undefined);
            setIsCreatingUser(false);
          }}
          onCreated={() => {
            setEditingUser(undefined);
            setIsCreatingUser(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-48 rounded-xl border-slate-200 bg-white text-xs font-semibold">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-40 rounded-xl border-slate-200 bg-white text-xs font-semibold">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              {ROLE_NAMES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 rounded-xl border-slate-200 bg-white text-xs font-semibold">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-9 px-3.5 gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="size-4" />
            Add Employee
          </Button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-slate-50/80">
              <TableHead className="font-extrabold text-xs text-slate-600">Name</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Email</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Role</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Department</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Reports To</TableHead>
              {canManage && <TableHead className="font-extrabold text-xs text-slate-600">Last login</TableHead>}
              <TableHead className="font-extrabold text-xs text-slate-600">Status</TableHead>
              {canManage && <TableHead className="font-extrabold text-xs text-slate-600 text-right pr-4">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-slate-500 py-8">
                  <Loader2 className="size-4 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-slate-500 py-8 text-xs font-medium">
                  No employees match these filters.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((user) => (
              <TableRow
                key={user.id}
                className={`hover:bg-slate-50/70 transition-colors ${canManage ? "cursor-pointer" : ""}`}
                onClick={() => canManage && openEdit(user)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7 border border-slate-200 shrink-0">
                      <AvatarFallback className="text-[10px] font-black bg-blue-50 text-blue-700">
                        {getInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-extrabold text-slate-900">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-500 font-medium">{user.email}</TableCell>
                <TableCell>
                  <span className={`text-xs ${ROLE_TONE[user.role.name]}`}>
                    {getRoleLabel(user)}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-slate-600 font-medium">
                  {user.department?.name ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-slate-500 font-medium">
                  {user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : "—"}
                </TableCell>
                {canManage && (
                  <TableCell className="text-xs text-slate-500 font-medium">
                    {formatRelative(lastLoginByUser.get(user.id) ?? null)}
                  </TableCell>
                )}
                <TableCell>
                  <span
                    className={`inline-flex items-center text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      user.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 gap-1.5 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-2xs rounded-lg cursor-pointer"
                        onClick={() => openChangePassword(user)}
                        title={`Change password for ${user.firstName} ${user.lastName}`}
                      >
                        <KeyRound className="size-3.5 text-blue-600" />
                        <span>Change Password</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                          >
                            <MoreHorizontal className="size-3.5" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEdit(user)} className="gap-2 cursor-pointer text-xs font-medium">
                            <Pencil className="size-3.5 text-slate-400" />
                            <span>Edit Employee</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openChangePassword(user)} className="gap-2 cursor-pointer text-xs font-medium">
                            <KeyRound className="size-3.5 text-blue-600" />
                            <span>Change Password</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <ChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
          user={passwordUser}
        />
      )}
    </div>
  );
}

// ─── Existing Departments Tab ─────────────────────────────────────────────────

function DepartmentsTab({ canManage }: { canManage: boolean }) {
  const { data: departments, isLoading } = useDepartments();
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | undefined>(undefined);

  function openCreate() {
    setEditingDepartment(undefined);
    setIsCreatingDepartment(true);
  }

  function openEdit(department: Department) {
    setEditingDepartment(department);
    setIsCreatingDepartment(false);
  }

  if (isCreatingDepartment || editingDepartment) {
    return (
      <div className="pt-2">
        <DepartmentFormPagePanel
          department={editingDepartment}
          onBack={() => {
            setEditingDepartment(undefined);
            setIsCreatingDepartment(false);
          }}
          onCreated={() => {
            setEditingDepartment(undefined);
            setIsCreatingDepartment(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-9 px-3.5 gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="size-4" />
            Add Department
          </Button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-slate-50/80">
              <TableHead className="font-extrabold text-xs text-slate-600">Name</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Description</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Head</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Employees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                  <Loader2 className="size-4 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && departments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-8 text-xs font-medium">
                  No departments yet.
                </TableCell>
              </TableRow>
            )}
            {departments?.map((dept) => (
              <TableRow
                key={dept.id}
                className={`hover:bg-slate-50/70 transition-colors ${canManage ? "cursor-pointer" : ""}`}
                onClick={() => canManage && openEdit(dept)}
              >
                <TableCell className="text-xs font-extrabold text-slate-900">{dept.name}</TableCell>
                <TableCell className="text-xs text-slate-500 font-medium">{dept.description ?? "—"}</TableCell>
                <TableCell className="text-xs text-slate-600 font-medium">
                  {dept.head ? `${dept.head.firstName} ${dept.head.lastName}` : "—"}
                </TableCell>
                <TableCell className="text-xs font-bold text-slate-800">{dept._count.employees}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Login Activity Tab (HR/Admin) ────────────────────────────────────────────

function ActivityTab() {
  const [userId, setUserId] = useState<string>(ALL);
  const { data: users } = useUsers();
  const { data: events, isLoading } = useLoginEvents({
    userId: userId === ALL ? undefined : userId,
    limit: 300,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 font-medium">
          Sign-in and sign-out history across the company. Newest first.
        </p>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-56 rounded-xl border-slate-200 bg-white text-xs font-semibold">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {(users ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-slate-50/80">
              <TableHead className="font-extrabold text-xs text-slate-600">Employee</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Event</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">When</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">Device</TableHead>
              <TableHead className="font-extrabold text-xs text-slate-600">IP address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  <Loader2 className="size-4 animate-spin mx-auto text-blue-600" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (events ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8 text-xs font-medium">
                  No login activity recorded yet.
                </TableCell>
              </TableRow>
            )}
            {(events ?? []).map((e) => {
              const isLogin = e.type === "LOGIN";
              return (
                <TableRow key={e.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6 border border-slate-200">
                        <AvatarFallback className="text-[10px] font-black bg-blue-50 text-blue-700">
                          {getInitials(e.user)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-bold text-slate-900">
                        {e.user.firstName} {e.user.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        isLogin
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {isLogin ? <LogIn className="size-3" /> : <LogOut className="size-3" />}
                      {isLogin ? "Signed in" : "Signed out"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 font-medium" title={formatDateTime(e.createdAt)}>
                    {formatRelative(e.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 font-medium">{formatDevice(e.userAgent)}</TableCell>
                  <TableCell className="text-xs text-slate-600 font-mono">{e.ipAddress ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
