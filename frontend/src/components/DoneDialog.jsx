import { useState } from "react";
import { Loader2, Pencil, Check, X, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import api from "../lib/api";

export default function DoneDialog({ open, onOpenChange, onConfirm, defaultAmount = 1, presets = [], onPresetsChange }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newPreset, setNewPreset] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({ amount: Math.max(1, parseInt(amount || "1", 10)), tag: tag.trim() || null });
      onOpenChange(false);
      setTag("");
      setAmount(defaultAmount);
      setEditing(false);
      setNewPreset("");
    } finally {
      setBusy(false);
    }
  };

  const addPreset = async () => {
    const name = newPreset.trim();
    if (!name) return;
    setPresetBusy(true);
    try {
      await api.post("/tag-presets", { name });
      setNewPreset("");
      onPresetsChange?.();
    } catch (e) {
      const msg = e.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Could not add subject");
    } finally {
      setPresetBusy(false);
    }
  };

  const removePreset = async (p) => {
    try {
      await api.delete(`/tag-presets/${p.id}`);
      if (tag === p.name) setTag("");
      onPresetsChange?.();
    } catch (_) {
      toast.error("Could not remove");
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subject (optional)</label>
              <button
                type="button"
                data-testid="done-dialog-edit-presets-btn"
                onClick={() => setEditing((v) => !v)}
                className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  editing
                    ? "text-[hsl(var(--sage))] bg-[hsl(var(--sage)/0.1)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {editing ? <><Check className="h-3 w-3" /> Done editing</> : <><Pencil className="h-3 w-3" /> Edit subjects</>}
              </button>
            </div>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. Physics"
              className="mt-1 bg-transparent border-border/60 h-11"
              data-testid="done-dialog-tag"
              onKeyDown={(e) => { if (e.key === "Enter" && !editing) submit(); }}
            />

            {(presets.length > 0 || editing) && (
              <div className="flex flex-wrap gap-2 mt-3" data-testid="done-dialog-presets">
                {presets.map((p) => (
                  <span
                    key={p.id || p.name}
                    className={`text-xs inline-flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-full border transition-colors ${
                      tag === p.name && !editing
                        ? "border-[hsl(var(--sage))] text-[hsl(var(--sage))] bg-[hsl(var(--sage)/0.1)]"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => !editing && setTag(p.name)}
                      data-testid={`done-dialog-chip-${p.name}`}
                      className={editing ? "cursor-default" : ""}
                    >
                      {p.name}
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => removePreset(p)}
                        aria-label={`Remove ${p.name}`}
                        data-testid={`done-dialog-remove-${p.name}`}
                        className="hover:text-[hsl(var(--terracotta))] transition-colors ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {presets.length === 0 && editing && (
                  <span className="text-xs text-muted-foreground italic">No subjects yet — add one below.</span>
                )}
              </div>
            )}

            {editing && (
              <div className="flex gap-2 mt-3">
                <Input
                  value={newPreset}
                  onChange={(e) => setNewPreset(e.target.value)}
                  placeholder="Add subject…"
                  data-testid="done-dialog-new-preset"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPreset(); } }}
                  className="bg-transparent border-border/60 h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={addPreset}
                  disabled={presetBusy || !newPreset.trim()}
                  data-testid="done-dialog-add-preset-btn"
                  className="h-9 px-3 rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] disabled:opacity-40 text-sm inline-flex items-center gap-1"
                >
                  {presetBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
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
