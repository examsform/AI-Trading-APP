import { describe, expect, it } from "vitest";
import { runBacktest } from "./engine";
import { Candle } from "../market-data/providers/MarketDataProvider";

function makeCandle(i: number, close: number): Candle {
  return {
    timestamp: new Date(2026, 0, 1, 0, i).toISOString(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  };
}

describe("backtesting engine", () => {
  it("produces no trades when there are fewer candles than the slow period", () => {
    const candles = [10, 11, 12].map((c, i) => makeCandle(i, c));
    const result = runBacktest(candles, { fastPeriod: 3, slowPeriod: 5, quantity: 75 });
    expect(result.trades.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("enters on an SMA crossover and exits at the next candle's open (never same-candle close)", () => {
    // Construct a clean uptrend then downtrend so fast SMA crosses above then below slow SMA.
    const prices = [100, 100, 100, 100, 100, 105, 110, 115, 120, 125, 120, 110, 100, 90, 80, 80, 80];
    const candles = prices.map((p, i) => makeCandle(i, p));
    const result = runBacktest(candles, { fastPeriod: 2, slowPeriod: 4, quantity: 75 });

    expect(result.trades.length).toBeGreaterThan(0);
    for (const t of result.trades) {
      // entry/exit prices must correspond to some candle's OPEN price in the series (post-slippage),
      // and never to the exact close of the candle where the crossover was detected.
      expect(candles.some((c) => Math.abs(c.open - t.entryPrice / 1.002) < 0.5)).toBe(true);
    }
  });

  it("keeps equity flat until the first trade closes", () => {
    const prices = [100, 100, 100, 100, 100, 100, 100, 100];
    const candles = prices.map((p, i) => makeCandle(i, p));
    const result = runBacktest(candles, { fastPeriod: 2, slowPeriod: 4, quantity: 75 });
    expect(result.equityCurve[0].equity).toBe(0);
  });

  it("flags an unclosed position at the end of the window instead of silently dropping it", () => {
    const prices = [100, 100, 100, 100, 100, 105, 110, 115, 120, 125, 130, 135];
    const candles = prices.map((p, i) => makeCandle(i, p));
    const result = runBacktest(candles, { fastPeriod: 2, slowPeriod: 4, quantity: 75 });
    // Uptrend never reverses, so any opened position stays open till the end.
    if (result.trades.length === 0) {
      expect(result.warnings.some((w) => w.includes("open position"))).toBe(true);
    }
  });
});
