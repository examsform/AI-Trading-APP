import { OptionChainRow } from "../market-data/providers/MarketDataProvider";

export type OiBehaviour = "LONG_BUILDUP" | "SHORT_BUILDUP" | "SHORT_COVERING" | "LONG_UNWINDING" | "INSUFFICIENT_EVIDENCE";

export interface StrikeZone {
  strike: number;
  oi: number;
  oiChange: number;
}

export interface OptionChainAnalysis {
  atmStrike: number;
  totalCeOi: number;
  totalPeOi: number;
  pcr: number | null; // PE OI / CE OI — null when CE OI is 0 (can't divide)
  majorCallResistance: StrikeZone[]; // top CE OI strikes — a *candidate* resistance zone, not a guarantee
  majorPutSupport: StrikeZone[]; // top PE OI strikes — a *candidate* support zone, not a guarantee
  unusualActivity: { strike: number; optionType: "CE" | "PE"; reason: string }[];
  bias: "CALL_HEAVY" | "PUT_HEAVY" | "BALANCED";
  dataQualityWarning?: string;
}

/**
 * Classifies OI behaviour for one row using OI change + underlying price change together —
 * never OI alone (spec section 11). Returns INSUFFICIENT_EVIDENCE rather than guessing
 * when the inputs don't clearly support one of the four classic patterns.
 */
export function classifyOiBehaviour(oiChange: number | null, priceChangePct: number, optionType: "CE" | "PE"): OiBehaviour {
  if (oiChange == null || Math.abs(priceChangePct) < 0.02) return "INSUFFICIENT_EVIDENCE";

  const priceUp = priceChangePct > 0;
  const oiUp = oiChange > 0;

  // For CE: price up + OI up = long buildup (bullish); price up + OI down = short covering.
  // For PE: price up (of the put) + OI up = writers building puts (bearish-for-put-side);
  // this function reports the OI pattern itself, not a directional market call.
  if (optionType === "CE") {
    if (priceUp && oiUp) return "LONG_BUILDUP";
    if (priceUp && !oiUp) return "SHORT_COVERING";
    if (!priceUp && oiUp) return "SHORT_BUILDUP";
    return "LONG_UNWINDING";
  } else {
    if (priceUp && oiUp) return "LONG_BUILDUP";
    if (priceUp && !oiUp) return "SHORT_COVERING";
    if (!priceUp && oiUp) return "SHORT_BUILDUP";
    return "LONG_UNWINDING";
  }
}

/**
 * Full-chain deterministic analytics (spec section 10). This runs BEFORE anything is handed
 * to the AI layer — the AI receives this summary, not raw rows, and never sees only one strike.
 */
export function analyzeOptionChain(rows: OptionChainRow[], spotPrice: number): OptionChainAnalysis {
  if (rows.length === 0) {
    return {
      atmStrike: Math.round(spotPrice / 50) * 50,
      totalCeOi: 0,
      totalPeOi: 0,
      pcr: null,
      majorCallResistance: [],
      majorPutSupport: [],
      unusualActivity: [],
      bias: "BALANCED",
      dataQualityWarning: "OPTION CHAIN INCOMPLETE — no rows available.",
    };
  }

  const strikes = Array.from(new Set(rows.map((r) => r.strike))).sort((a, b) => a - b);
  const atmStrike = strikes.reduce((closest, s) => (Math.abs(s - spotPrice) < Math.abs(closest - spotPrice) ? s : closest), strikes[0]);

  const ceRows = rows.filter((r) => r.optionType === "CE");
  const peRows = rows.filter((r) => r.optionType === "PE");
  const totalCeOi = ceRows.reduce((s, r) => s + (r.oi ?? 0), 0);
  const totalPeOi = peRows.reduce((s, r) => s + (r.oi ?? 0), 0);
  const pcr = totalCeOi > 0 ? round2(totalPeOi / totalCeOi) : null;

  const majorCallResistance = [...ceRows]
    .sort((a, b) => (b.oi ?? 0) - (a.oi ?? 0))
    .slice(0, 3)
    .map((r) => ({ strike: r.strike, oi: r.oi ?? 0, oiChange: r.oiChange ?? 0 }));

  const majorPutSupport = [...peRows]
    .sort((a, b) => (b.oi ?? 0) - (a.oi ?? 0))
    .slice(0, 3)
    .map((r) => ({ strike: r.strike, oi: r.oi ?? 0, oiChange: r.oiChange ?? 0 }));

  // Unusual activity: OI-change magnitude far above the chain's own average — relative to
  // this chain's own data, not an arbitrary hard-coded number.
  const avgAbsOiChange = rows.reduce((s, r) => s + Math.abs(r.oiChange ?? 0), 0) / rows.length;
  const unusualActivity = rows
    .filter((r) => avgAbsOiChange > 0 && Math.abs(r.oiChange ?? 0) > avgAbsOiChange * 2.5)
    .map((r) => ({
      strike: r.strike,
      optionType: r.optionType,
      reason: `OI change ${(r.oiChange ?? 0).toLocaleString("en-IN")} is ${((Math.abs(r.oiChange ?? 0) / avgAbsOiChange)).toFixed(1)}x the chain average.`,
    }));

  const bias: OptionChainAnalysis["bias"] = pcr == null ? "BALANCED" : pcr > 1.15 ? "PUT_HEAVY" : pcr < 0.85 ? "CALL_HEAVY" : "BALANCED";

  const staleOrMockRows = rows.filter((r) => r.quality === "STALE" || r.quality === "UNAVAILABLE");
  const dataQualityWarning =
    staleOrMockRows.length > 0
      ? `${staleOrMockRows.length} of ${rows.length} chain rows are stale/unavailable — analysis below is restricted accordingly.`
      : undefined;

  return { atmStrike, totalCeOi, totalPeOi, pcr, majorCallResistance, majorPutSupport, unusualActivity, bias, dataQualityWarning };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
