import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2, BookOpen, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setErr("Passwords don't match"); return; }
    setBusy(true); setErr("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1600);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grain relative flex items-center justify-center px-6">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="h-5 w-5 text-[hsl(var(--sage))]" />
            <span className="font-heading text-sm uppercase tracking-[0.3em] text-muted-foreground">UBC</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter leading-none">New password</h1>
          <p className="mt-3 text-muted-foreground">Choose something you'll actually remember.</p>
        </div>

        {done ? (
          <div className="slab rounded-2xl p-7 flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--sage))]" />
            <div>
              <div className="font-heading font-semibold">Password updated</div>
              <div className="text-sm text-muted-foreground">Redirecting to sign in…</div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 slab rounded-2xl p-7">
            {!token && <div className="text-sm text-[hsl(var(--terracotta))]">Missing reset token in URL.</div>}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={6} data-testid="reset-password-input"
                className="bg-transparent border-border/60 h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Confirm password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required minLength={6} data-testid="reset-password-confirm"
                className="bg-transparent border-border/60 h-11" />
            </div>
            {err && <div className="text-sm text-[hsl(var(--terracotta))]" data-testid="reset-error">{err}</div>}
            <Button type="submit" data-testid="reset-submit-btn" disabled={busy || !token}
              className="w-full h-11 rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/login" className="text-[hsl(var(--sage))] hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
