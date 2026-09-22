import { describe, expect, it } from "vitest";
import { computeStats, computeConfidenceBuckets } from "./analytics";
import { ClosedTrade } from "../paper-trading/types";

function trade(netPnl: number, grossPnl = netPnl, confidence?: number): ClosedTrade {
  return {
    id: crypto.randomUUID(),
    accountId: "a1",
    instrument: { underlying: "NIFTY", expiry: "2026-09-25", strike: 24900, optionType: "CE" },
    side: "BUY",
    quantity: 75,
    entryPrice: 100,
    entryCharges: 10,
    openedAt: new Date().toISOString(),
    targetPrice: 140,
    stopLossPrice: 65,
    alertedTarget: false,
    alertedStopLoss: false,
    exitPrice: 100 + netPnl / 75,
    exitCharges: 10,
    closedAt: new Date().toISOString(),
    grossPnl,
    netPnl,
    signal: confidence != null ? { signalId: "s1", bias: "BULLISH", confidence } : undefined,
  };
}

describe("performance analytics", () => {
  it("returns a zeroed, insufficient-sample result for no trades", () => {
    const stats = computeStats([]);
    expect(stats.totalTrades).toBe(0);
    expect(stats.sufficientSample).toBe(false);
    expect(stats.profitFactor).toBeNull();
  });

  it("computes win rate, profit factor and expectancy for a known set of trades", () => {
    // 2 wins of +1000, 1 loss of -400 => win rate 66.67%, profit factor 2000/400=5, expectancy (2000-400)/3
    const trades = [trade(1000), trade(1000), trade(-400)];
    const stats = computeStats(trades);
    expect(stats.totalTrades).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBeCloseTo(66.67, 1);
    expect(stats.profitFactor).toBeCloseTo(5, 2);
    expect(stats.expectancy).toBeCloseTo((2000 - 400) / 3, 2);
    expect(stats.netPnl).toBeCloseTo(1600, 2);
  });

  it("tracks max drawdown across a losing streak", () => {
    // cumulative: 500, 300 (-200 dd), -200 (dd 700), 400 (recover)
    const trades = [trade(500), trade(-200), trade(-500), trade(600)];
    const stats = computeStats(trades);
    expect(stats.maxDrawdown).toBeCloseTo(700, 2);
    expect(stats.consecutiveLosses).toBe(2);
  });

  it("flags insufficient sample size below the threshold", () => {
    const stats = computeStats([trade(100)]);
    expect(stats.sufficientSample).toBe(false);
  });

  it("buckets trades by AI confidence and computes per-bucket win rate", () => {
    const trades = [trade(500, 500, 85), trade(-100, -100, 85), trade(300, 300, 55)];
    const buckets = computeConfidenceBuckets(trades);
    const highConf = buckets.find((b) => b.bucket === "80-90%");
    const lowConf = buckets.find((b) => b.bucket === "0-60%");
    expect(highConf?.trades).toBe(2);
    expect(highConf?.winRate).toBeCloseTo(50, 1);
    expect(lowConf?.trades).toBe(1);
  });

  it("excludes trades with no linked signal from confidence buckets", () => {
    const trades = [trade(500), trade(-100, -100, 70)];
    const buckets = computeConfidenceBuckets(trades);
    const total = buckets.reduce((s, b) => s + b.trades, 0);
    expect(total).toBe(1);
  });
});
