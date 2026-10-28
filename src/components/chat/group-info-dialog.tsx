import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, LogOut, Pencil, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PeoplePicker } from "@/components/chat/people-picker";
import { useAddGroupMembers, useRemoveGroupMember, useUpdateGroup } from "@/hooks/use-chat";
import type { ChatChannel, UserSummary } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

// A group's details: members (with who is an admin), rename, add people and leave. Only group admins
// can rename, add or remove; anyone can leave.
export function GroupInfoDialog({
  group,
  onOpenChange,
  users,
  currentUserId,
  onLeft,
}: {
  group: ChatChannel | null;
  onOpenChange: (open: boolean) => void;
  users: UserSummary[];
  currentUserId: string | undefined;
  onLeft: () => void;
}) {
  const updateGroup = useUpdateGroup();
  const addMembers = useAddGroupMembers();
  const removeMember = useRemoveGroupMember();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);

  useEffect(() => {
    setEditing(false);
    setAdding(false);
    setToAdd([]);
    setName(group?.name ?? "");
  }, [group?.id]);

  const me = group?.members.find((m) => m.userId === currentUserId);
  const isAdmin = !!me?.isAdmin;
  const memberIds = useMemo(() => group?.members.map((m) => m.userId) ?? [], [group]);
  const candidates = useMemo(() => users.filter((u) => u.isActive), [users]);

  if (!group) return null;

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failure);
    }
  };

  const saveName = () =>
    run(async () => {
      if (!name.trim() || name.trim() === group.name) return setEditing(false);
      await updateGroup.mutateAsync({ groupId: group.id, name: name.trim() });
      setEditing(false);
    }, "Could not rename the group");

  const addSelected = () =>
    run(async () => {
      await addMembers.mutateAsync({ groupId: group.id, userIds: toAdd });
      setToAdd([]);
      setAdding(false);
    }, "Could not add those people");

  const leave = () =>
    run(async () => {
      if (!window.confirm(`Leave "${group.name}"?`)) return;
      await removeMember.mutateAsync({ groupId: group.id, userId: currentUserId! });
      onOpenChange(false);
      onLeft();
    }, "Could not leave the group");

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group info</DialogTitle>
          <DialogDescription className="sr-only">Members and settings for this group</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="h-9" />
                <Button size="icon" className="size-9 shrink-0" onClick={saveName} disabled={updateGroup.isPending}>
                  {updateGroup.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                </Button>
              </>
            ) : (
              <>
                <h3 className="flex-1 truncate text-base font-semibold">{group.name}</h3>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(true)} title="Rename group">
                    <Pencil className="size-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          {group.description && <p className="text-xs text-text-dim">{group.description}</p>}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                {group.members.length} members
              </span>
              {isAdmin && !adding && (
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setAdding(true)}>
                  <UserPlus className="size-3.5" /> Add people
                </Button>
              )}
            </div>

            {adding ? (
              <div className="space-y-2">
                <PeoplePicker
                  people={candidates}
                  selectedIds={toAdd}
                  onChange={setToAdd}
                  disabledIds={memberIds}
                  height="h-56"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setAdding(false); setToAdd([]); }}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={toAdd.length === 0 || addMembers.isPending} onClick={addSelected}>
                    {addMembers.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                    Add {toAdd.length > 0 ? toAdd.length : ""}
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="max-h-72 rounded-lg border border-border-subtle">
                <ul className="divide-y divide-border-subtle">
                  {group.members.map((m) => (
                    <li key={m.userId} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <Avatar className="size-8 bg-primary/10">
                        <AvatarFallback className="text-[10px]">{getInitials(m.user)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate font-medium">
                        {m.user.firstName} {m.user.lastName}
                        {m.userId === currentUserId && <span className="ml-1 font-normal text-text-dim">(you)</span>}
                      </span>
                      {m.isAdmin && (
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                          Group admin
                        </span>
                      )}
                      {isAdmin && m.userId !== currentUserId && (
                        <button
                          type="button"
                          onClick={() =>
                            run(
                              () => removeMember.mutateAsync({ groupId: group.id, userId: m.userId }),
                              "Could not remove that person",
                            )
                          }
                          className="rounded p-1 text-text-dim hover:bg-destructive/10 hover:text-destructive"
                          title="Remove from group"
                        >
                          <UserMinus className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>

          <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive" onClick={leave}>
            <LogOut className="size-4" /> Leave group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
