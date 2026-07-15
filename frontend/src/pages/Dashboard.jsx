import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Plus, Minus, LogOut, BookOpen, History as HistoryIcon, Loader2, Check, Pencil,
  RotateCcw, Undo2, Flame, Target, CalendarClock, Settings2, Keyboard, Trash2, ListChecks,
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import AnimatedCounter from "../components/AnimatedCounter";
import StreakRing from "../components/StreakRing";
import DoneDialog from "../components/DoneDialog";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

function todayLabel() {
  const now = new Date();
  return {
    day: now.toLocaleDateString(undefined, { weekday: "long" }),
    date: now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }),
  };
}

function formatProjected(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fireConfetti() {
  const end = Date.now() + 900;
  const colors = ["#88A090", "#C87462", "#F4F0EA"];
  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export default function Dashboard({ state, refresh }) {
  const { user, logout } = useAuth();
  const [taskText, setTaskText] = useState(state?.current_task || "");
  const [editingTask, setEditingTask] = useState(!state?.current_task);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const [doneDialogOpen, setDoneDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [weekSummary, setWeekSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const navigate = useNavigate();
  const taskInputRef = useRef(null);
  const amountInputRef = useRef(null);

  const settings = state?.settings || { daily_goal: 5, task_mode: "single", timezone: "UTC" };
  const taskMode = settings.task_mode || "single";
  const dailyGoal = settings.daily_goal ?? 5;
  const today = state?.today || { added: 0, done: 0, overall: 0, date: "" };
  const streak = state?.streak ?? 0;
  const projectedFinish = formatProjected(state?.projected_finish);
  const avg7d = state?.avg_done_7d ?? 0;

  useEffect(() => {
    setTaskText(state?.current_task || "");
  }, [state?.current_task]);

  const loadWeek = useCallback(async () => {
    try {
      const { data } = await api.get("/summary/week");
      setWeekSummary(data);
    } catch (_) {}
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data.items || []);
    } catch (_) {}
  }, []);

  useEffect(() => { loadWeek(); }, [loadWeek]);
  useEffect(() => { if (taskMode === "list") loadTasks(); }, [taskMode, loadTasks]);

  const showUndoToast = useCallback((message) => {
    toast(message, {
      description: "Click to undo",
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await api.post("/undo");
            toast("Undone");
            refresh(); loadWeek();
          } catch (_) {
            toast.error("Nothing to undo");
          }
        },
      },
    });
  }, [refresh, loadWeek]);

  const applyAction = useCallback(async (kind, opts = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      const body = { kind, amount: opts.amount ?? amount };
      if (opts.tag) body.tag = opts.tag;
      const { data } = await api.post("/action", body);
      if (kind === "done") {
        const msgs = ["Lecture crushed.", "Keep the momentum.", "Backlog just shrank.", "Nice. Another one down."];
        showUndoToast(`${msgs[Math.floor(Math.random() * msgs.length)]} −${body.amount}${opts.tag ? ` · ${opts.tag}` : ""}`);
        if (data?.milestone !== null && data?.milestone !== undefined) {
          fireConfetti();
          setTimeout(() => {
            toast(data.milestone === 0 ? "🎉 Backlog cleared!" : `Milestone: ${data.milestone} left`, {
              description: data.milestone === 0 ? "You did it." : "Keep going.",
            });
          }, 200);
        }
      } else {
        showUndoToast(`+${body.amount} added${opts.tag ? ` · ${opts.tag}` : ""}`);
      }
      await refresh();
      loadWeek();
    } catch (e) {
      toast.error("Could not update. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, amount, refresh, showUndoToast, loadWeek]);

  const undoLast = useCallback(async () => {
    try {
      await api.post("/undo");
      toast("Undone");
      await refresh(); loadWeek();
    } catch (_) {
      toast.error("Nothing to undo");
    }
  }, [refresh, loadWeek]);

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
      toast("Today's stats reset");
      await refresh(); loadWeek();
    } catch (_) {
      toast.error("Failed to reset");
    }
  };

  const updateSettings = async (patch) => {
    try {
      await api.patch("/settings", patch);
      await refresh();
    } catch (_) {
      toast.error("Failed to save settings");
    }
  };

  const addTaskItem = async () => {
    if (!newTask.trim()) return;
    try {
      await api.post("/tasks", { text: newTask.trim() });
      setNewTask("");
      loadTasks();
    } catch (_) { toast.error("Failed to add task"); }
  };
  const toggleTaskItem = async (t) => {
    await api.patch(`/tasks/${t.id}`, { done: !t.done });
    loadTasks();
  };
  const deleteTaskItem = async (t) => {
    await api.delete(`/tasks/${t.id}`);
    loadTasks();
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: "a", handler: () => applyAction("add") },
    { key: "d", handler: () => setDoneDialogOpen(true) },
    { key: "r", handler: () => { setEditingTask(true); setTimeout(() => taskInputRef.current?.focus(), 0); } },
    { key: "u", handler: () => undoLast() },
    { key: "?", handler: () => setShortcutsOpen(true) },
    ...Array.from({ length: 9 }, (_, i) => ({
      key: String(i + 1),
      handler: () => setAmount(i + 1),
    })),
  ], !doneDialogOpen);

  const { day, date } = todayLabel();

  return (
    <div className="min-h-screen grain relative">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[hsl(var(--background)/0.75)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-[hsl(var(--sage))]" />
            <div className="font-heading font-bold tracking-widest">UBC</div>
            <span className="hidden sm:inline text-xs text-muted-foreground pl-3 border-l border-border">
              Unacademy Backlog Counter
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" data-testid="undo-btn" onClick={undoLast}
              className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
              <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Undo</span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="settings-btn"
                  className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
                  <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="slab border-border w-72" align="end">
                <div className="space-y-4">
                  <div>
                    <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Daily goal (lectures)</div>
                    <Input type="number" min="0" value={dailyGoal}
                      data-testid="settings-goal-input"
                      onChange={(e) => updateSettings({ daily_goal: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                      className="bg-transparent border-border/60 font-mono h-10" />
                  </div>
                  <div>
                    <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Task mode</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant={taskMode === "single" ? "default" : "outline"}
                        data-testid="task-mode-single"
                        onClick={() => updateSettings({ task_mode: "single" })}
                        className="rounded-lg">Single</Button>
                      <Button size="sm" variant={taskMode === "list" ? "default" : "outline"}
                        data-testid="task-mode-list"
                        onClick={() => updateSettings({ task_mode: "list" })}
                        className="rounded-lg">Checklist</Button>
                    </div>
                  </div>
                  <div>
                    <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Timezone</div>
                    <div className="text-xs font-mono text-muted-foreground">{settings.timezone}</div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" data-testid="shortcuts-btn"
              onClick={() => setShortcutsOpen(true)}
              className="rounded-xl gap-2 hover:bg-white/5 hover:text-white hidden md:flex">
              <Keyboard className="h-4 w-4" />
            </Button>
            <Link to="/history" data-testid="nav-history-link">
              <Button variant="ghost" size="sm" className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
                <HistoryIcon className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" data-testid="logout-btn"
              onClick={async () => { await logout(); navigate("/login"); }}
              className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
        {/* Date banner + streak */}
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <div className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Today</div>
            <div className="mt-1 font-heading text-2xl sm:text-3xl font-bold tracking-tight">
              {day}, <span className="text-muted-foreground font-medium">{date}</span>
            </div>
          </div>
          <div className="text-right flex items-center gap-4">
            {streak > 0 && (
              <div className="flex items-center gap-2 text-[hsl(var(--terracotta))]" data-testid="streak-badge">
                <Flame className="h-4 w-4" />
                <span className="font-heading font-bold text-lg tabular-nums">{streak}</span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">streak</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Hero counter card */}
          <section className="slab md:col-span-8 rounded-2xl p-8 sm:p-12 relative overflow-hidden min-h-[46vh] flex flex-col">
            <div className="flex items-center justify-between">
              <span className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Lectures remaining
              </span>
              <div className="flex items-center gap-3">
                <StreakRing value={today.done} goal={dailyGoal} size={64} strokeWidth={5} />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <AnimatedCounter
                value={state?.counter ?? 0}
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
                <Input ref={amountInputRef} type="number" min="1" value={amount}
                  data-testid="amount-input"
                  onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                  className="w-20 h-10 bg-transparent border-border/60 text-center font-mono" />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <Button data-testid="add-lecture-btn" disabled={busy}
                  onClick={() => applyAction("add")}
                  className="h-14 rounded-xl bg-[hsl(var(--terracotta))] text-[#1A0F0C] hover:bg-[hsl(var(--terracotta)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2">
                  <Plus className="h-5 w-5" /> Add <kbd className="hidden md:inline text-[10px] font-mono opacity-60 border border-black/20 rounded px-1">A</kbd>
                </Button>
                <Button data-testid="done-lecture-btn" disabled={busy}
                  onClick={() => setDoneDialogOpen(true)}
                  className="h-14 rounded-xl bg-[hsl(var(--sage))] text-[#0D1410] hover:bg-[hsl(var(--sage)/0.9)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 font-semibold text-base gap-2">
                  <Minus className="h-5 w-5" /> Done <kbd className="hidden md:inline text-[10px] font-mono opacity-60 border border-black/20 rounded px-1">D</kbd>
                </Button>
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="md:col-span-4 flex flex-col gap-6">
            {/* Stats */}
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
                        <AlertDialogAction data-testid="reset-confirm-btn" onClick={resetToday}
                          className="rounded-xl bg-[hsl(var(--terracotta))] text-[#1A0F0C] hover:bg-[hsl(var(--terracotta)/0.9)]">
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
                <StatRow label="Overall" value={today.overall} testid="stat-overall"
                  tone={today.overall > 0 ? "terracotta" : today.overall < 0 ? "sage" : "neutral"}
                  prefix={today.overall > 0 ? "+" : today.overall < 0 ? "−" : ""} abs />
              </div>
            </div>

            {/* Weekly recap */}
            {weekSummary && (
              <div className="slab rounded-2xl p-6" data-testid="week-recap">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-xl font-semibold">This week</h3>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <MiniStat label="Done" value={weekSummary.done} tone="sage" />
                  <MiniStat label="Added" value={weekSummary.added} tone="terracotta" />
                  <MiniStat label="Best day" value={weekSummary.best_done || 0} tone="neutral" />
                </div>
                <div className="mt-4 grid grid-cols-7 gap-1.5">
                  {weekSummary.per_day.map((d) => {
                    const intensity = Math.min(1, (d.done || 0) / Math.max(1, dailyGoal));
                    return (
                      <div key={d.date} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full aspect-square rounded-md border border-border/50"
                          style={{
                            background: intensity > 0
                              ? `hsl(138 14% ${20 + intensity * 30}%)`
                              : "hsl(var(--muted))",
                          }}
                          title={`${d.date}: ${d.done} done`}
                        />
                        <span className="text-[9px] uppercase text-muted-foreground tracking-widest">
                          {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current task or Checklist */}
            {taskMode === "single" ? (
              <div className="slab rounded-2xl p-6" data-testid="current-task-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading text-xl font-semibold">Current task</h3>
                  {!editingTask && taskText && (
                    <button onClick={() => { setEditingTask(true); setTimeout(() => taskInputRef.current?.focus(), 0); }}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-white/5 transition-colors"
                      data-testid="edit-task-btn" aria-label="Edit task">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {editingTask ? (
                  <div>
                    <textarea ref={taskInputRef} data-testid="current-task-input"
                      value={taskText} onChange={(e) => setTaskText(e.target.value)}
                      placeholder="e.g. Pankaj Sir — Scalars and Vectors, Physics" rows={3}
                      className="notebook-input resize-none font-body text-base"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTask(); }
                      }} />
                    <div className="mt-3 flex justify-end gap-2">
                      {state?.current_task && (
                        <Button variant="ghost" size="sm" className="rounded-lg hover:bg-white/5 hover:text-white"
                          onClick={() => { setTaskText(state.current_task); setEditingTask(false); }}>
                          Cancel
                        </Button>
                      )}
                      <Button data-testid="save-task-btn" size="sm" onClick={saveTask}
                        className="rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] gap-1.5">
                        <Check className="h-3.5 w-3.5" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p data-testid="current-task-display"
                    className="text-foreground/90 leading-relaxed cursor-text py-2"
                    onClick={() => { setEditingTask(true); setTimeout(() => taskInputRef.current?.focus(), 0); }}>
                    {taskText || <span className="text-muted-foreground italic">Click to set what you're working on…</span>}
                  </p>
                )}
              </div>
            ) : (
              <div className="slab rounded-2xl p-6" data-testid="task-checklist">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading text-xl font-semibold inline-flex items-center gap-2">
                    <ListChecks className="h-4 w-4" /> Tasks
                  </h3>
                </div>
                <div className="flex gap-2 mb-4">
                  <Input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Add a task…" data-testid="new-task-input"
                    onKeyDown={(e) => { if (e.key === "Enter") addTaskItem(); }}
                    className="bg-transparent border-border/60 h-10" />
                  <Button size="sm" onClick={addTaskItem} data-testid="add-task-btn"
                    className="rounded-lg bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)]">
                    Add
                  </Button>
                </div>
                <ul className="space-y-2">
                  {tasks.length === 0 && (
                    <li className="text-sm text-muted-foreground italic">No tasks yet.</li>
                  )}
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 group" data-testid={`task-item-${t.id}`}>
                      <Checkbox checked={t.done} onCheckedChange={() => toggleTaskItem(t)}
                        data-testid={`task-toggle-${t.id}`} />
                      <span className={`flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.text}</span>
                      <button onClick={() => deleteTaskItem(t)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[hsl(var(--terracotta))] transition-opacity"
                        data-testid={`task-delete-${t.id}`} aria-label="Delete task">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-right text-xs text-muted-foreground">
              Hello, <span className="text-foreground/90" data-testid="user-name">{user?.name || user?.email}</span>
            </div>
          </aside>
        </div>
      </main>

      <DoneDialog
        open={doneDialogOpen}
        onOpenChange={setDoneDialogOpen}
        onConfirm={(opts) => applyAction("done", opts)}
        defaultAmount={amount}
      />

      <AlertDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <AlertDialogContent className="slab border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Keyboard shortcuts</AlertDialogTitle>
            <AlertDialogDescription>Move faster.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Shortcut k="A" desc="Add lecture" />
            <Shortcut k="D" desc="Mark done (with tag)" />
            <Shortcut k="U" desc="Undo last action" />
            <Shortcut k="R" desc="Edit current task" />
            <Shortcut k="1–9" desc="Set step amount" />
            <Shortcut k="?" desc="Show this dialog" />
          </div>
          <AlertDialogFooter>
            <AlertDialogAction className="rounded-xl">Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Shortcut({ k, desc }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="font-mono text-xs px-2 py-1 rounded border border-border bg-[hsl(var(--muted))] min-w-[2.5rem] text-center">{k}</kbd>
      <span className="text-sm text-foreground/90">{desc}</span>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const color = tone === "sage" ? "text-[hsl(var(--sage))]"
    : tone === "terracotta" ? "text-[hsl(var(--terracotta))]" : "text-foreground";
  return (
    <div>
      <div className={`font-heading font-black text-2xl tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function StatRow({ label, value, tone = "neutral", prefix = "", testid, abs }) {
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
