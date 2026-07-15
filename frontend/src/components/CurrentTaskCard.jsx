import { useEffect, useRef, useState } from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "./ui/button";

export default function CurrentTaskCard({ value, onSave, autoFocusOnMount }) {
  const [text, setText] = useState(value || "");
  const [editing, setEditing] = useState(!value);
  const ref = useRef(null);

  useEffect(() => { setText(value || ""); }, [value]);

  useEffect(() => {
    if (autoFocusOnMount && ref.current) ref.current.focus();
  }, [autoFocusOnMount]);

  const save = async () => {
    await onSave(text.trim());
    setEditing(false);
  };

  return (
    <div className="slab rounded-2xl p-6" data-testid="current-task-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-xl font-semibold">Current task</h3>
        {!editing && text && (
          <button
            onClick={() => { setEditing(true); setTimeout(() => ref.current?.focus(), 0); }}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-white/5 transition-colors"
            data-testid="edit-task-btn" aria-label="Edit task"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea ref={ref} data-testid="current-task-input"
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Pankaj Sir — Scalars and Vectors, Physics" rows={3}
            className="notebook-input resize-none font-body text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
            }} />
          <div className="mt-3 flex justify-end gap-2">
            {value && (
              <Button variant="ghost" size="sm" className="rounded-lg hover:bg-white/5 hover:text-white"
                onClick={() => { setText(value); setEditing(false); }}>
                Cancel
              </Button>
            )}
            <Button data-testid="save-task-btn" size="sm" onClick={save}
              className="rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] gap-1.5">
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p data-testid="current-task-display"
          className="text-foreground/90 leading-relaxed cursor-text py-2"
          onClick={() => { setEditing(true); setTimeout(() => ref.current?.focus(), 0); }}>
          {text || <span className="text-muted-foreground italic">Click to set what you're working on…</span>}
        </p>
      )}
    </div>
  );
}
