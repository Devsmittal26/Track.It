import { useEffect, useRef, useState } from "react";
import { CalendarClock, Plus, Minus, Pencil, Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import AnimatedCounter from "./AnimatedCounter";
import StreakRing from "./StreakRing";

export default function HeroCounter({
  counter, today, dailyGoal, projectedFinish, avg7d,
  amount, setAmount, onAdd, onDone, onSetCounter, busy,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(counter ?? 0));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(counter ?? 0));
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [editing, counter]);

  // Lock body scroll while editing the counter so scrolling stays put
  useEffect(() => {
    if (!editing) return undefined;
    document.body.classList.add("editing-lock");
    const stopWheel = (e) => e.preventDefault();
    // Non-passive wheel/touchmove listener on the input so mouse-wheel doesn't propagate
    const el = inputRef.current;
    if (el) {
      el.addEventListener("wheel", stopWheel, { passive: false });
      el.addEventListener("touchmove", stopWheel, { passive: false });
    }
    return () => {
      document.body.classList.remove("editing-lock");
      if (el) {
        el.removeEventListener("wheel", stopWheel);
        el.removeEventListener("touchmove", stopWheel);
      }
    };
  }, [editing]);

  const commit = async () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n) || n < 0) { setEditing(false); return; }
    if (n === (counter ?? 0)) { setEditing(false); return; }
    await onSetCounter?.(n);
    setEditing(false);
  };

  return (
    <section className="slab md:col-span-8 rounded-2xl p-8 sm:p-12 relative overflow-hidden min-h-[46vh] flex flex-col">
      <div className="flex items-center justify-between">
        <span className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Lectures remaining
        </span>
        <StreakRing value={today.done} goal={dailyGoal} size={64} strokeWidth={5} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-8">
        {editing ? (
          <div className="flex items-center gap-4" data-testid="counter-edit-row">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
              }}
              data-testid="counter-edit-input"
              className="w-[6ch] sm:w-[8ch] text-[7rem] sm:text-[10rem] lg:text-[12rem] font-heading font-black leading-none text-center tabular-nums bg-transparent border-0 border-b border-border/60 rounded-none h-auto p-0 focus-visible:ring-0 focus-visible:border-[hsl(var(--sage))]"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={commit}
                data-testid="counter-edit-save"
                aria-label="Save counter"
                className="w-10 h-10 rounded-full bg-[hsl(var(--sage))] text-[hsl(var(--btn-done-fg))] flex items-center justify-center hover:bg-[hsl(var(--sage)/0.9)] transition-colors"
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={() => setEditing(false)}
                data-testid="counter-edit-cancel"
                aria-label="Cancel"
                className="w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            data-testid="counter-edit-trigger"
            aria-label="Edit counter"
            className="group relative inline-flex items-center gap-4 cursor-text hover:opacity-95 transition-opacity"
            title="Click to edit"
          >
            <AnimatedCounter
              value={counter ?? 0}
              className="text-[7rem] sm:text-[10rem] lg:text-[12rem] leading-none text-[hsl(var(--foreground))]"
            />
            <Pencil className="absolute -right-8 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground flex-wrap justify-center">
          <span className={`inline-flex items-center gap-1 ${today.overall > 0 ? "text-[hsl(var(--terracotta))]" : today.overall < 0 ? "text-[hsl(var(--sage))]" : ""}`}>
            {today.overall > 0 ? "▲" : today.overall < 0 ? "▼" : "·"} {Math.abs(today.overall)} today
          </span>
          <span className="opacity-40">|</span>
          <span>+{today.added} added</span>
          <span className="opacity-40">|</span>
          <span>−{today.done} done</span>
        </div>
        {projectedFinish && !editing && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground border border-border/60 rounded-full px-4 py-1.5"
            data-testid="projected-finish">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>At this pace: <span className="text-foreground font-medium">{projectedFinish}</span></span>
            <span className="opacity-40">·</span>
            <span>{avg7d}/day avg</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-6 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Step</span>
          <Input type="number" min="1" value={amount}
            data-testid="amount-input"
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || "1", 10)))}
            className="w-20 h-10 bg-transparent border-border/60 text-center font-mono" />
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          <Button data-testid="add-lecture-btn" disabled={busy} onClick={onAdd}
            className="h-14 rounded-xl bg-[hsl(var(--terracotta))] text-[hsl(var(--btn-add-fg))] hover:bg-[hsl(var(--terracotta)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2">
            <Plus className="h-5 w-5" /> Add <kbd className="hidden md:inline text-[10px] font-mono opacity-60 border border-black/20 rounded px-1">A</kbd>
          </Button>
          <Button data-testid="done-lecture-btn" disabled={busy} onClick={onDone}
            className="h-14 rounded-xl bg-[hsl(var(--sage))] text-[hsl(var(--btn-done-fg))] hover:bg-[hsl(var(--sage)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2">
            <Minus className="h-5 w-5" /> Done <kbd className="hidden md:inline text-[10px] font-mono opacity-60 border border-black/20 rounded px-1">D</kbd>
          </Button>
        </div>
      </div>
    </section>
  );
}
