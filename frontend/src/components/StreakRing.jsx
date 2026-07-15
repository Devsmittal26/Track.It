export default function StreakRing({ value, goal, size = 96, strokeWidth = 6 }) {
  const clamped = Math.max(0, Math.min(value, goal || 1));
  const pct = goal > 0 ? clamped / goal : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const complete = goal > 0 && value >= goal;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      data-testid="streak-ring"
      aria-label={`${value} of ${goal} today`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={complete ? "hsl(var(--sage))" : "hsl(var(--terracotta))"}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-heading font-black text-xl tabular-nums">
          {value}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
          / {goal}
        </span>
      </div>
    </div>
  );
}
