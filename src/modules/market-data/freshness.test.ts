import { describe, expect, it } from "vitest";
import { evaluateDataFreshness, getMarketSessionInfo, shouldReanalyze } from "./freshness";

describe("Market Hours & Data Freshness Engine", () => {
  it("should recognize market session for regular trading hours (10:30 AM IST Wednesday)", () => {
    // 2026-09-23 is Wednesday, 10:30 AM IST = 05:00 AM UTC
    const date = new Date("2026-09-23T05:00:00Z");
    const info = getMarketSessionInfo(date);
    expect(info.session).toBe("REGULAR_MARKET");
    expect(info.isOpen).toBe(true);
  });

  it("should recognize closed status for weekend", () => {
    // 2026-09-20 is Sunday
    const date = new Date("2026-09-20T05:00:00Z");
    const info = getMarketSessionInfo(date);
    expect(info.session).toBe("CLOSED");
    expect(info.isOpen).toBe(false);
  });

  it("should correctly classify MOCK data freshness", () => {
    const freshness = evaluateDataFreshness(new Date().toISOString(), "MOCK");
    expect(freshness).toBe("MOCK");
  });

  it("should trigger reanalysis on spot price move >= 0.5%", () => {
    const thirtySecAgo = new Date(Date.now() - 30000).toISOString();
    const result = shouldReanalyze({
      lastAnalysisTimestamp: thirtySecAgo,
      lastSpotLtp: 24000,
      currentSpotLtp: 24150, // +0.625%
      lastPcr: 1.0,
      currentPcr: 1.0,
    });
    expect(result.trigger).toBe(true);
    expect(result.reason).toContain("Significant spot move");
  });

  it("should enforce debounce guard when less than 15s elapsed", () => {
    const fiveSecAgo = new Date(Date.now() - 5000).toISOString();
    const result = shouldReanalyze({
      lastAnalysisTimestamp: fiveSecAgo,
      lastSpotLtp: 24000,
      currentSpotLtp: 24200,
      lastPcr: 1.0,
      currentPcr: 1.0,
    });
    expect(result.trigger).toBe(false);
    expect(result.reason).toContain("Debounce guard");
  });
});
