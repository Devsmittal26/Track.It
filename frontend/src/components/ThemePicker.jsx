import { Palette } from "lucide-react";

const THEMES = [
  { id: "midnight", name: "Midnight", swatches: ["#0A0B0E", "#F4F0EA", "#88A090", "#C87462"] },
  { id: "paper",    name: "Paper",    swatches: ["#F5F1EA", "#1F1D19", "#4A6B54", "#B85940"] },
  { id: "ocean",    name: "Ocean",    swatches: ["#08111C", "#E4EDF2", "#4DA9B0", "#E8935A"] },
  { id: "forest",   name: "Forest",   swatches: ["#0D110D", "#F1EBD9", "#94B58E", "#D89A4E"] },
];

export default function ThemePicker({ value = "midnight", onChange }) {
  return (
    <div className="space-y-2" data-testid="theme-picker">
      <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-1.5">
        <Palette className="h-3.5 w-3.5" /> Theme
      </div>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              data-testid={`theme-option-${t.id}`}
              className={`group relative rounded-xl border p-2.5 text-left transition-all ${
                active
                  ? "border-[hsl(var(--sage))] bg-[hsl(var(--sage)/0.08)]"
                  : "border-border hover:border-foreground/40 bg-transparent"
              }`}
            >
              <div className="flex items-center gap-1 mb-2">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="w-4 h-4 rounded-full border border-black/10"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className={`text-xs font-heading font-semibold ${active ? "text-[hsl(var(--sage))]" : "text-foreground/90"}`}>
                {t.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
