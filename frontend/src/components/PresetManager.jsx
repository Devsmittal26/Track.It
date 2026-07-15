import { useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import api from "../lib/api";
import { toast } from "sonner";

export default function PresetManager({ presets = [], onChange }) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.post("/tag-presets", { name });
      setNewName("");
      onChange?.();
    } catch (e) {
      const msg = e.response?.data?.detail || "Could not add subject";
      toast.error(typeof msg === "string" ? msg : "Could not add subject");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/tag-presets/${id}`);
      onChange?.();
    } catch (_) { toast.error("Could not remove"); }
  };

  return (
    <div className="space-y-2" data-testid="preset-manager">
      <div className="flex flex-wrap gap-1.5">
        {presets.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No subjects yet.</span>
        )}
        {presets.map((p) => (
          <span key={p.id} data-testid={`preset-chip-${p.name}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-border bg-[hsl(var(--muted))] text-foreground/90">
            {p.name}
            <button
              onClick={() => remove(p.id)}
              aria-label={`Remove ${p.name}`}
              data-testid={`preset-remove-${p.name}`}
              className="hover:text-[hsl(var(--terracotta))] transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Add subject…" data-testid="preset-new-input"
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          className="bg-transparent border-border/60 h-9 text-sm" />
        <button onClick={add} disabled={busy || !newName.trim()}
          data-testid="preset-add-btn"
          className="h-9 px-3 rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] disabled:opacity-40 text-sm inline-flex items-center gap-1">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
