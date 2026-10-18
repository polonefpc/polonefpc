import { useId, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { weeklyMarketSeries, type SignalPoint } from "@/lib/market-series";
export type { SignalPoint } from "@/lib/market-series";

export function MarketIndicator({ direction, history, value }: { direction: "up" | "down"; history: SignalPoint[]; value: string }) {
  const id = useId().replace(/:/g, "");
  const [hovered, setHovered] = useState<number | null>(null);
  const series = weeklyMarketSeries(history, new Date().toISOString().slice(0, 10));
  const days = series.length ? series : [{ d: "", dir: direction, v: Number(value) || null }];
  let level = 0;
  const values = days.map(day => {
    level = day.v != null && Number.isFinite(day.v) ? day.v : level + (day.dir === "up" ? 1 : -1);
    return level;
  });
  const low = Math.min(...values), high = Math.max(...values);
  const spread = high - low || Math.max(Math.abs(high) * 0.01, 1);
  const points = values.map((v, i) => ({ x: 18 + i / Math.max(values.length - 1, 1) * 524, y: 98 - (v - low) / spread * 62 }));
  if (points.length === 1) points.unshift({ x: 18, y: 70 });
  if (days.length === 1) points[1] = { ...points[1], x: 542 };
  const path = points.map((point, i) => {
    if (!i) return `M ${point.x} ${point.y}`;
    const prev = points[i - 1];
    const middle = (prev.x + point.x) / 2;
    return `C ${middle} ${prev.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }).join(" ");
  const last = points[points.length - 1];
  const selected = hovered == null ? null : days[hovered];
  const Trend = direction === "up" ? TrendingUp : TrendingDown;

  return <div className="market-chart">
    <div className="flex min-h-10 items-center justify-between gap-3 text-start">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Trend className="size-4" /><span>حركة الأسبوع</span></div>
      <div className="min-w-0 text-end"><span className="block truncate text-lg font-bold tabular-nums" dir="auto">{selected ? selected.v ?? "—" : value || "—"}</span><span className="text-[10px] text-muted-foreground">{selected?.d || "آخر تحديث"}</span></div>
    </div>
    <svg className="market-arrow" viewBox="0 0 560 120" role="img" aria-label={direction === "up" ? "حركة السوق الأسبوعية — صاعد" : "حركة السوق الأسبوعية — نازل"} onPointerLeave={() => setHovered(null)}>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.18" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      {[36, 67, 98].map(y => <line key={y} x1="18" x2="542" y1={y} y2={y} className="market-grid" />)}
      <path d={`${path} L 542 118 L 18 118 Z`} fill={`url(#${id}-fill)`} />
      <path key={path} d={path} className="market-arrow-line" />
      {days.map((day, i) => { const point = points[days.length === 1 ? 1 : i]; return <g key={`${day.d}-${i}`} onPointerEnter={() => setHovered(i)}><circle cx={point.x} cy={point.y} r="16" fill="transparent" /><circle cx={point.x} cy={point.y} r={hovered === i ? 5 : 2.5} className="market-history-point" /><title>{day.d}: {day.v ?? (day.dir === "up" ? "صاعد" : "نازل")}</title></g>; })}
      <g className="market-dot"><circle cx={last.x} cy={last.y} r="9" fill="currentColor" opacity="0.16" /><circle cx={last.x} cy={last.y} r="4" fill="currentColor" /></g>
    </svg>
    {history.length > 1 && <div className="flex justify-between gap-1 text-[10px] tabular-nums text-muted-foreground" dir="ltr">{days.map(day => <span key={day.d}>{day.d.slice(5)}</span>)}</div>}
  </div>;
}