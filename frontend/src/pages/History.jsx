import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, TrendingDown, TrendingUp, Pencil, Download, Tag } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import EditDayDialog from "../components/EditDayDialog";
import { toast } from "sonner";

function fmt(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
function fmtLong(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

const TAG_COLORS = ["hsl(138 14% 59%)", "hsl(12 51% 59%)", "hsl(36 33% 94%)", "hsl(222 10% 60%)", "hsl(45 40% 55%)", "hsl(200 30% 50%)"];

export default function History() {
  const { trackerId } = useParams();
  const [tracker, setTracker] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [tagBreakdown, setTagBreakdown] = useState([]);

  const load = useCallback(async () => {
    if (!trackerId) return;
    setLoading(true);
    try {
      const [{ data: t }, { data: hist }, { data: tags }] = await Promise.all([
        api.get(`/trackers/${trackerId}`),
        api.get(`/trackers/${trackerId}/history?days=90`),
        api.get(`/trackers/${trackerId}/tags/summary?days=30`),
      ]);
      setTracker(t);
      setItems(hist.items || []);
      setTagBreakdown(tags.items || []);
    } catch (_) {} finally { setLoading(false); }
  }, [trackerId]);

  useEffect(() => { load(); }, [load]);

  const saveDay = async (date, patch) => {
    try {
      await api.post(`/trackers/${trackerId}/day`, { date, ...patch });
      toast("Day updated");
      load();
    } catch (_) { toast.error("Failed to save"); }
  };

  const downloadCsv = async () => {
    try {
      const res = await api.get(`/trackers/${trackerId}/history/csv`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = `trackit_${(tracker?.name || "history").replace(/\s+/g, "_").toLowerCase()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (_) { toast.error("Export failed"); }
  };

  const chartData = [...items].reverse().map((it) => ({ ...it, label: fmt(it.date) }));
  const totals = items.reduce((acc, it) => { acc.added += it.added; acc.done += it.done; return acc; }, { added: 0, done: 0 });
  const net = totals.added - totals.done;

  return (
    <div className="min-h-screen grain relative">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[hsl(var(--background)/0.75)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/t/${trackerId}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-back-link">
              <ChevronLeft className="h-4 w-4" />
              <div className="w-6 h-6 rounded-md bg-[hsl(var(--sage))] flex items-center justify-center text-[hsl(var(--btn-done-fg))] font-black text-xs">T</div>
              <div className="font-heading font-bold tracking-widest">Track.It</div>
            </Link>
            {tracker?.name && (
              <span className="hidden sm:inline text-sm text-foreground/80 pl-3 border-l border-border truncate max-w-[280px]">
                {tracker.name} · History
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" data-testid="export-csv-btn" onClick={downloadCsv}
            className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
        <div className="mb-8">
          <div className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Log · {tracker?.name}</div>
          <h1 className="mt-1 font-heading text-4xl sm:text-5xl font-black tracking-tighter leading-none">
            Day by day.
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SummaryTile label="Days tracked" value={items.length} />
          <SummaryTile label="Total added" value={`+${totals.added}`} tone="terracotta" />
          <SummaryTile label="Total done" value={`−${totals.done}`} tone="sage" />
          <SummaryTile label="Net change" value={`${net > 0 ? "+" : ""}${net}`}
            tone={net > 0 ? "terracotta" : net < 0 ? "sage" : "neutral"} />
        </div>

        <section className="slab rounded-2xl p-6 mb-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-heading text-2xl font-semibold">Counter curve</h2>
            <span className="text-xs text-muted-foreground font-mono">counter over time</span>
          </div>
          <div className="h-72" data-testid="counter-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8E94A3", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8E94A3", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: "#121419", border: "1px solid #22252D", borderRadius: 12, fontFamily: "Manrope" }} labelStyle={{ color: "#F4F0EA" }} />
                <Line type="monotone" dataKey="counter" stroke="hsl(36 33% 94%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(138 14% 59%)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
          <section className="slab rounded-2xl p-6 lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-2xl font-semibold">Daily throughput</h2>
              <span className="text-xs text-muted-foreground font-mono">added vs done</span>
            </div>
            <div className="h-72" data-testid="throughput-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#8E94A3", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8E94A3", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: "#121419", border: "1px solid #22252D", borderRadius: 12, fontFamily: "Manrope" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="added" fill="hsl(12 51% 59%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="done" fill="hsl(138 14% 59%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="slab rounded-2xl p-6" data-testid="tags-panel">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold inline-flex items-center gap-2">
                <Tag className="h-4 w-4" /> By subject
              </h2>
              <span className="text-xs text-muted-foreground font-mono">30d</span>
            </div>
            {tagBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                Tag your Done actions by subject to see this breakdown.
              </div>
            ) : (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tagBreakdown} dataKey="count" nameKey="tag" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {tagBreakdown.map((_, i) => <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} stroke="transparent" />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#121419", border: "1px solid #22252D", borderRadius: 12, fontFamily: "Manrope" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {tagBreakdown.slice(0, 6).map((t, i) => (
                    <li key={t.tag} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: TAG_COLORS[i % TAG_COLORS.length] }} />
                      <span className="flex-1 truncate">{t.tag}</span>
                      <span className="font-mono text-muted-foreground">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <section className="slab rounded-2xl p-2 sm:p-4 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <h2 className="font-heading text-2xl font-semibold">Day log</h2>
            <span className="text-xs text-muted-foreground font-mono">{items.length} entries · click a row to edit</span>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm" data-testid="history-table">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-3 px-4 font-heading text-xs uppercase tracking-[0.2em] font-semibold">Date</th>
                  <th className="py-3 px-4 font-heading text-xs uppercase tracking-[0.2em] font-semibold text-right">Added</th>
                  <th className="py-3 px-4 font-heading text-xs uppercase tracking-[0.2em] font-semibold text-right">Done</th>
                  <th className="py-3 px-4 font-heading text-xs uppercase tracking-[0.2em] font-semibold text-right">Overall</th>
                  <th className="py-3 px-4 font-heading text-xs uppercase tracking-[0.2em] font-semibold text-right">Counter</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (<tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</td></tr>)}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">No history yet. Start logging on the dashboard.</td></tr>
                )}
                {items.map((it) => {
                  const positive = it.overall > 0;
                  const negative = it.overall < 0;
                  return (
                    <tr key={it.date} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors group" data-testid={`history-row-${it.date}`}>
                      <td className="py-3 px-4 font-body">{fmtLong(it.date)}</td>
                      <td className="py-3 px-4 text-right font-mono text-[hsl(var(--terracotta))]">+{it.added}</td>
                      <td className="py-3 px-4 text-right font-mono text-[hsl(var(--sage))]">−{it.done}</td>
                      <td className={`py-3 px-4 text-right font-mono ${positive ? "text-[hsl(var(--terracotta))]" : negative ? "text-[hsl(var(--sage))]" : "text-muted-foreground"}`}>
                        <span className="inline-flex items-center gap-1">
                          {positive && <TrendingUp className="h-3.5 w-3.5" />}
                          {negative && <TrendingDown className="h-3.5 w-3.5" />}
                          {positive ? "+" : negative ? "−" : ""}{Math.abs(it.overall)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">{it.counter}</td>
                      <td className="py-3 px-2 text-right">
                        <button onClick={() => setEditing(it)} data-testid={`edit-day-btn-${it.date}`}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-white/5 transition-opacity">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <EditDayDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        day={editing}
        onSave={(patch) => saveDay(editing.date, patch)}
      />
    </div>
  );
}

function SummaryTile({ label, value, tone = "neutral" }) {
  const color = tone === "sage" ? "text-[hsl(var(--sage))]"
    : tone === "terracotta" ? "text-[hsl(var(--terracotta))]" : "text-foreground";
  return (
    <div className="slab rounded-2xl p-5">
      <div className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`mt-2 font-heading text-3xl font-black tracking-tight ${color}`}>{value}</div>
    </div>
  );
}
