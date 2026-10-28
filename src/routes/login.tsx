import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/auth";
import { ApiError, isApiError, tryRefresh } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const authStatus = useAuthStore((s) => s.status);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (authStatus === "authenticated") {
      navigate({ to: "/" });
      return;
    }
  }, [authStatus, navigate]);

  // Still holding a valid session cookie (e.g. the desktop app just signed in,
  // or this tab's storage was cleared)? Resume it instead of asking for the
  // password again. tryRefresh() sets the auth state on success, which the
  // effect above turns into a redirect; after a real sign-out the server has
  // already dropped the cookie, so this simply leaves the form showing.
  useEffect(() => {
    void tryRefresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const cleanEmail = email.trim();
    try {
      const { user, accessToken } = await login(cleanEmail, password);
      setAuth(user, accessToken);
      navigate({ to: "/" });
    } catch (err) {
      const is401 = isApiError(err) ? err.status === 401 : (err as any)?.status === 401;
      setError(is401 ? "Invalid email or password" : (err as Error)?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            V
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Sign in to Venus CRM</h1>
          <p className="text-sm text-text-dim">Enterprise operating system</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-text-dim hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
          <Link to="/forgot-password" className="block text-center text-xs text-text-dim hover:text-foreground">
            Forgot password?
          </Link>
        </form>
      </div>
    </div>
  );
}
