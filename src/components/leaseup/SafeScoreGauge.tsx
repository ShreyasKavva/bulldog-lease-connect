import { CountUp } from "./CountUp";

/**
 * Half-circle SafeScore gauge with sweeping needle.
 * Red 0-49, Yellow 50-74, Green 75-100.
 */
export function SafeScoreGauge({ score }: { score: number | null | undefined }) {
  const s = Math.max(0, Math.min(100, score ?? 0));
  const color = s >= 75 ? "#16A34A" : s >= 50 ? "#F59E0B" : "#DC2626";
  const label = s >= 75 ? "Trusted" : s >= 50 ? "Looks fine" : "Use caution";

  // Half-arc geometry
  const r = 60;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * r; // half circle
  const dash = (s / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 80" className="h-20 w-36 overflow-visible">
        {/* track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#E4E6EB" strokeWidth={12} strokeLinecap="round"
        />
        {/* fill */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        />
      </svg>
      <div className="-mt-6 flex flex-col items-center">
        <div className="text-3xl font-black tabular-nums" style={{ color }}>
          <CountUp value={s} duration={900} />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          SafeScore · {label}
        </div>
      </div>
    </div>
  );
}
