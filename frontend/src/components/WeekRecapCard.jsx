import { Target } from "lucide-react";

export default function WeekRecapCard({ summary, dailyGoal }) {
  if (!summary) return null;
  return (
    <div className="slab rounded-2xl p-6" data-testid="week-recap">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-xl font-semibold">This week</h3>
        <Target className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <MiniStat label="Done" value={summary.done} tone="sage" />
        <MiniStat label="Added" value={summary.added} tone="terracotta" />
        <MiniStat label="Best day" value={summary.best_done || 0} tone="neutral" />
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {summary.per_day.map((d) => {
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
