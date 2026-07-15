import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, LogOut, Settings2, Flame, TrendingUp, TrendingDown, Loader2, MoreVertical, Trash2, Pencil, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import NewTrackerDialog from "../components/NewTrackerDialog";
import ThemePicker from "../components/ThemePicker";
import PresetManager from "../components/PresetManager";

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const COLOR_HEX = {
  sage: "#88A090", terracotta: "#C87462", amber: "#E8935A",
  teal: "#4DA9B0", gold: "#D89A4E", moss: "#94B58E",
};

export default function Home() {
  const { user, logout } = useAuth();
  const [trackers, setTrackers] = useState(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [settings, setSettings] = useState(null);
  const [presets, setPresets] = useState([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/trackers");
      setTrackers(data.items || []);
    } catch (_) {
      setTrackers([]);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings(data.settings);
    } catch (_) {}
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const { data } = await api.get("/tag-presets");
      setPresets(data.items || []);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); loadSettings(); loadPresets(); }, [load, loadSettings, loadPresets]);

  useEffect(() => {
    const theme = settings?.theme || "midnight";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("ubc_theme", theme); } catch (_) {}
  }, [settings?.theme]);

  const createTracker = async (payload) => {
    const { data } = await api.post("/trackers", payload);
    await load();
    navigate(`/t/${data.id}`);
  };

  const updateSettings = async (patch) => {
    try {
      const { data } = await api.patch("/settings", patch);
      setSettings(data.settings);
    } catch (_) { toast.error("Failed to save settings"); }
  };

  const saveRename = async () => {
    if (!renaming || !renameText.trim()) { setRenaming(null); return; }
    try {
      await api.patch(`/trackers/${renaming.id}`, { name: renameText.trim() });
      toast("Renamed");
      setRenaming(null); setRenameText("");
      load();
    } catch (_) { toast.error("Failed to rename"); }
  };

  const doDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/trackers/${deleteConfirm.id}`);
      toast("Tracker deleted");
      setDeleteConfirm(null);
      load();
    } catch (_) { toast.error("Failed to delete"); }
  };

  const noTrackers = Array.isArray(trackers) && trackers.length === 0;

  return (
    <div className="min-h-screen grain relative">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[hsl(var(--background)/0.75)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-[hsl(var(--sage))] flex items-center justify-center text-[hsl(var(--btn-done-fg))] font-black text-xs">T</div>
            <div className="font-heading font-bold tracking-widest">Track.It</div>
            <span className="hidden sm:inline text-xs text-muted-foreground pl-3 border-l border-border">
              count what matters
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="home-settings-btn"
                  className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
                  <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="slab border-border w-80" align="end">
                <div className="space-y-4">
                  <ThemePicker value={settings?.theme || "midnight"}
                    onChange={(t) => updateSettings({ theme: t })} />
                  <div>
                    <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Subjects</div>
                    <PresetManager presets={presets} onChange={loadPresets} />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" data-testid="home-logout-btn"
              onClick={async () => { await logout(); navigate("/login"); }}
              className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-14">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
          <div>
            <div className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Trackers</div>
            <h1 className="mt-1 font-heading text-4xl sm:text-5xl font-black tracking-tighter leading-none">
              Hey {user?.name || "friend"}.
            </h1>
            <p className="mt-2 text-muted-foreground">Pick a tracker to open, or start a new one.</p>
          </div>
          <Button data-testid="new-tracker-btn" onClick={() => setCreating(true)}
            className="rounded-xl h-12 px-5 gap-2 bg-[hsl(var(--sage))] text-[hsl(var(--btn-done-fg))] hover:bg-[hsl(var(--sage)/0.9)] transition-[background-color,transform] hover:-translate-y-0.5 font-semibold">
            <Plus className="h-4 w-4" /> New tracker
          </Button>
        </div>

        {trackers === null && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {noTrackers && (
          <div className="slab rounded-2xl p-10 sm:p-14 text-center" data-testid="empty-state">
            <div className="mx-auto max-w-md">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                No trackers yet.
              </h2>
              <p className="text-muted-foreground mb-6">
                Trackers are counters for anything you want to chip away at — lectures, books, chapters, workouts.
              </p>
              <Button data-testid="empty-create-btn" onClick={() => setCreating(true)}
                className="rounded-xl h-12 px-6 gap-2 bg-[hsl(var(--sage))] text-[hsl(var(--btn-done-fg))] hover:bg-[hsl(var(--sage)/0.9)] font-semibold">
                <Plus className="h-4 w-4" /> Create your first tracker
              </Button>
            </div>
          </div>
        )}

        {trackers && trackers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="tracker-grid">
            {trackers.map((t) => (
              <TrackerCard
                key={t.id}
                t={t}
                onOpen={() => navigate(`/t/${t.id}`)}
                onRename={() => { setRenaming(t); setRenameText(t.name); }}
                onDelete={() => setDeleteConfirm(t)}
              />
            ))}
          </div>
        )}
      </main>

      <NewTrackerDialog open={creating} onOpenChange={setCreating} onCreate={createTracker} />

      {/* Rename dialog */}
      <AlertDialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <AlertDialogContent className="slab border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Rename tracker</AlertDialogTitle>
            <AlertDialogDescription>Give it a name that reminds you what it's for.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={renameText} onChange={(e) => setRenameText(e.target.value)}
            data-testid="rename-tracker-input"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveRename(); } }}
            className="bg-transparent border-border/60 h-11" autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="rename-tracker-save" onClick={saveRename}
              className="rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent className="slab border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Delete "{deleteConfirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tracker and all of its history, actions, and tasks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-tracker-confirm" onClick={doDelete}
              className="rounded-xl bg-[hsl(var(--terracotta))] text-[hsl(var(--btn-add-fg))] hover:bg-[hsl(var(--terracotta)/0.9)]">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TrackerCard({ t, onOpen, onRename, onDelete }) {
  const accent = COLOR_HEX[t.color] || COLOR_HEX.sage;
  const posToday = t.today.overall > 0;
  const negToday = t.today.overall < 0;
  return (
    <div
      className="slab rounded-2xl p-6 relative cursor-pointer group transition-all hover:-translate-y-0.5 hover:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] flex flex-col gap-4"
      onClick={onOpen}
      data-testid={`tracker-card-${t.id}`}
    >
      {/* Accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: accent }} />

      <div className="flex items-start justify-between">
        <div className="min-w-0 pr-2">
          <div className="font-heading text-lg font-bold tracking-tight truncate">{t.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Updated {timeAgo(t.updated_at)}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`tracker-menu-${t.id}`}
                aria-label="Tracker options">
                <MoreVertical className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="slab border-border w-44 p-1">
              <button onClick={() => onRename()}
                data-testid={`tracker-rename-${t.id}`}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-white/5 inline-flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Rename
              </button>
              <button onClick={() => onDelete()}
                data-testid={`tracker-delete-${t.id}`}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-[hsl(var(--terracotta)/0.1)] hover:text-[hsl(var(--terracotta))] inline-flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <span
          className="font-heading font-black tracking-tighter leading-none tabular-nums"
          style={{ fontSize: "3.75rem", color: "hsl(var(--foreground))" }}
          data-testid={`tracker-counter-${t.id}`}
        >
          {t.counter}
        </span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">left</span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-muted-foreground">
          {t.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-[hsl(var(--terracotta))]" data-testid={`tracker-streak-${t.id}`}>
              <Flame className="h-3.5 w-3.5" /> {t.streak}
            </span>
          )}
          <span>+{t.today.added} added</span>
          <span>−{t.today.done} done</span>
          {posToday && (
            <span className="inline-flex items-center gap-1 text-[hsl(var(--terracotta))]">
              <TrendingUp className="h-3.5 w-3.5" /> +{t.today.overall}
            </span>
          )}
          {negToday && (
            <span className="inline-flex items-center gap-1 text-[hsl(var(--sage))]">
              <TrendingDown className="h-3.5 w-3.5" /> {t.today.overall}
            </span>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}
