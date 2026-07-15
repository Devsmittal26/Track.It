import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const SUGGESTED = ["Physics", "Chemistry", "Math", "Biology", "Bio", "English"];

export default function DoneDialog({ open, onOpenChange, onConfirm, defaultAmount = 1 }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({ amount: Math.max(1, parseInt(amount || "1", 10)), tag: tag.trim() || null });
      onOpenChange(false);
      setTag("");
      setAmount(defaultAmount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="slab border-border" data-testid="done-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Mark as done</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Log how many you watched and (optionally) tag the subject.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Amount</label>
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 bg-transparent border-border/60 h-11 font-mono text-lg"
              data-testid="done-dialog-amount"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subject (optional)</label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. Physics"
              className="mt-1 bg-transparent border-border/60 h-11"
              data-testid="done-dialog-tag"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTag(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    tag === s
                      ? "border-[hsl(var(--sage))] text-[hsl(var(--sage))] bg-[hsl(var(--sage)/0.1)]"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-xl hover:bg-white/5 hover:text-white" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            data-testid="done-dialog-confirm"
            className="rounded-xl bg-[hsl(var(--sage))] text-[#0D1410] hover:bg-[hsl(var(--sage)/0.9)]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
