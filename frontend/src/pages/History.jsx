import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, BookOpen, TrendingDown, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import api from "../lib/api";
import { Button } from "../components/ui/button";

function fmt(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function fmtLong(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/history?days=90");
        setItems(data.items || []);
      } catch (_) {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const chartData = [...items].reverse().map((it) => ({
    ...it,
    label: fmt(it.date),
  }));

  const totals = items.reduce((acc, it) => {
    acc.added += it.added; acc.done += it.done; return acc;
  }, { added: 0, done: 0 });
  const net = totals.added - totals.done;

  return (
    <div className="min-h-screen grain relative">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[hsl(var(--background)/0.75)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-[hsl(var(--sage))]" />
            <div className="font-heading font-bold tracking-widest">UBC</div>
            <span className="hidden sm:inline text-xs text-muted-foreground pl-3 border-l border-border">History</span>
          </div>
          <Link to="/" data-testid="nav-back-link">
            <Button variant="ghost" size="sm" className="rounded-xl gap-2 hover:bg-white/5 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
        <div className="mb-8">
          <div className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">Log</div>
          <h1 className="mt-1 font-heading text-4xl sm:text-5xl font-black tracking-tighter leading-none">
            Your backlog, day by day.
          </h1>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SummaryTile label="Days tracked" value={items.length} />
          <SummaryTile label="Total added" value={`+${totals.added}`} tone="terracotta" />
          <SummaryTile label="Total done" value={`−${totals.done}`} tone="sage" />
          <SummaryTile label="Net change" value={`${net > 0 ? "+" : ""}${net}`} tone={net > 0 ? "terracotta" : net < 0 ? "sage" : "neutral"} />
        </div>

        {/* Chart */}
        <section className="slab rounded-2xl p-6 mb-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-heading text-2xl font-semibold">Backlog curve</h2>
            <span className="text-xs text-muted-foreground font-mono">counter over time</span>
          </div>
          <div className="h-72" data-testid="counter-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8E94A3", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8E94A3", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "#121419", border: "1px solid #22252D", borderRadius: 12, fontFamily: "Manrope" }}
                  labelStyle={{ color: "#F4F0EA" }}
                />
                <Line type="monotone" dataKey="counter" stroke="hsl(36 33% 94%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(138 14% 59%)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="slab rounded-2xl p-6 mb-8">
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
                <Tooltip
                  contentStyle={{ background: "#121419", border: "1px solid #22252D", borderRadius: 12, fontFamily: "Manrope" }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="added" fill="hsl(12 51% 59%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="done" fill="hsl(138 14% 59%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Table */}
        <section className="slab rounded-2xl p-2 sm:p-4 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <h2 className="font-heading text-2xl font-semibold">Day log</h2>
            <span className="text-xs text-muted-foreground font-mono">{items.length} entries</span>
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
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No history yet. Start logging on the dashboard.</td></tr>
                )}
                {items.map((it) => {
                  const positive = it.overall > 0;
                  const negative = it.overall < 0;
                  return (
                    <tr key={it.date} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryTile({ label, value, tone = "neutral" }) {
  const color =
    tone === "sage" ? "text-[hsl(var(--sage))]"
    : tone === "terracotta" ? "text-[hsl(var(--terracotta))]"
    : "text-foreground";
  return (
    <div className="slab rounded-2xl p-5">
      <div className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`mt-2 font-heading text-3xl font-black tracking-tight ${color}`}>{value}</div>
    </div>
  );
}
