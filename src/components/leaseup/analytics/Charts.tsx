import { useEffect, useState } from "react";

export function useCountUp(target: number, duration = 600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setN(Math.round(from + (target - from) * ease(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

export function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  const n = useCountUp(value);
  return (
    <div className="rounded-xl bg-surface p-4 shadow-card">
      <div className="text-xl">{icon}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">{n.toLocaleString()}</div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

export function Sparkline({ data, width = 280, height = 60 }: { data: number[]; width?: number; height?: number }) {
  if (data.length === 0) return <div className="h-[60px] grid place-items-center text-xs text-muted-foreground">No data yet</div>;
  const max = Math.max(...data, 1);
  const bw = width / data.length;
  const todayIdx = data.length - 1;
  return (
    <svg width={width} height={height} className="block">
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 4));
        return (
          <rect
            key={i}
            x={i * bw + 2}
            y={height - h}
            width={bw - 4}
            height={h}
            rx={2}
            fill={i === todayIdx ? "#2563EB" : "#BFDBFE"}
          />
        );
      })}
    </svg>
  );
}

export function LineChart({
  data,
  width = 640,
  height = 200,
}: {
  data: { date: string; count: number }[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0) return <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">No data yet</div>;
  const pad = 24;
  const max = Math.max(...data.map((d) => d.count), 1);
  const stepX = (width - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = height - pad - (d.count / max) * (height - pad * 2);
    return [x, y, d] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${points[points.length - 1][0]},${height - pad} L${points[0][0]},${height - pad} Z`;
  const [hover, setHover] = useState<number | null>(null);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lineFill)" />
      <path d={path} fill="none" stroke="#2563EB" strokeWidth={2} />
      {points.map(([x, y, d], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={hover === i ? 4 : 2.5} fill="#2563EB" />
          <rect
            x={x - stepX / 2}
            y={0}
            width={stepX}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
          {hover === i && (
            <g>
              <rect x={Math.min(width - 110, Math.max(0, x - 50))} y={Math.max(0, y - 36)} width={100} height={28} rx={6} fill="#0F172A" />
              <text x={Math.min(width - 110, Math.max(0, x - 50)) + 50} y={Math.max(0, y - 18)} textAnchor="middle" fill="white" fontSize="11" fontWeight="600">
                {d.count} · {d.date.slice(5)}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
