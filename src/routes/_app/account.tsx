import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Loader2,
  UserCircle2,
  Github,
  KeyRound,
  CheckCircle2,
  PenLine,
  Upload,
  Camera,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUsers, useUpdateMyProfile, useUploadAvatar, useUpdateGithubUsername } from "@/hooks/use-users";
import { useRequestPasswordReset } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { getRoleLabel } from "@/lib/role-label";
import { ApiError, resolveApiAssetUrl } from "@/lib/api/client";
import { isDepartmentMatch } from "@/hooks/use-department-guard";
import { BulkEmailSenderSection } from "@/components/bulk-email-sender-section";
import { LinkedInAccountSection } from "@/components/linkedin-account-section";
import { EmailSignatureEditor } from "@/components/email-signature-editor";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
  // Set by EmailOAuthController's callback redirect (a plain top-level
  // navigation, so this is the only way it can hand back a result).
  validateSearch: (search: Record<string, unknown>): { emailConnect?: string } => ({
    emailConnect: typeof search.emailConnect === "string" ? search.emailConnect : undefined,
  }),
});

function AccountPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: users } = useUsers();
  const me = useMemo(() => users?.find((u) => u.id === currentUser?.id), [users, currentUser]);
  const { emailConnect } = Route.useSearch();

  useEffect(() => {
    if (emailConnect === "success") {
      toast.success("Mailbox connected -- sent and received mail will start syncing shortly.");
    } else if (emailConnect === "denied") {
      toast.error("Mailbox connection was cancelled.");
    } else if (emailConnect === "error") {
      toast.error("Couldn't connect that mailbox -- try again.");
    }
    // Only meant to fire once per redirect landing, not on every render.
  }, [emailConnect]);

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <UserCircle2 className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Account</h1>
          <p className="text-sm text-text-dim mt-1">
            Update your personal details, password, and security preferences.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <ProfileSection meLoaded={!!me} email={me?.email ?? currentUser?.email ?? ""} />
        {/* GitHub linking only does anything for Dev (repo collaborator
            invites, commit/PR attribution) -- see github.service.ts /
            webhooks.service.ts. Not shown for other departments. */}
        {me?.department?.name === "Dev" && (
          <GithubSection userId={currentUser?.id} initial={me?.githubUsername ?? ""} />
        )}
        {/* Bulk email sender and signature for Sales, Recruitment, and Admin --
            aligns with canUseSalesOrRecruitment on the backend for bulk outreach & intent hiring. */}
        {(isDepartmentMatch(me?.department?.name ?? currentUser?.department?.name, "Sales") ||
          isDepartmentMatch(me?.department?.name ?? currentUser?.department?.name, "Recruitment") ||
          currentUser?.role.name === "ADMIN") && (
          <>
            <BulkEmailSenderSection />
            <LinkedInAccountSection />
            <Card title="Email signature" icon={PenLine}>
              <p className="-mt-1 text-sm text-text-dim">
                Appended to templates and campaigns that ask for it. Yours follows you, so a
                shared template signs off as whoever actually sent it.
              </p>
              <EmailSignatureEditor />
            </Card>
          </>
        )}
        <PasswordSection email={me?.email ?? currentUser?.email ?? ""} />
        {me && (
          <p className="text-[11px] text-text-dim">
            Signed in as <span className="font-medium">{getRoleLabel(me)}</span>
            {me.department ? ` · ${me.department.name}` : ""}. Role and department are managed by
            HR/Admin.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Existing Profile / Github / Password sections ────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-text-dim" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ProfileSection({ meLoaded, email }: { meLoaded: boolean; email: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: users } = useUsers();
  const me = useMemo(() => users?.find((u) => u.id === currentUser?.id), [users, currentUser]);
  const updateProfile = useUpdateMyProfile();
  const uploadAvatarMutation = useUploadAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me) {
      setFirstName(me.firstName);
      setLastName(me.lastName);
      setAvatarUrl(me.avatarUrl ?? "");
    }
  }, [me]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp|gif)$/i)) {
      toast.error("Please select a valid image file (PNG, JPG, WebP, GIF)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be under 5MB");
      return;
    }
    try {
      setIsUploading(true);
      const updated = await uploadAvatarMutation.mutateAsync(file);
      setAvatarUrl(updated.avatarUrl ?? "");
      toast.success("Profile photo uploaded successfully");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload photo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsUploading(true);
      await updateProfile.mutateAsync({
        firstName,
        lastName,
        avatarUrl: null,
      });
      setAvatarUrl("");
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error("Failed to remove photo");
    } finally {
      setIsUploading(false);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateProfile.mutateAsync({
        firstName,
        lastName,
        avatarUrl: avatarUrl.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save profile");
    }
  }

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <Card title="Profile" icon={UserCircle2}>
      {!meLoaded ? (
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Upload Container */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl bg-surface-subtle/50 border border-border-subtle">
            <div
              className="relative group cursor-pointer shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload photo"
            >
              <Avatar className="size-20 border-2 border-border-subtle shadow-sm transition-opacity group-hover:opacity-85">
                {avatarUrl ? (
                  <AvatarImage
                    src={resolveApiAssetUrl(avatarUrl)}
                    alt={`${firstName} ${lastName}`}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <Loader2 className="size-6 text-white animate-spin" />
                ) : (
                  <Camera className="size-6 text-white drop-shadow" />
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Profile Photo</h3>
                <p className="text-xs text-text-dim mt-0.5">
                  Upload your avatar image (PNG, JPG, WebP, or GIF up to 5MB).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  disabled={isUploading || uploadAvatarMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {avatarUrl ? "Change photo" : "Upload photo"}
                </Button>

                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isUploading || updateProfile.isPending}
                    onClick={handleRemoveAvatar}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acct-first">First name</Label>
              <Input
                id="acct-first"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-last">Last name</Label>
              <Input
                id="acct-last"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} disabled readOnly />
            <p className="text-[11px] text-text-dim">
              Your email is your login and can't be changed. Contact HR/Admin if it's wrong.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save profile"
              )}
            </Button>
            {saved && !updateProfile.isPending && (
              <span className="text-xs text-success">Saved.</span>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

function GithubSection({ userId, initial }: { userId: string | undefined; initial: string }) {
  const updateGithub = useUpdateGithubUsername();
  const [githubUsername, setGithubUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGithubUsername(initial);
  }, [initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setSaved(false);
    try {
      await updateGithub.mutateAsync({ id: userId, githubUsername: githubUsername.trim() || null });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save GitHub username");
    }
  }

  return (
    <Card title="GitHub" icon={Github}>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="acct-github">GitHub username</Label>
          <Input
            id="acct-github"
            value={githubUsername}
            onChange={(e) => {
              setGithubUsername(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. octocat"
          />
          <p className="text-[11px] text-text-dim">
            Links your commits &amp; PRs (and repo collaborator invites) to your account.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={updateGithub.isPending}>
            {updateGithub.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
          {saved && !updateGithub.isPending && <span className="text-xs text-success">Saved.</span>}
        </div>
      </form>
    </Card>
  );
}

function PasswordSection({ email }: { email: string }) {
  const requestReset = useRequestPasswordReset();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    try {
      await requestReset.mutateAsync({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send reset link");
    }
  }

  return (
    <Card title="Password" icon={KeyRound}>
      {sent ? (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 max-w-md">
          <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
          <div className="text-sm">
            If an account exists for <span className="font-medium">{email}</span>, a password reset
            link is on its way. The link expires in 1 hour.
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-w-md">
          <p className="text-sm text-text-dim">
            For your security, passwords are changed via an emailed reset link rather than in place.
            We'll send a link to <span className="font-medium text-foreground">{email}</span>.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" onClick={handleReset} disabled={requestReset.isPending || !email}>
            {requestReset.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Email me a reset link"
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
