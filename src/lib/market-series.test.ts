import { describe, expect, test } from "bun:test";
import { weeklyMarketSeries } from "./market-series";

describe("weekly market history", () => {
  test("shows seven calendar days rather than seven saved updates", () => {
    const points = weeklyMarketSeries([{ d: "2026-10-01", dir: "down", v: 30 }, { d: "2026-10-14", dir: "up", v: 36.9 }], "2026-10-18");
    expect(points.map(p => p.d)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  });
  test("keeps recorded values and carries the last update without inventing price changes", () => {
    const points = weeklyMarketSeries([{ d: "2026-10-11", dir: "down", v: 31 }, { d: "2026-10-14", dir: "up", v: 36.9 }], "2026-10-18");
    expect(points[0]).toEqual({ d: "2026-10-12", dir: "down", v: 31 });
    expect(points[6]).toEqual({ d: "2026-10-18", dir: "up", v: 36.9 });
  });
});