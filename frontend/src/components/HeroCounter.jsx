import { CalendarClock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Plus, Minus } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import StreakRing from "./StreakRing";

export default function HeroCounter({
  counter, today, dailyGoal, projectedFinish, avg7d,
  amount, setAmount, onAdd, onDone, busy,
}) {
  return (
    <section className="slab md:col-span-8 rounded-2xl p-8 sm:p-12 relative overflow-hidden min-h-[46vh] flex flex-col">
      <div className="flex items-center justify-between">
        <span className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Lectures remaining
        </span>
        <StreakRing value={today.done} goal={dailyGoal} size={64} strokeWidth={5} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <AnimatedCounter
          value={counter ?? 0}
          className="text-[7rem] sm:text-[10rem] lg:text-[12rem] leading-none text-[hsl(var(--foreground))]"
        />
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground flex-wrap justify-center">
          <span className={`inline-flex items-center gap-1 ${today.overall > 0 ? "text-[hsl(var(--terracotta))]" : today.overall < 0 ? "text-[hsl(var(--sage))]" : ""}`}>
            {today.overall > 0 ? "▲" : today.overall < 0 ? "▼" : "·"} {Math.abs(today.overall)} today
          </span>
          <span className="opacity-40">|</span>
          <span>+{today.added} added</span>
          <span className="opacity-40">|</span>
          <span>−{today.done} done</span>
        </div>
        {projectedFinish && (
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
            className="h-14 rounded-xl bg-[hsl(var(--terracotta))] text-[#1A0F0C] hover:bg-[hsl(var(--terracotta)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2">
            <Plus className="h-5 w-5" /> Add <kbd className="hidden md:inline text-[10px] font-mono opacity-60 border border-black/20 rounded px-1">A</kbd>
          </Button>
          <Button data-testid="done-lecture-btn" disabled={busy} onClick={onDone}
            className="h-14 rounded-xl bg-[hsl(var(--sage))] text-[#0D1410] hover:bg-[hsl(var(--sage)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2">
            <Minus className="h-5 w-5" /> Done <kbd className="hidden md:inline text-[10px] font-mono opacity-60 border border-black/20 rounded px-1">D</kbd>
          </Button>
        </div>
      </div>
    </section>
  );
}
