import { createFileRoute } from "@tanstack/react-router";
import { Edit2, Loader2, Settings, TrendingUp, Users2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeals, useApproveDeal, useRejectDeal } from "@/hooks/use-deals";
import { useUsers } from "@/hooks/use-users";
import { useDepartments, useUpdateDepartmentSettings } from "@/hooks/use-departments";
import { useUpdateUserTarget } from "@/hooks/use-users";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_app/sales")({
  component: TeamPerformancePage,
});

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function TeamPerformancePage() {
  const currentUser = useAuthStore((s) => s.user);
  // Team Performance is a deals/win-rate/quota view -- only the Sales
  // department (+ Admin) has deals, so it's Sales-scoped. Other departments'
  // managers would just see a zeroed-out, irrelevant dashboard.
  useDepartmentGuard("Sales", { managerOnly: true });

  const { data: deals } = useDeals({});
  const { data: users } = useUsers();
  const { data: departments } = useDepartments();

  const departmentId = currentUser?.department?.id;
  const department = departments?.find((d) => d.id === departmentId);
  const teamMembers = (users ?? []).filter((u) => u.department?.id === departmentId);

  const monthStart = startOfMonth();
  const wonThisMonth = (deals ?? []).filter(
    (d) => d.stage === "WON" && d.closedAt && new Date(d.closedAt) >= monthStart,
  );
  const lostThisMonth = (deals ?? []).filter(
    (d) => d.stage === "LOST" && d.closedAt && new Date(d.closedAt) >= monthStart,
  );
  const departmentActual = wonThisMonth.reduce((sum, d) => sum + d.value, 0);

  const memberStats = teamMembers.map((member) => {
    const openDeals = (deals ?? []).filter(
      (d) => d.ownerId === member.id && !["WON", "LOST", "ARCHIVED"].includes(d.stage),
    );
    const won = wonThisMonth.filter((d) => d.ownerId === member.id);
    const lost = lostThisMonth.filter((d) => d.ownerId === member.id);
    const totalClosed = won.length + lost.length;
    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      openCount: openDeals.length,
      openValue: openDeals.reduce((sum, d) => sum + d.value, 0),
      wonValue: won.reduce((sum, d) => sum + d.value, 0),
      winRate: totalClosed > 0 ? Math.round((won.length / totalClosed) * 100) : null,
      target: member.monthlyTarget,
    };
  });

  // Department Settings Dialog State
  const [deptSettingsOpen, setDeptSettingsOpen] = useState(false);
  const [deptTarget, setDeptTarget] = useState("");
  const [deptThreshold, setDeptThreshold] = useState("");

  // User Target Dialog State
  const [userTargetOpen, setUserTargetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; target: number | null } | null>(null);
  const [userTargetVal, setUserTargetVal] = useState("");

  const updateDeptSettings = useUpdateDepartmentSettings();
  const updateUserTarget = useUpdateUserTarget();

  const approveDeal = useApproveDeal();
  const rejectDeal = useRejectDeal();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const pendingDeals = (deals ?? []).filter(
    (d) => d.approvalStatus === "PENDING" && d.departmentId === departmentId,
  );

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await approveDeal.mutateAsync(id);
    } catch (err) {
      console.error("Failed to approve deal", err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      await rejectDeal.mutateAsync(id);
    } catch (err) {
      console.error("Failed to reject deal", err);
    } finally {
      setRejectingId(null);
    }
  };

  useEffect(() => {
    if (department) {
      setDeptTarget(department.monthlyTarget != null ? String(department.monthlyTarget) : "");
      setDeptThreshold(department.dealApprovalThreshold != null ? String(department.dealApprovalThreshold) : "10000");
    }
  }, [department, deptSettingsOpen]);

  useEffect(() => {
    if (selectedUser) {
      setUserTargetVal(selectedUser.target != null ? String(selectedUser.target) : "");
      setUserTargetOpen(true);
    } else {
      setUserTargetOpen(false);
    }
  }, [selectedUser]);

  const handleSaveDeptSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!departmentId) return;
    try {
      await updateDeptSettings.mutateAsync({
        id: departmentId,
        input: {
          monthlyTarget: deptTarget ? Number(deptTarget) : null,
          dealApprovalThreshold: deptThreshold ? Number(deptThreshold) : 10000,
        },
      });
      setDeptSettingsOpen(false);
    } catch (err) {
      console.error("Failed to update department settings", err);
    }
  };

  const handleSaveUserTarget = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await updateUserTarget.mutateAsync({
        id: selectedUser.id,
        monthlyTarget: userTargetVal ? Number(userTargetVal) : null,
      });
      setSelectedUser(null);
    } catch (err) {
      console.error("Failed to update user target", err);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <TrendingUp className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Performance</h1>
          <p className="text-sm text-text-dim mt-1">
            {department ? `${department.name} team` : "Your team"} · deals, win rate, and quota
            progress this month.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Won this month" value={`$${departmentActual.toLocaleString()}`} />
        <StatCard label="Deals closed won" value={String(wonThisMonth.length)} />
        <div className="relative">
          <TargetCard
            label="Department target"
            actual={departmentActual}
            target={department?.monthlyTarget ?? null}
            threshold={department?.dealApprovalThreshold ?? null}
          />
          {department && (
            <button
              onClick={() => setDeptSettingsOpen(true)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-panel-elevated text-text-dim hover:text-primary transition-colors"
              title="Configure department settings"
            >
              <Settings className="size-4" />
            </button>
          )}
        </div>
      </div>

      {pendingDeals.length > 0 && (
        <div className="bg-panel border border-amber-500/30 rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs uppercase tracking-wider">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            Awaiting Deal Approvals ({pendingDeals.length})
          </div>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {pendingDeals.map((deal) => (
              <div key={deal.id} className="p-3 bg-panel-elevated rounded-lg flex items-center justify-between gap-4 border border-border-subtle/50">
                <div>
                  <h4 className="text-xs font-semibold text-text">{deal.title}</h4>
                  <p className="text-[10px] text-text-dim mt-0.5">
                    Value: <span className="font-semibold text-text">${deal.value.toLocaleString()}</span> · Requester: {deal.owner.firstName} {deal.owner.lastName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(deal.id)}
                    disabled={approvingId === deal.id || rejectingId === deal.id}
                    className="h-7 text-[10px] px-3 font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {approvingId === deal.id ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(deal.id)}
                    disabled={approvingId === deal.id || rejectingId === deal.id}
                    className="h-7 text-[10px] px-3 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold"
                  >
                    {rejectingId === deal.id ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
          <Users2 className="size-4 text-text-dim" />
          <span className="text-sm font-semibold">Team members</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Open deals</TableHead>
              <TableHead>Open pipeline value</TableHead>
              <TableHead>Won this month</TableHead>
              <TableHead>Win rate</TableHead>
              <TableHead>Monthly target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-dim py-8">
                  No team members in this department yet.
                </TableCell>
              </TableRow>
            )}
            {memberStats.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(m)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {m.firstName} {m.lastName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-text-dim">{m.openCount}</TableCell>
                <TableCell className="text-text-dim">${m.openValue.toLocaleString()}</TableCell>
                <TableCell className="text-text-dim">${m.wonValue.toLocaleString()}</TableCell>
                <TableCell className="text-text-dim">{m.winRate != null ? `${m.winRate}%` : "—"}</TableCell>
                <TableCell className="text-text-dim">
                  <div className="flex items-center gap-2 group/target">
                    {m.target != null ? (
                      <MiniTargetBar actual={m.wonValue} target={m.target} />
                    ) : (
                      <span className="text-xs text-text-dim italic">No target set</span>
                    )}
                    <button
                      onClick={() => setSelectedUser({ id: m.id, name: `${m.firstName} ${m.lastName}`, target: m.target })}
                      className="p-1 rounded hover:bg-panel-elevated opacity-0 group-hover/target:opacity-100 transition-opacity"
                      title="Edit target"
                    >
                      <Edit2 className="size-3 text-text-dim hover:text-primary" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Department Settings Dialog */}
      <Dialog open={deptSettingsOpen} onOpenChange={setDeptSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Department Settings</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDeptSettings} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dept-settings-target">Department Monthly Target ($)</Label>
              <Input
                id="dept-settings-target"
                type="number"
                min={0}
                value={deptTarget}
                onChange={(e) => setDeptTarget(e.target.value)}
                placeholder="No target set"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-settings-threshold">Deal Approval Threshold ($)</Label>
              <Input
                id="dept-settings-threshold"
                type="number"
                min={0}
                value={deptThreshold}
                onChange={(e) => setDeptThreshold(e.target.value)}
                placeholder="10000"
              />
              <p className="text-[10px] text-text-dim mt-1">
                Deals closed as Won by plain Employees that exceed this value will require Manager or Admin approval.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeptSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateDeptSettings.isPending}>
                {updateDeptSettings.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Target Dialog */}
      <Dialog open={userTargetOpen} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Target: {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUserTarget} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-target-input">Monthly Target ($)</Label>
              <Input
                id="user-target-input"
                type="number"
                min={0}
                value={userTargetVal}
                onChange={(e) => setUserTargetVal(e.target.value)}
                placeholder="No target set"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserTarget.isPending}>
                {updateUserTarget.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Set Target
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-text-dim">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums mt-2">{value}</p>
    </div>
  );
}

function TargetCard({
  label,
  actual,
  target,
  threshold,
}: {
  label: string;
  actual: number;
  target: number | null;
  threshold?: number | null;
}) {
  const pct = target && target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-4 flex flex-col justify-between h-full min-h-[106px]">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-text-dim">{label}</p>
        {target != null ? (
          <>
            <p className="text-2xl font-semibold tracking-tight tabular-nums mt-2">
              ${actual.toLocaleString()} <span className="text-sm text-text-dim">/ ${target.toLocaleString()}</span>
            </p>
            <div className="h-1.5 w-full bg-panel-elevated rounded-full overflow-hidden mt-2">
              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p className="text-sm text-text-dim mt-2">No target set</p>
        )}
      </div>
      {threshold != null && (
        <div className="mt-3 pt-2 border-t border-border-subtle/50 text-[10px] text-text-dim flex justify-between">
          <span>Approval threshold</span>
          <span className="font-mono font-medium">${threshold.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

function MiniTargetBar({ actual, target }: { actual: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 flex-1 bg-panel-elevated rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono shrink-0">${actual.toLocaleString()} / ${target.toLocaleString()}</span>
    </div>
  );
}
