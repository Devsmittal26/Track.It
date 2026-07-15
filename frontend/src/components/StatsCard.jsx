import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "./ui/alert-dialog";

export default function StatsCard({ today, onReset }) {
  return (
    <div className="slab rounded-2xl p-6" data-testid="stats-panel">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading text-xl font-semibold">Stats</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{today.date}</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button data-testid="reset-today-btn" aria-label="Reset today's stats"
                disabled={today.added === 0 && today.done === 0}
                className="text-muted-foreground hover:text-[hsl(var(--terracotta))] disabled:opacity-30 disabled:hover:text-muted-foreground p-1.5 rounded-md hover:bg-white/5 transition-colors">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="slab border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading">Reset today's stats?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  This sets today's <span className="text-[hsl(var(--terracotta))]">Added</span> and{" "}
                  <span className="text-[hsl(var(--sage))]">Done</span> back to 0, and reverts your main counter by the net change from today.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="reset-cancel-btn" className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction data-testid="reset-confirm-btn" onClick={onReset}
                  className="rounded-xl bg-[hsl(var(--terracotta))] text-[#1A0F0C] hover:bg-[hsl(var(--terracotta)/0.9)]">
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="divide-y divide-border/60">
        <Row label="Added" value={today.added} testid="stat-added" tone="terracotta" prefix="+" />
        <Row label="Done" value={today.done} testid="stat-done" tone="sage" prefix="−" />
        <Row label="Overall" value={today.overall} testid="stat-overall"
          tone={today.overall > 0 ? "terracotta" : today.overall < 0 ? "sage" : "neutral"}
          prefix={today.overall > 0 ? "+" : today.overall < 0 ? "−" : ""} abs />
      </div>
    </div>
  );
}

function Row({ label, value, tone = "neutral", prefix = "", testid, abs }) {
  const color = tone === "sage" ? "text-[hsl(var(--sage))]"
    : tone === "terracotta" ? "text-[hsl(var(--terracotta))]" : "text-foreground";
  const display = abs ? Math.abs(value) : value;
  return (
    <motion.div layout className="flex items-center justify-between py-4">
      <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <span className={`font-heading font-black text-3xl tracking-tight tabular-nums ${color}`} data-testid={testid}>
        {prefix}{display}
      </span>
    </motion.div>
  );
}
