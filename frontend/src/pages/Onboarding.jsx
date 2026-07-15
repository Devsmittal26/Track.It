import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, ChevronRight } from "lucide-react";

export default function Onboarding({ onDone }) {
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const n = parseInt(count, 10);
    if (Number.isNaN(n) || n < 0) {
      setErr("Enter a valid, non-negative number.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/onboard", { initial_count: n });
      if (onDone) await onDone();
      navigate("/", { replace: true });
    } catch (e) {
      setErr("Failed to save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grain relative flex items-center justify-center px-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(var(--sage)/0.06)] blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-xl">
        <div className="mb-10">
          <span className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Step 1 · Setup</span>
          <h1 className="mt-3 font-heading text-4xl sm:text-6xl font-black tracking-tighter leading-[0.95]">
            How many lectures<br/>are in your backlog?
          </h1>
          <p className="mt-5 text-muted-foreground max-w-md">
            This is your starting counter. Every day you can add new lectures scheduled and knock down the ones you've watched.
          </p>
        </div>

        <form onSubmit={submit} className="slab rounded-2xl p-7 sm:p-9">
          <label className="block font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Current backlog
          </label>
          <div className="flex items-end gap-4">
            <Input
              type="number"
              min="0"
              inputMode="numeric"
              autoFocus
              value={count}
              data-testid="onboard-count-input"
              onChange={(e) => setCount(e.target.value)}
              placeholder="176"
              className="text-5xl sm:text-6xl font-heading font-black h-auto tracking-tighter bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-[hsl(var(--sage))]"
            />
            <span className="pb-3 text-muted-foreground">lectures</span>
          </div>

          {err && <div data-testid="onboard-error" className="mt-4 text-sm text-[hsl(var(--terracotta))]">{err}</div>}

          <Button
            type="submit"
            data-testid="onboard-submit-btn"
            disabled={busy}
            className="mt-8 h-12 rounded-xl bg-[hsl(var(--sage))] text-[hsl(var(--background))] hover:bg-[hsl(var(--sage)/0.9)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 px-6 group"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <span className="inline-flex items-center gap-2 font-semibold">
                Start tracking <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
