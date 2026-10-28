import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PeoplePicker } from "@/components/chat/people-picker";
import { useCreateGroup } from "@/hooks/use-chat";
import type { UserSummary } from "@/lib/api/types";

// Create a private group with any colleagues. You are added automatically and become its admin.
export function NewGroupDialog({
  open,
  onOpenChange,
  users,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserSummary[];
  currentUserId: string | undefined;
  onCreated: (channelId: string) => void;
}) {
  const createGroup = useCreateGroup();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setMemberIds([]);
    }
  }, [open]);

  const people = useMemo(
    () => users.filter((u) => u.isActive && u.id !== currentUserId),
    [users, currentUserId],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || memberIds.length === 0) return;
    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds,
      });
      onOpenChange(false);
      onCreated(group.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the group");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription className="text-xs text-text-dim">
            Pick any colleagues. Only people in the group can see it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Night shift crew"
              maxLength={80}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-description">Description (optional)</Label>
            <Input
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group for?"
              maxLength={300}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Members <span className="font-normal text-text-dim">({memberIds.length} selected)</span>
            </Label>
            <PeoplePicker people={people} selectedIds={memberIds} onChange={setMemberIds} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || memberIds.length === 0 || createGroup.isPending}>
              {createGroup.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
