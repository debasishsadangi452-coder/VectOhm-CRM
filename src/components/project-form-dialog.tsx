import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Github, Loader2, Plus, X } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import {
  useCreateProject,
  useUpdateProject,
  useProject,
  useAddProjectMember,
  useRemoveProjectMember,
} from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { useGithubConnection } from "@/hooks/use-github";
import { useAuthStore } from "@/stores/auth-store";
import type { Project } from "@/lib/api/types";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}

export function ProjectFormDialog({ open, onOpenChange, project }: ProjectFormDialogProps) {
  const isEdit = !!project;
  const currentUser = useAuthStore((s) => s.user);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { data: githubConnection } = useGithubConnection();
  const githubConnected = !!githubConnection?.connected;

  // Full detail (members list) is only needed while editing.
  const { data: detail } = useProject(isEdit ? project!.id : undefined);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectPassword, setProjectPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setStartDate(project?.startDate ? project.startDate.slice(0, 10) : "");
    setDueDate(project?.dueDate ? project.dueDate.slice(0, 10) : "");
    setProjectPassword(project?.projectPassword ?? "");
    setError(null);
  }, [open, project]);

  const saving = createProject.isPending || updateProject.isPending;
  const githubUrl = detail?.githubUrl ?? project?.githubUrl ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      name,
      description: description || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      projectPassword: projectPassword || null,
    };
    try {
      if (isEdit && project) {
        await updateProject.mutateAsync({ id: project.id, input });
      } else {
        await createProject.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save project");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-start">Start date</Label>
              <Input
                id="project-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-due">Due date</Label>
              <Input
                id="project-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* GitHub repo -- app-managed, not free text */}
          {githubUrl ? (
            <div className="space-y-1.5">
              <Label>GitHub repository</Label>
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
              >
                <Github className="size-4 shrink-0" />
                {githubUrl}
              </a>
            </div>
          ) : !isEdit && githubConnected ? (
            <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-canvas/50 px-3 py-2 text-xs text-text-dim">
              <Github className="size-3.5 shrink-0" />
              A private GitHub repo will be created automatically for this project.
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="project-password">Project Environment Password / Key</Label>
            <Input
              id="project-password"
              type="text"
              value={projectPassword}
              onChange={(e) => setProjectPassword(e.target.value)}
              placeholder="Access credentials, keys, or passwords"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>

        {/* Collaborators -- only when editing an existing project */}
        {isEdit && project && (
          <CollaboratorsSection
            projectId={project.id}
            hasRepo={!!githubUrl}
            memberIds={detail?.members.map((m) => m.id) ?? []}
            members={detail?.members ?? []}
            currentDepartmentId={currentUser?.department?.id}
            isAdmin={currentUser?.role.name === "ADMIN"}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CollaboratorsSection({
  projectId,
  hasRepo,
  memberIds,
  members,
  currentDepartmentId,
  isAdmin,
}: {
  projectId: string;
  hasRepo: boolean;
  memberIds: string[];
  members: { id: string; firstName: string; lastName: string; githubUsername: string | null }[];
  currentDepartmentId: string | undefined;
  isAdmin: boolean;
}) {
  const { data: users } = useUsers();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Same scoping as the deal owner picker: Admin can add anyone, others only
  // their own department. Exclude people already on the project.
  const addableUsers = useMemo(() => {
    const scoped = isAdmin ? users : users?.filter((u) => u.department?.id === currentDepartmentId);
    return (scoped ?? []).filter((u) => !memberIds.includes(u.id));
  }, [users, isAdmin, currentDepartmentId, memberIds]);

  async function handleAdd() {
    if (!selected) return;
    setNotice(null);
    const result = await addMember.mutateAsync({ projectId, userId: selected });
    setSelected("");
    if (result.githubInvited) {
      setNotice("Added — and invited to the GitHub repo.");
    }
  }

  return (
    <div className="border-t border-border-subtle pt-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Collaborators</h3>
        <p className="text-[11px] text-text-dim mt-0.5">
          {hasRepo
            ? "Members with a linked GitHub username are auto-invited to the repo."
            : "This project has no GitHub repo, so members are internal only."}
        </p>
      </div>

      <div className="space-y-1.5">
        {members.length === 0 && <p className="text-xs text-text-dim">No collaborators yet.</p>}
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2.5 rounded-md border border-border-subtle bg-canvas/40 px-2.5 py-1.5"
          >
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[9px]">
                {getInitials(m)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm flex-1 truncate">
              {m.firstName} {m.lastName}
            </span>
            {m.githubUsername ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Github className="size-3" />
                {m.githubUsername}
              </Badge>
            ) : (
              <span className="text-[10px] text-text-dim">no GitHub linked</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-text-dim hover:text-destructive"
              onClick={() => removeMember.mutate({ projectId, userId: m.id })}
              disabled={removeMember.isPending}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Add a teammate…" />
          </SelectTrigger>
          <SelectContent>
            {addableUsers.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-text-dim">No one else to add.</div>
            ) : (
              addableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                  {u.githubUsername ? "" : " (no GitHub)"}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button type="button" onClick={handleAdd} disabled={!selected || addMember.isPending}>
          {addMember.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>

      {notice && <p className="text-xs text-success">{notice}</p>}
    </div>
  );
}
