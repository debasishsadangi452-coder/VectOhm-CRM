import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContacts } from "@/hooks/use-contacts";
import { useUsers } from "@/hooks/use-users";
import { useCreateCallCampaign } from "@/hooks/use-telephony";

const UNASSIGNED = "__unassigned__";

// Builds a power-dialer calling list (§12) -- pick a name, the leads to work,
// and optionally hand the whole list to one agent up front. Left unassigned,
// any Sales member can claim leads from it via the queue (see
// CallCampaignsService.claimNext).
export function CreateCallCampaignDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: contacts } = useContacts({}, open);
  const { data: users } = useUsers(open);
  const createCampaign = useCreateCallCampaign();

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignToId, setAssignToId] = useState(UNASSIGNED);

  const salesUsers = useMemo(
    () => (users ?? []).filter((u) => u.department?.name === "Sales"),
    [users],
  );

  const withPhone = useMemo(() => (contacts ?? []).filter((c) => !!c.phone), [contacts]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withPhone;
    return withPhone.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q));
  }, [withPhone, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setName("");
    setSearch("");
    setSelected(new Set());
    setAssignToId(UNASSIGNED);
  }

  async function handleCreate() {
    if (!name.trim() || selected.size === 0) return;
    await createCampaign.mutateAsync({
      name: name.trim(),
      contactIds: Array.from(selected),
      assignToId: assignToId === UNASSIGNED ? undefined : assignToId,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New calling list</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. US SaaS Leads - August"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Assign to (optional)</Label>
            <Select value={assignToId} onValueChange={setAssignToId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Leave open — any Sales rep can claim</SelectItem>
                {salesUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Leads ({selected.size} selected)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-text-dim" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts with a phone number…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <ScrollArea className="h-56 rounded-md border border-border-subtle">
              <div className="p-1">
                {filtered.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-canvas/50 cursor-pointer text-sm"
                  >
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <span className="truncate">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="text-text-dim text-xs ml-auto shrink-0">{c.phone}</span>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-text-dim px-2 py-4 text-center">
                    No contacts with a phone number match.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || selected.size === 0 || createCampaign.isPending}
          >
            {createCampaign.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
