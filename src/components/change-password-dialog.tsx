import { useState, useEffect, type FormEvent } from "react";
import { KeyRound, Eye, EyeOff, Sparkles, Copy, Check, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUpdateUser } from "@/hooks/use-users";
import { toast } from "sonner";
import { getRoleLabel } from "@/lib/role-label";
import type { UserSummary } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserSummary;
}

// Generates an easy-to-read, secure random password (12 chars)
function generateSecurePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const specials = "!@#$%^&*";
  let pass = "";
  for (let i = 0; i < 9; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  pass += specials.charAt(Math.floor(Math.random() * specials.length));
  for (let i = 0; i < 2; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export function ChangePasswordDialog({ open, onOpenChange, user }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUser = useUpdateUser();

  useEffect(() => {
    if (!open) return;
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setCopied(false);
    setError(null);
  }, [open, user]);

  function handleGeneratePassword() {
    const generated = generateSecurePassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setError(null);
  }

  async function handleCopy() {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) return;

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      await updateUser.mutateAsync({
        id: user.id,
        input: { password: newPassword },
      });
      toast.success(`Password updated for ${user.firstName} ${user.lastName}`);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password. Please try again.";
      setError(msg);
    }
  }

  if (!user) return null;

  const isSaving = updateUser.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-1">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
              <KeyRound className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Change Password</DialogTitle>
              <DialogDescription className="text-xs text-text-dim">
                Set new login credentials for this staff member.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User preview banner */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-panel-elevated/60 border border-border-subtle">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="text-xs font-medium">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-primary/15 text-primary border border-primary/20 shrink-0">
                {getRoleLabel(user)}
              </span>
            </div>
            <p className="text-xs text-text-dim truncate">{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* New Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="chg-new-password">New Password</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGeneratePassword}
                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary/90 hover:bg-primary/10"
              >
                <Sparkles className="size-3" />
                Generate Secure
              </Button>
            </div>
            <div className="relative">
              <Input
                id="chg-new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoFocus
                className="pr-16"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {newPassword && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-text-dim hover:text-foreground"
                    onClick={handleCopy}
                    title="Copy password"
                  >
                    {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-text-dim hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="chg-confirm-password">Confirm Password</Label>
            <Input
              id="chg-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              minLength={8}
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-text-dim bg-panel-elevated/40 p-2.5 rounded-md border border-border-subtle">
            <ShieldCheck className="size-4 text-primary shrink-0" />
            <span>The user can use this new password immediately to sign into their account.</span>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-1.5">
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <KeyRound className="size-4" />
                  Save New Password
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
