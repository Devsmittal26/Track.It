import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Minus, LogOut, BookOpen, History as HistoryIcon, Loader2, Check, Pencil, RotateCcw } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import AnimatedCounter from "../components/AnimatedCounter";

function formatDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function todayLabel() {
  const now = new Date();
  const day = now.toLocaleDateString(undefined, { weekday: "long" });
  const date = now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  return { day, date };
}

export default function Dashboard({ state, refresh }) {
  const { user, logout } = useAuth();
  const [taskText, setTaskText] = useState(state?.current_task || "");
  const [editingTask, setEditingTask] = useState(!state?.current_task);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const navigate = useNavigate();
  const taskInputRef = useRef(null);

  useEffect(() => {
    setTaskText(state?.current_task || "");
  }, [state?.current_task]);

  const doAction = useCallback(async (kind) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post("/action", { kind, amount });
      if (kind === "done") {
        const msgs = ["1 Lecture Crushed.", "Keep the momentum.", "Backlog just shrank.", "Nice. Another one down."];
        toast(msgs[Math.floor(Math.random() * msgs.length)], {
          description: `Backlog decreased by ${amount}`,
        });
      } else {
        toast("Added to backlog", { description: `+${amount} lecture${amount > 1 ? "s" : ""} today` });
      }
      await refresh();
    } catch (e) {
      toast.error("Could not update. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, amount, refresh]);

  const saveTask = async () => {
    try {
      await api.post("/task", { text: taskText.trim() });
      setEditingTask(false);
      toast("Task updated");
      refresh();
    } catch (e) {
      toast.error("Failed to save task");
    }
  };

  const resetToday = async () => {
    try {
      await api.post("/reset-today");
      toast("Today's stats reset", { description: "Added and Done set to 0. Counter reverted." });
      await refresh();
    } catch (e) {
      toast.error("Failed to reset");
    }
  };

  const { day, date } = todayLabel();
  const today = state?.today || { added: 0, done: 0, overall: 0, date: "" };

  return (
    <div className="min-h-screen grain relative">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[hsl(var(--background)/0.75)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-[hsl(var(--sage))]" />
            <div className="font-heading font-bold tracking-widest">UBC</div>
            <span className="hidden sm:inline text-xs text-muted-foreground pl-3 border-l border-border">
              Unacademy Backlog Counter
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/history" data-testid="nav-history-link">
              <Button variant="ghost" size="sm" className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
                <HistoryIcon className="h-4 w-4" /> History
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              data-testid="logout-btn"
              onClick={async () => { await logout(); navigate("/login"); }}
              className="rounded-xl gap-2 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
        {/* Date banner */}
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <div className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Today</div>
            <div className="mt-1 font-heading text-2xl sm:text-3xl font-bold tracking-tight">
              {day}, <span className="text-muted-foreground font-medium">{date}</span>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Hello</div>
            <div className="mt-1 font-heading text-lg text-foreground/90" data-testid="user-name">{user?.name || user?.email}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Hero counter card */}
          <section className="slab md:col-span-8 rounded-2xl p-8 sm:p-12 relative overflow-hidden min-h-[46vh] flex flex-col">
            <div className="flex items-center justify-between">
              <span className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Lectures remaining
              </span>
              <span className="text-xs text-muted-foreground/70 font-mono">
                UBC · live counter
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-10">
              <AnimatedCounter
                value={state?.counter ?? 0}
                className="text-[8rem] sm:text-[11rem] lg:text-[13rem] leading-none text-[hsl(var(--foreground))]"
              />
              <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
                <span className={`inline-flex items-center gap-1 ${today.overall > 0 ? "text-[hsl(var(--terracotta))]" : today.overall < 0 ? "text-[hsl(var(--sage))]" : ""}`}>
                  {today.overall > 0 ? "▲" : today.overall < 0 ? "▼" : "·"} {Math.abs(today.overall)} today
                </span>
                <span className="opacity-40">|</span>
                <span>+{today.added} added</span>
                <span className="opacity-40">|</span>
                <span>−{today.done} done</span>
              </div>
            </div>

            {/* Action row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-6 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Step</span>
                <Input
                  type="number"
                  min="1"
                  value={amount}
                  data-testid="amount-input"
                  onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                  className="w-20 h-10 bg-transparent border-border/60 text-center font-mono"
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <Button
                  data-testid="add-lecture-btn"
                  disabled={busy}
                  onClick={() => doAction("add")}
                  className="h-14 rounded-xl bg-[hsl(var(--terracotta))] text-[#1A0F0C] hover:bg-[hsl(var(--terracotta)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2"
                >
                  <Plus className="h-5 w-5" /> Add
                </Button>
                <Button
                  data-testid="done-lecture-btn"
                  disabled={busy}
                  onClick={() => doAction("done")}
                  className="h-14 rounded-xl bg-[hsl(var(--sage))] text-[#0D1410] hover:bg-[hsl(var(--sage)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2"
                >
                  <Minus className="h-5 w-5" /> Done
                </Button>
              </div>
            </div>
          </section>

          {/* Stats panel */}
          <aside className="md:col-span-4 flex flex-col gap-6">
            <div className="slab rounded-2xl p-6" data-testid="stats-panel">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-heading text-xl font-semibold">Stats</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{today.date}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        data-testid="reset-today-btn"
                        aria-label="Reset today's stats"
                        disabled={today.added === 0 && today.done === 0}
                        className="text-muted-foreground hover:text-[hsl(var(--terracotta))] disabled:opacity-30 disabled:hover:text-muted-foreground p-1.5 rounded-md hover:bg-white/5 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="slab border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading">Reset today's stats?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                          This sets today's <span className="text-[hsl(var(--terracotta))]">Added</span> and{" "}
                          <span className="text-[hsl(var(--sage))]">Done</span> back to 0, and reverts your main counter by the net change from today. History for other days stays untouched.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="reset-cancel-btn" className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          data-testid="reset-confirm-btn"
                          onClick={resetToday}
                          className="rounded-xl bg-[hsl(var(--terracotta))] text-[#1A0F0C] hover:bg-[hsl(var(--terracotta)/0.9)]"
                        >
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="divide-y divide-border/60">
                <StatRow label="Added" value={today.added} testid="stat-added" tone="terracotta" prefix="+" />
                <StatRow label="Done" value={today.done} testid="stat-done" tone="sage" prefix="−" />
                <StatRow
                  label="Overall"
                  value={today.overall}
                  testid="stat-overall"
                  tone={today.overall > 0 ? "terracotta" : today.overall < 0 ? "sage" : "neutral"}
                  prefix={today.overall > 0 ? "+" : today.overall < 0 ? "−" : ""}
                  abs
                />
              </div>
            </div>

            {/* Current task */}
            <div className="slab rounded-2xl p-6" data-testid="current-task-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-xl font-semibold">Current task</h3>
                {!editingTask && taskText && (
                  <button
                    onClick={() => { setEditingTask(true); setTimeout(() => taskInputRef.current?.focus(), 0); }}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    data-testid="edit-task-btn"
                    aria-label="Edit task"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              {editingTask ? (
                <div>
                  <textarea
                    ref={taskInputRef}
                    data-testid="current-task-input"
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                    placeholder="e.g. Pankaj Sir — Scalars and Vectors, Physics"
                    rows={3}
                    className="notebook-input resize-none font-body text-base"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveTask();
                      }
                    }}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    {state?.current_task && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg hover:bg-white/5 hover:text-white"
                        onClick={() => { setTaskText(state.current_task); setEditingTask(false); }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      data-testid="save-task-btn"
                      size="sm"
                      onClick={saveTask}
                      className="rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p
                  data-testid="current-task-display"
                  className="text-foreground/90 leading-relaxed cursor-text py-2 border-b border-dashed border-transparent hover:border-border transition-colors"
                  onClick={() => { setEditingTask(true); setTimeout(() => taskInputRef.current?.focus(), 0); }}
                >
                  {taskText || (
                    <span className="text-muted-foreground italic">Click to set what you're working on…</span>
                  )}
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatRow({ label, value, tone = "neutral", prefix = "", testid, abs }) {
  const color =
    tone === "sage" ? "text-[hsl(var(--sage))]"
    : tone === "terracotta" ? "text-[hsl(var(--terracotta))]"
    : "text-foreground";
  const display = abs ? Math.abs(value) : value;
  return (
    <motion.div
      layout
      className="flex items-center justify-between py-4"
    >
      <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      <span className={`font-heading font-black text-3xl tracking-tight tabular-nums ${color}`} data-testid={testid}>
        {prefix}{display}
      </span>
    </motion.div>
  );
}
