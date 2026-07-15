import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Loader2 } from "lucide-react";

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

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { trackerId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const [doneDialogOpen, setDoneDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [weekSummary, setWeekSummary] = useState(null);
  const [presets, setPresets] = useState([]);
  const [taskEditFocus, setTaskEditFocus] = useState(0);
  const [notFound, setNotFound] = useState(false);

  const settings = state?.settings || { daily_goal: 5, task_mode: "single", timezone: "UTC", theme: "midnight" };
  const taskMode = settings.task_mode || "single";
  const dailyGoal = settings.daily_goal ?? 5;
  const today = state?.today || { added: 0, done: 0, overall: 0, date: "" };
  const streak = state?.streak ?? 0;
  const projectedFinish = formatProjected(state?.projected_finish);
  const avg7d = state?.avg_done_7d ?? 0;

  const refresh = useCallback(async () => {
    if (!trackerId) return;
    try {
      const { data } = await api.get(`/trackers/${trackerId}`);
      setState(data);
    } catch (e) {
      if (e.response?.status === 404) setNotFound(true);
    }
  }, [trackerId]);

  const loadWeek = useCallback(async () => {
    if (!trackerId) return;
    try {
      const { data } = await api.get(`/trackers/${trackerId}/summary/week`);
      setWeekSummary(data);
    } catch (_) {}
  }, [trackerId]);

  const loadPresets = useCallback(async () => {
    try {
      const { data } = await api.get("/tag-presets");
      setPresets(data.items || []);
    } catch (_) {}
  }, []);

  useEffect(() => { refresh(); loadWeek(); loadPresets(); }, [refresh, loadWeek, loadPresets]);

  useEffect(() => {
    const theme = settings?.theme || "midnight";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("ubc_theme", theme); } catch (_) {}
  }, [settings?.theme]);

  const showUndoToast = useCallback((message) => {
    toast(message, {
      description: "Click to undo",
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await api.post(`/trackers/${trackerId}/undo`);
            toast("Undone");
            refresh(); loadWeek();
          } catch (_) { toast.error("Nothing to undo"); }
        },
      },
    });
  }, [trackerId, refresh, loadWeek]);

  const applyAction = useCallback(async (kind, opts = {}) => {
    if (busy || !trackerId) return;
    setBusy(true);
    try {
      const body = { kind, amount: opts.amount ?? amount };
      if (opts.tag) body.tag = opts.tag;
      const { data } = await api.post(`/trackers/${trackerId}/action`, body);
      if (kind === "done") {
        const msgs = ["Nice one.", "Keep the momentum.", "Counter just shrank.", "Another one down."];
        showUndoToast(`${msgs[Math.floor(Math.random() * msgs.length)]} −${body.amount}${opts.tag ? ` · ${opts.tag}` : ""}`);
        if (data?.milestone !== null && data?.milestone !== undefined) {
          fireConfetti();
          setTimeout(() => {
            toast(data.milestone === 0 ? "🎉 Cleared!" : `Milestone: ${data.milestone} left`, {
              description: data.milestone === 0 ? "You did it." : "Keep going.",
            });
          }, 200);
        }
      } else {
        showUndoToast(`+${body.amount} added${opts.tag ? ` · ${opts.tag}` : ""}`);
      }
      await refresh(); loadWeek();
    } catch (_) {
      toast.error("Could not update. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, amount, trackerId, refresh, showUndoToast, loadWeek]);

  const undoLast = useCallback(async () => {
    if (!trackerId) return;
    try {
      await api.post(`/trackers/${trackerId}/undo`);
      toast("Undone");
      await refresh(); loadWeek();
    } catch (_) { toast.error("Nothing to undo"); }
  }, [trackerId, refresh, loadWeek]);

  const saveTask = async (text) => {
    try {
      await api.post(`/trackers/${trackerId}/task`, { text });
      toast("Task updated");
      refresh();
    } catch (_) { toast.error("Failed to save task"); }
  };

  const resetToday = async () => {
    try {
      await api.post(`/trackers/${trackerId}/reset-today`);
      toast("Today's stats reset");
      await refresh(); loadWeek();
    } catch (_) { toast.error("Failed to reset"); }
  };

  const updateSettings = async (patch) => {
    try {
      const { data } = await api.patch("/settings", patch);
      setState((s) => s ? { ...s, settings: data.settings } : s);
    } catch (_) { toast.error("Failed to save settings"); }
  };

  const setCounter = async (value) => {
    const prev = state?.counter ?? 0;
    if (value === prev) return;
    try {
      await api.post(`/trackers/${trackerId}/counter/set`, { value });
      toast(`Counter set to ${value}`, {
        description: `Was ${prev} — click to undo`,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await api.post(`/trackers/${trackerId}/counter/set`, { value: prev });
              toast("Undone");
              await refresh(); loadWeek();
            } catch (_) { toast.error("Undo failed"); }
          },
        },
      });
      await refresh(); loadWeek();
    } catch (_) { toast.error("Failed to update counter"); }
  };

  useKeyboardShortcuts([
    { key: "a", handler: () => applyAction("add") },
    { key: "d", handler: () => setDoneDialogOpen(true) },
    { key: "r", handler: () => setTaskEditFocus((n) => n + 1) },
    { key: "u", handler: () => undoLast() },
    { key: "?", handler: () => setShortcutsOpen(true) },
    ...Array.from({ length: 9 }, (_, i) => ({ key: String(i + 1), handler: () => setAmount(i + 1) })),
  ], !doneDialogOpen);

  const { day, date } = todayLabel();

  if (notFound) {
    return (
      <div className="min-h-screen grain flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-black tracking-tight mb-2">Tracker not found</h1>
          <p className="text-muted-foreground mb-6">This tracker may have been deleted.</p>
          <button onClick={() => navigate("/")}
            className="rounded-xl h-11 px-5 bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground)/0.9)] font-semibold">
            Back to trackers
          </button>
        </div>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="min-h-screen grain flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grain relative">
      <DashboardHeader
        trackerName={state.name}
        trackerId={trackerId}
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
              : <TaskChecklistCard trackerId={trackerId} />
            }
            <div className="text-right text-xs text-muted-foreground">
              Hello, <span className="font-semibold text-foreground" data-testid="user-name">{user?.name || user?.email}</span>
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
