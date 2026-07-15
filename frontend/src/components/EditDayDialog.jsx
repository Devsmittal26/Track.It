import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function EditDayDialog({ open, onOpenChange, day, onSave }) {
  const [added, setAdded] = useState(0);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (day) {
      setAdded(day.added ?? 0);
      setDone(day.done ?? 0);
    }
  }, [day]);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave({
        added: Math.max(0, parseInt(added || "0", 10)),
        done: Math.max(0, parseInt(done || "0", 10)),
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="slab border-border" data-testid="edit-day-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit {day?.date}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Adjust this day's numbers. Your main counter will be updated by the difference.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Added</label>
            <Input
              type="number" min="0" value={added}
              onChange={(e) => setAdded(e.target.value)}
              className="mt-1 bg-transparent border-border/60 h-11 font-mono text-lg text-[hsl(var(--terracotta))]"
              data-testid="edit-day-added"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Done</label>
            <Input
              type="number" min="0" value={done}
              onChange={(e) => setDone(e.target.value)}
              className="mt-1 bg-transparent border-border/60 h-11 font-mono text-lg text-[hsl(var(--sage))]"
              data-testid="edit-day-done"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-xl hover:bg-white/5 hover:text-white" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} data-testid="edit-day-save" className="rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
