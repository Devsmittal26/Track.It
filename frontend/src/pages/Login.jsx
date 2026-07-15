import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2, BookOpen } from "lucide-react";

export default function Login() {
  const { login, error, setError, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.id) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => () => setError(""), [setError]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(email, password);
    setBusy(false);
    if (ok) navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen grain relative flex items-center justify-center px-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[hsl(var(--sage)/0.08)] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[hsl(var(--terracotta)/0.08)] blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 flex flex-col items-start">
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="h-5 w-5 text-[hsl(var(--sage))]" />
            <span className="font-heading text-sm uppercase tracking-[0.3em] text-muted-foreground">UBC</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter leading-none">
            Welcome back.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to keep your backlog moving.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5 slab rounded-2xl p-7">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
            <Input
              id="email"
              data-testid="login-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="bg-transparent border-border/60 h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
            <Input
              id="password"
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-transparent border-border/60 h-11"
            />
          </div>

          {error && (
            <div data-testid="login-error" className="text-sm text-[hsl(var(--terracotta))]">{error}</div>
          )}

          <Button
            type="submit"
            data-testid="login-submit-btn"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" data-testid="go-to-register-link" className="text-[hsl(var(--sage))] hover:underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
