export type SignalPoint = { d: string; dir: "up" | "down"; v: number | null };

export function weeklyMarketSeries(history: SignalPoint[], today: string): SignalPoint[] {
  const end = new Date(`${today}T12:00:00Z`);
  const entries = history.filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.d) && p.d <= today).sort((a, b) => a.d.localeCompare(b.d));
  if (!entries.length) return [];
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - 6 + i);
    const d = day.toISOString().slice(0, 10);
    const previous = entries.filter(p => p.d <= d).at(-1);
    return { d, dir: previous?.dir ?? "up", v: previous?.v ?? null } as SignalPoint;
  });
}