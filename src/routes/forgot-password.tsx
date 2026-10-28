import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestPasswordReset } from "@/hooks/use-auth";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Always succeeds server-side (no account enumeration), so just show the
    // confirmation regardless.
    await requestReset.mutateAsync({ email }).catch(() => {});
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            V
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Reset your password</h1>
        </div>

        <div className="bg-panel border border-border-subtle rounded-xl p-6">
          {sent ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="size-8 text-success mx-auto" />
              <p className="text-sm">
                If an account exists for <span className="font-medium">{email}</span>, a password
                reset link is on its way. The link expires in 1 hour.
              </p>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-text-dim">
                Enter your account email and we'll send you a link to reset your password.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fp-email">Email</Label>
                <Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={requestReset.isPending}>
                {requestReset.isPending ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
              </Button>
              <Link to="/login" className="block text-center text-sm text-text-dim hover:text-foreground">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
