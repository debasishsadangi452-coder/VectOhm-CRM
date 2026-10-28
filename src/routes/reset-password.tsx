import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const resetPassword = useResetPassword();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match");
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, newPassword });
      setDone(true);
      setTimeout(() => navigate({ to: "/login" }), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            V
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Choose a new password</h1>
        </div>

        <div className="bg-panel border border-border-subtle rounded-xl p-6">
          {!token ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">This reset link is missing its token.</p>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Request a new reset link
              </Link>
            </div>
          ) : done ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="size-8 text-success mx-auto" />
              <p className="text-sm">Your password has been reset. Redirecting to sign in…</p>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Go to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rp-new">New password</Label>
                <Input id="rp-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-confirm">Confirm new password</Label>
                <Input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? <Loader2 className="size-4 animate-spin" /> : "Reset password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
