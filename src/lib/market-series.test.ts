import { describe, test } from "node:test";
import { deepStrictEqual } from "node:assert";
import { weeklyMarketSeries } from "./market-series";

describe("weekly market history", () => {
  test("shows seven calendar days rather than seven saved updates", () => {
    const points = weeklyMarketSeries([{ d: "2026-10-01", dir: "down", v: 30 }, { d: "2026-10-14", dir: "up", v: 36.9 }], "2026-10-18");
    deepStrictEqual(points.map(p => p.d), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  });
  test("keeps recorded values and carries the last update without inventing price changes", () => {
    const points = weeklyMarketSeries([{ d: "2026-10-11", dir: "down", v: 31 }, { d: "2026-10-14", dir: "up", v: 36.9 }], "2026-10-18");
    deepStrictEqual(points[0], { d: "2026-10-12", dir: "down", v: 31 });
    deepStrictEqual(points[6], { d: "2026-10-18", dir: "up", v: 36.9 });
  });
});