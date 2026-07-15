import { Link } from "react-router-dom";
import {
  LogOut, History as HistoryIcon, Undo2, Settings2, Keyboard, ChevronLeft,
} from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import PresetManager from "./PresetManager";
import ThemePicker from "./ThemePicker";

export default function DashboardHeader({
  trackerName, trackerId, settings, onUpdateSettings, onUndo, onOpenShortcuts,
  onLogout, presets, onPresetsChange,
}) {
  const dailyGoal = settings?.daily_goal ?? 5;
  const taskMode = settings?.task_mode ?? "single";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[hsl(var(--background)/0.75)] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="back-to-home-link">
            <ChevronLeft className="h-4 w-4" />
            <div className="w-6 h-6 rounded-md bg-[hsl(var(--sage))] flex items-center justify-center text-[hsl(var(--btn-done-fg))] font-black text-xs">T</div>
            <div className="font-heading font-bold tracking-widest">Track.It</div>
          </Link>
          {trackerName && (
            <span className="hidden sm:inline text-sm text-foreground/80 pl-3 border-l border-border truncate max-w-[240px]"
              data-testid="dashboard-tracker-name">
              {trackerName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" data-testid="undo-btn" onClick={onUndo}
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
            <PopoverContent className="slab border-border w-80" align="end">
              <div className="space-y-4">
                <div>
                  <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Daily goal</div>
                  <Input type="number" min="0" value={dailyGoal}
                    data-testid="settings-goal-input"
                    onChange={(e) => onUpdateSettings({ daily_goal: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                    className="bg-transparent border-border/60 font-mono h-10" />
                </div>
                <div>
                  <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Task mode</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant={taskMode === "single" ? "default" : "outline"}
                      data-testid="task-mode-single"
                      onClick={() => onUpdateSettings({ task_mode: "single" })}
                      className="rounded-lg">Single</Button>
                    <Button size="sm" variant={taskMode === "list" ? "default" : "outline"}
                      data-testid="task-mode-list"
                      onClick={() => onUpdateSettings({ task_mode: "list" })}
                      className="rounded-lg">Checklist</Button>
                  </div>
                </div>
                <div>
                  <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Subjects</div>
                  <PresetManager presets={presets} onChange={onPresetsChange} />
                </div>
                <ThemePicker value={settings?.theme || "midnight"}
                  onChange={(t) => onUpdateSettings({ theme: t })} />
                <div>
                  <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Timezone</div>
                  <div className="text-xs font-mono text-muted-foreground">{settings?.timezone}</div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" data-testid="shortcuts-btn"
            onClick={onOpenShortcuts}
            className="rounded-xl gap-2 hover:bg-white/5 hover:text-white hidden md:flex">
            <Keyboard className="h-4 w-4" />
          </Button>
          <Link to={`/t/${trackerId}/history`} data-testid="nav-history-link">
            <Button variant="ghost" size="sm" className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
              <HistoryIcon className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
            </Button>
          </Link>
          <Button variant="ghost" size="sm" data-testid="logout-btn"
            onClick={onLogout}
            className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
