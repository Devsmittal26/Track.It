import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Flame } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import HeroCounter from "../components/HeroCounter";
import StatsCard from "../components/StatsCard";
import WeekRecapCard from "../components/WeekRecapCard";
import CurrentTaskCard from "../components/CurrentTaskCard";
import TaskChecklistCard from "../components/TaskChecklistCard";
import DoneDialog from "../components/DoneDialog";
import ShortcutsDialog from "../components/ShortcutsDialog";
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
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
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
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const [doneDialogOpen, setDoneDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [weekSummary, setWeekSummary] = useState(null);
  const [presets, setPresets] = useState([]);
  const [taskEditFocus, setTaskEditFocus] = useState(0);
  const navigate = useNavigate();

  const settings = state?.settings || { daily_goal: 5, task_mode: "single", timezone: "UTC" };
  const taskMode = settings.task_mode || "single";
  const dailyGoal = settings.daily_goal ?? 5;
  const today = state?.today || { added: 0, done: 0, overall: 0, date: "" };
  const streak = state?.streak ?? 0;
  const projectedFinish = formatProjected(state?.projected_finish);
  const avg7d = state?.avg_done_7d ?? 0;

  const loadWeek = useCallback(async () => {
    try {
      const { data } = await api.get("/summary/week");
      setWeekSummary(data);
    } catch (_) {}
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const { data } = await api.get("/tag-presets");
      setPresets(data.items || []);
    } catch (_) {}
  }, []);

  useEffect(() => { loadWeek(); loadPresets(); }, [loadWeek, loadPresets]);

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
          } catch (_) { toast.error("Nothing to undo"); }
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
    } catch (_) {
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
    } catch (_) { toast.error("Nothing to undo"); }
  }, [refresh, loadWeek]);

  const saveTask = async (text) => {
    try {
      await api.post("/task", { text });
      toast("Task updated");
      refresh();
    } catch (_) { toast.error("Failed to save task"); }
  };

  const resetToday = async () => {
    try {
      await api.post("/reset-today");
      toast("Today's stats reset");
      await refresh(); loadWeek();
    } catch (_) { toast.error("Failed to reset"); }
  };

  const updateSettings = async (patch) => {
    try {
      await api.patch("/settings", patch);
      await refresh();
    } catch (_) { toast.error("Failed to save settings"); }
  };

  const setCounter = async (value) => {
    try {
      await api.post("/counter/set", { value });
      toast("Counter updated");
      await refresh(); loadWeek();
    } catch (_) { toast.error("Failed to update counter"); }
  };

  useKeyboardShortcuts([
    { key: "a", handler: () => applyAction("add") },
    { key: "d", handler: () => setDoneDialogOpen(true) },
    { key: "r", handler: () => setTaskEditFocus((n) => n + 1) },
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
      <DashboardHeader
        settings={settings}
        onUpdateSettings={updateSettings}
        onUndo={undoLast}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onLogout={async () => { await logout(); navigate("/login"); }}
        presets={presets}
        onPresetsChange={loadPresets}
      />

      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <div className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Today</div>
            <div className="mt-1 font-heading text-2xl sm:text-3xl font-bold tracking-tight">
              {day}, <span className="text-muted-foreground font-medium">{date}</span>
            </div>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-2 text-[hsl(var(--terracotta))]" data-testid="streak-badge">
              <Flame className="h-4 w-4" />
              <span className="font-heading font-bold text-lg tabular-nums">{streak}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">streak</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          <HeroCounter
            counter={state?.counter}
            today={today}
            dailyGoal={dailyGoal}
            projectedFinish={projectedFinish}
            avg7d={avg7d}
            amount={amount}
            setAmount={setAmount}
            onAdd={() => applyAction("add")}
            onDone={() => setDoneDialogOpen(true)}
            onSetCounter={setCounter}
            busy={busy}
          />

          <aside className="md:col-span-4 flex flex-col gap-6">
            <StatsCard today={today} onReset={resetToday} />
            <WeekRecapCard summary={weekSummary} dailyGoal={dailyGoal} />
            {taskMode === "single"
              ? <CurrentTaskCard key={taskEditFocus} value={state?.current_task || ""} onSave={saveTask} autoFocusOnMount={taskEditFocus > 0} />
              : <TaskChecklistCard />
            }
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
        presets={presets}
        onPresetsChange={loadPresets}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
