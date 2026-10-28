import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Camera, ImageOff, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteLoginPhoto, useLoginPhotos, useLoginPhotoImage } from "@/hooks/use-login-photos";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginPhoto } from "@/lib/api/login-photos";

export const Route = createFileRoute("/_app/login-photos")({
  component: LoginPhotosPage,
});

const ALL = "__all__";

function LoginPhotosPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  // Same visibility rule and "component-level effect, not beforeLoad" guard
  // as screen-monitoring.tsx (Admin, HR, or any department Manager).
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role.name === "ADMIN";
    const isHR = currentUser.department?.name === "HR";
    const isManager = currentUser.role.name === "MANAGER";
    if (!isAdmin && !isHR && !isManager) {
      navigate({ to: "/" });
    }
  }, [currentUser, navigate]);

  const isAdminOrHR = currentUser?.role.name === "ADMIN" || currentUser?.department?.name === "HR";
  const { data: users } = useUsers();
  const selectableUsers = useMemo(
    () =>
      isAdminOrHR
        ? (users ?? [])
        : (users ?? []).filter((u) => u.department?.id === currentUser?.department?.id),
    [users, isAdminOrHR, currentUser],
  );

  const [userId, setUserId] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const { data: photos, isLoading } = useLoginPhotos({
    ...(userId === ALL ? {} : { userId }),
    ...(typeFilter === ALL ? {} : { type: typeFilter }),
  });
  const [viewing, setViewing] = useState<LoginPhoto | undefined>(undefined);
  const deletePhoto = useDeleteLoginPhoto();

  function handleDelete(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this login photo? This can't be undone.")) return;
    deletePhoto.mutate(id);
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Camera className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Login Photos</h1>
          <p className="text-sm text-text-dim mt-1">
            A photo captured via webcam when an employee clocks in or out, per company policy.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {selectableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All events</SelectItem>
            <SelectItem value="CLOCK_IN">Clock In (Online)</SelectItem>
            <SelectItem value="CLOCK_OUT">Clock Out (Offline)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Captured At</TableHead>
              {isAdminOrHR && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={isAdminOrHR ? 5 : 4} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && photos?.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdminOrHR ? 5 : 4} className="text-center text-text-dim py-8">
                  No login photos match these filters.
                </TableCell>
              </TableRow>
            )}
            {photos?.map((photo) => {
              const isClockOut = photo.type === "CLOCK_OUT" || photo.type === "LOGOUT";
              return (
                <TableRow key={photo.id} className="cursor-pointer" onClick={() => setViewing(photo)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(photo.user)}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {photo.user.firstName} {photo.user.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-text-dim">{photo.user.department?.name ?? "—"}</TableCell>
                  <TableCell>
                    {isClockOut ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                        Clock Out (Offline)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                        Clock In (Online)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-text-dim">
                    {new Date(photo.capturedAt).toLocaleString()}
                  </TableCell>
                  {isAdminOrHR && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-text-dim hover:text-destructive"
                        onClick={(e) => handleDelete(e, photo.id)}
                        disabled={deletePhoto.isPending}
                        title="Delete this login photo"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PhotoViewerDialog
        photo={viewing}
        onOpenChange={(open) => !open && setViewing(undefined)}
        canDelete={isAdminOrHR}
        onDelete={(id) => {
          deletePhoto.mutate(id);
          setViewing(undefined);
        }}
        deleting={deletePhoto.isPending}
      />
    </div>
  );
}

function PhotoViewerDialog({
  photo,
  onOpenChange,
  canDelete,
  onDelete,
  deleting,
}: {
  photo: LoginPhoto | undefined;
  onOpenChange: (open: boolean) => void;
  canDelete: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const imageUrl = useLoginPhotoImage(photo?.id);
  const isClockOut = photo?.type === "CLOCK_OUT" || photo?.type === "LOGOUT";

  return (
    <Dialog open={!!photo} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span>
              {photo ? `${photo.user.firstName} ${photo.user.lastName} · ${new Date(photo.capturedAt).toLocaleString()}` : ""}
            </span>
            {photo && (
              isClockOut ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
                  <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                  Clock Out
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Clock In
                </span>
              )
            )}
          </DialogTitle>
        </DialogHeader>
        {imageUrl ? (
          <img src={imageUrl} alt="Login photo" className="w-full rounded-lg border border-border-subtle" />
        ) : (
          <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
            <ImageOff className="size-4" />
            Loading…
          </div>
        )}
        {canDelete && photo && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive gap-1.5 self-start"
            onClick={() => {
              if (!confirm("Delete this login photo? This can't be undone.")) return;
              onDelete(photo.id);
            }}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete photo
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
