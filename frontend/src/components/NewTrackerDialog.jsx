import { useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";

const COLORS = [
  { id: "sage",       hex: "#88A090" },
  { id: "terracotta", hex: "#C87462" },
  { id: "amber",      hex: "#E8935A" },
  { id: "teal",       hex: "#4DA9B0" },
  { id: "gold",       hex: "#D89A4E" },
  { id: "moss",       hex: "#94B58E" },
];

export default function NewTrackerDialog({ open, onOpenChange, onCreate }) {
  const [name, setName] = useState("");
  const [initialCount, setInitialCount] = useState("");
  const [color, setColor] = useState("sage");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setErr("");
    if (!name.trim()) { setErr("Name is required"); return; }
    const n = parseInt(initialCount || "0", 10);
    if (Number.isNaN(n) || n < 0) { setErr("Enter a valid starting count"); return; }
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), initial_count: n, color });
      setName(""); setInitialCount(""); setColor("sage");
      onOpenChange(false);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="slab border-border" data-testid="new-tracker-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">New tracker</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Track anything countable — lectures, books, workouts, chapters, tasks.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Unacademy backlog"
              data-testid="new-tracker-name"
              autoFocus
              className="mt-1 bg-transparent border-border/60 h-11" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Starting count</label>
            <Input type="text" inputMode="numeric" pattern="[0-9]*"
              value={initialCount}
              onChange={(e) => setInitialCount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              data-testid="new-tracker-initial"
              className="mt-1 bg-transparent border-border/60 h-11 font-mono text-lg" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accent</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c.id} type="button" onClick={() => setColor(c.id)}
                  data-testid={`new-tracker-color-${c.id}`}
                  aria-label={c.id}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c.id ? "scale-110 border-foreground" : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: c.hex }} />
              ))}
            </div>
          </div>
          {err && <div className="text-sm text-[hsl(var(--terracotta))]" data-testid="new-tracker-error">{err}</div>}
          <DialogFooter>
            <Button type="button" variant="ghost" className="rounded-xl hover:bg-white/5 hover:text-white"
              onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy} data-testid="new-tracker-submit"
              className="rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create <ChevronRight className="h-4 w-4" /></>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
