import { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2, BookOpen } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetLink, setResetLink] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg(""); setResetLink("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMsg(data.message || "If an account exists, a reset link has been generated.");
      if (data.reset_link) setResetLink(data.reset_link);
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
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter leading-none">Reset password</h1>
          <p className="mt-3 text-muted-foreground">Enter your email — we'll generate a reset link.</p>
        </div>

        <form onSubmit={submit} className="space-y-5 slab rounded-2xl p-7">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
            <Input id="email" data-testid="forgot-email-input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="bg-transparent border-border/60 h-11" />
          </div>
          {err && <div className="text-sm text-[hsl(var(--terracotta))]" data-testid="forgot-error">{err}</div>}
          {msg && <div className="text-sm text-[hsl(var(--sage))]" data-testid="forgot-message">{msg}</div>}
          {resetLink && (
            <div className="text-xs bg-[hsl(var(--muted))] border border-border rounded-lg p-3 break-all font-mono" data-testid="forgot-reset-link">
              <div className="text-muted-foreground mb-1">Dev reset link:</div>
              <a href={resetLink} className="text-[hsl(var(--sage))] hover:underline">{resetLink}</a>
            </div>
          )}
          <Button type="submit" data-testid="forgot-submit-btn" disabled={busy}
            className="w-full h-11 rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Remembered it? <Link to="/login" className="text-[hsl(var(--sage))] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
