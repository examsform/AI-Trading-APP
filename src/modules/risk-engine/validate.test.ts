import { describe, expect, it } from "vitest";
import { calculatePositionSize, validateSignal, DEFAULT_RISK_RULES } from "./validate";
import { createDemoAccount } from "../paper-trading/engine";
import { AiSignal } from "../ai-engine/mockSignalEngine";

function makeSignal(overrides: Partial<AiSignal> = {}): AiSignal {
  return {
    id: "sig-1",
    decision: "TRADE_CANDIDATE",
    bias: "BULLISH",
    confidence: 70,
    quality: 70,
    underlying: "NIFTY",
    strike: 24900,
    optionType: "CE",
    entry: 100,
    stopLoss: 70,
    target1: 160,
    target2: 190,
    supportingFactors: ["test"],
    conflictingFactors: [],
    reasoning: "test",
    timestamp: new Date().toISOString(),
    snapshotRef: "mock-snap-0001",
    disclaimer: "test",
    ...overrides,
  };
}

describe("risk engine — deterministic checks", () => {
  it("approves a TRADE_CANDIDATE with good risk/reward and acceptable size", () => {
    const account = createDemoAccount("u1", "a1");
    const result = validateSignal(makeSignal(), account, 75, 0, DEFAULT_RISK_RULES);
    expect(result.approved).toBe(true);
  });

  it("rejects WAIT/NO_TRADE decisions outright — they are not actionable", () => {
    const account = createDemoAccount("u1", "a1");
    const result = validateSignal(makeSignal({ decision: "NO_TRADE" }), account, 75, 0, DEFAULT_RISK_RULES);
    expect(result.approved).toBe(false);
    expect(result.reasons[0]).toContain("NO_TRADE");
  });

  it("rejects a signal below the minimum risk/reward ratio", () => {
    const account = createDemoAccount("u1", "a1");
    const signal = makeSignal({ entry: 100, stopLoss: 90, target1: 110 }); // R:R = 1.0
    const result = validateSignal(signal, account, 75, 0, DEFAULT_RISK_RULES);
    expect(result.approved).toBe(false);
    expect(result.reasons.some((r) => r.includes("Risk/reward"))).toBe(true);
  });

  it("rejects a signal whose trade risk exceeds max risk per trade", () => {
    const account = createDemoAccount("u1", "a1");
    const signal = makeSignal({ entry: 1000, stopLoss: 100, target1: 2000 });
    const result = validateSignal(signal, account, 75, 0, DEFAULT_RISK_RULES);
    expect(result.approved).toBe(false);
    expect(result.reasons.some((r) => r.includes("Trade risk"))).toBe(true);
  });

  it("rejects when max open positions is reached", () => {
    const account = createDemoAccount("u1", "a1");
    const result = validateSignal(makeSignal(), account, 75, DEFAULT_RISK_RULES.maxOpenPositions, DEFAULT_RISK_RULES);
    expect(result.approved).toBe(false);
    expect(result.reasons.some((r) => r.includes("Max open positions"))).toBe(true);
  });

  it("rejects an invalid entry/stop-loss/target ordering", () => {
    const account = createDemoAccount("u1", "a1");
    const signal = makeSignal({ entry: 100, stopLoss: 120, target1: 90 });
    const result = validateSignal(signal, account, 75, 0, DEFAULT_RISK_RULES);
    expect(result.approved).toBe(false);
  });
});

describe("deterministic position sizing", () => {
  it("sizes quantity from risk budget, never from AI choice, rounded to lot size", () => {
    const account = createDemoAccount("u1", "a1"); // cash 1,000,000, 2% budget = 20,000
    const signal = makeSignal({ entry: 100, stopLoss: 90 }); // risk per unit = 10
    const qty = calculatePositionSize(signal, account, 75, DEFAULT_RISK_RULES);
    // raw = 20000/10 = 2000 units -> 2000/75 = 26 lots -> 1950
    expect(qty).toBe(1950);
    expect(qty % 75).toBe(0);
  });

  it("returns 0 when stop-loss is not below entry", () => {
    const account = createDemoAccount("u1", "a1");
    const signal = makeSignal({ entry: 100, stopLoss: 100 });
    expect(calculatePositionSize(signal, account, 75, DEFAULT_RISK_RULES)).toBe(0);
  });
});
