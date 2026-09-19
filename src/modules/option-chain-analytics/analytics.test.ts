import { describe, expect, it } from "vitest";
import { analyzeOptionChain, classifyOiBehaviour } from "./analytics";
import { OptionChainRow } from "../market-data/providers/MarketDataProvider";

function row(overrides: Partial<OptionChainRow>): OptionChainRow {
  return {
    underlying: "NIFTY",
    expiry: "2026-09-25",
    strike: 24900,
    optionType: "CE",
    ltp: 100,
    bid: 99,
    ask: 101,
    volume: 10000,
    oi: 10000,
    oiChange: 100,
    iv: 15,
    greeks: null,
    timestamp: new Date().toISOString(),
    source: "test",
    quality: "MOCK",
    ...overrides,
  };
}

describe("option chain analytics", () => {
  it("flags an incomplete chain instead of computing misleading stats", () => {
    const result = analyzeOptionChain([], 24800);
    expect(result.dataQualityWarning).toContain("INCOMPLETE");
    expect(result.pcr).toBeNull();
  });

  it("computes PCR and total OI correctly", () => {
    const rows = [
      row({ strike: 24800, optionType: "CE", oi: 10000 }),
      row({ strike: 24800, optionType: "PE", oi: 20000 }),
    ];
    const result = analyzeOptionChain(rows, 24800);
    expect(result.totalCeOi).toBe(10000);
    expect(result.totalPeOi).toBe(20000);
    expect(result.pcr).toBeCloseTo(2, 2);
    expect(result.bias).toBe("PUT_HEAVY");
  });

  it("identifies the ATM strike as the one nearest spot", () => {
    const rows = [24700, 24750, 24800, 24850].flatMap((strike) => [
      row({ strike, optionType: "CE" }),
      row({ strike, optionType: "PE" }),
    ]);
    const result = analyzeOptionChain(rows, 24830);
    expect(result.atmStrike).toBe(24850);
  });

  it("ranks major call resistance and put support by OI", () => {
    const rows = [
      row({ strike: 25000, optionType: "CE", oi: 90000 }),
      row({ strike: 24900, optionType: "CE", oi: 30000 }),
      row({ strike: 24700, optionType: "PE", oi: 80000 }),
      row({ strike: 24600, optionType: "PE", oi: 20000 }),
    ];
    const result = analyzeOptionChain(rows, 24800);
    expect(result.majorCallResistance[0].strike).toBe(25000);
    expect(result.majorPutSupport[0].strike).toBe(24700);
  });

  it("flags unusual OI-change activity relative to the chain's own average", () => {
    const rows = [
      row({ strike: 24800, optionType: "CE", oiChange: 100 }),
      row({ strike: 24850, optionType: "CE", oiChange: 120 }),
      row({ strike: 24900, optionType: "CE", oiChange: 15000 }), // way above average
    ];
    const result = analyzeOptionChain(rows, 24800);
    expect(result.unusualActivity.some((u) => u.strike === 24900)).toBe(true);
  });

  it("classifies OI behaviour using price + OI together, not OI alone", () => {
    expect(classifyOiBehaviour(500, 0.5, "CE")).toBe("LONG_BUILDUP");
    expect(classifyOiBehaviour(-500, 0.5, "CE")).toBe("SHORT_COVERING");
    expect(classifyOiBehaviour(500, -0.5, "CE")).toBe("SHORT_BUILDUP");
    expect(classifyOiBehaviour(-500, -0.5, "CE")).toBe("LONG_UNWINDING");
  });

  it("returns INSUFFICIENT_EVIDENCE when price barely moved", () => {
    expect(classifyOiBehaviour(500, 0.001, "CE")).toBe("INSUFFICIENT_EVIDENCE");
    expect(classifyOiBehaviour(null, 1, "PE")).toBe("INSUFFICIENT_EVIDENCE");
  });
});
