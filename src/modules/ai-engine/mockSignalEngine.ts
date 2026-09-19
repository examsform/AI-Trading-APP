import { OptionChainRow, SpotPrice, Underlying } from "../market-data/providers/MarketDataProvider";
import { OptionChainAnalysis } from "../option-chain-analytics/analytics";

export type TradeDecision = "STRONG_TRADE_CANDIDATE" | "TRADE_CANDIDATE" | "WATCH" | "WAIT" | "NO_TRADE" | "INVALIDATED";

/**
 * Structured AI trade plan — matches spec section 23. This is the full shape a real
 * AIProvider must return; the mock engine below fills it deterministically so every
 * downstream consumer (risk engine, UI, journal, performance) can be built against the
 * final shape before a real model call exists.
 */
export interface AiSignal {
  id: string;
  decision: TradeDecision;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number; // 0-100
  quality: number; // 0-100 trade quality score
  underlying: Underlying;

  // Present only when decision is TRADE_CANDIDATE / STRONG_TRADE_CANDIDATE / WATCH
  strike?: number;
  optionType?: "CE" | "PE";
  entry?: number;
  confirmation?: string;
  stopLoss?: number;
  target1?: number;
  target2?: number;
  trailingStop?: string;
  invalidation?: string;
  riskReward?: number;
  expectedHoldingPeriod?: string;
  whyThisStrike?: string;
  whyNotOther?: string;

  supportingFactors: string[];
  conflictingFactors: string[];
  reasoning: string;

  timestamp: string;
  snapshotRef: string;
  disclaimer: string;
}

/**
 * MOCK/RULE-BASED — not a real model call. Proves out the full AiSignal/TradePlan shape
 * (spec section 57) using the deterministic option-chain analytics as its evidence, so a
 * real model call can be dropped in later without changing the risk engine, UI, or journal.
 *
 * Deliberately returns WAIT/NO_TRADE for a meaningful share of calls — the spec requires
 * the AI be comfortable saying no trade rather than forcing a decision every time.
 */
export function generateSignal(spot: SpotPrice, chain: OptionChainRow[], analysis: OptionChainAnalysis): AiSignal {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const snapshotRef = `mock-snap-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`;
  const disclaimer = "Structured placeholder from a rule-based mock — not a real model output, and not a real trading recommendation.";

  if (analysis.dataQualityWarning) {
    return {
      id,
      decision: "NO_TRADE",
      bias: "NEUTRAL",
      confidence: 0,
      quality: 0,
      underlying: spot.underlying,
      supportingFactors: [],
      conflictingFactors: [analysis.dataQualityWarning],
      reasoning: "Option chain data quality is insufficient to responsibly evaluate a setup.",
      timestamp,
      snapshotRef,
      disclaimer,
    };
  }

  // Deterministic "market structure" proxy from the mock spot change, standing in for
  // real price-action/trend analysis (spec section 12) until a real historical feed exists.
  const structureBullish = spot.change >= 0;
  const chainBullish = analysis.bias === "CALL_HEAVY" || (analysis.bias === "BALANCED" && spot.change >= 0);
  const chainBearish = analysis.bias === "PUT_HEAVY" || (analysis.bias === "BALANCED" && spot.change < 0);

  const supportingFactors: string[] = [];
  const conflictingFactors: string[] = [];

  if (structureBullish) supportingFactors.push("Underlying price change is positive (mock structure proxy).");
  else supportingFactors.push("Underlying price change is negative (mock structure proxy).");

  if (structureBullish && chainBullish) supportingFactors.push(`Option-chain bias (${analysis.bias}) agrees with underlying direction.`);
  else if (structureBullish && chainBearish) conflictingFactors.push(`Option-chain bias (${analysis.bias}) conflicts with bullish underlying move.`);
  else if (!structureBullish && chainBearish) supportingFactors.push(`Option-chain bias (${analysis.bias}) agrees with underlying direction.`);
  else if (!structureBullish && chainBullish) conflictingFactors.push(`Option-chain bias (${analysis.bias}) conflicts with bearish underlying move.`);

  if (analysis.unusualActivity.length > 0) {
    conflictingFactors.push(`${analysis.unusualActivity.length} strike(s) show unusual OI activity — adds uncertainty.`);
  }

  const veryFlat = Math.abs(spot.changePct) < 0.05;
  if (veryFlat) conflictingFactors.push("Underlying move is very small — insufficient evidence of directional structure.");

  // NO TRADE / WAIT engine (spec section 27): significant conflict or flat market wins over any single bullish/bearish tilt.
  if (veryFlat || conflictingFactors.length >= supportingFactors.length) {
    return {
      id,
      decision: conflictingFactors.length > supportingFactors.length ? "NO_TRADE" : "WAIT",
      bias: "NEUTRAL",
      confidence: Math.round(30 + Math.random() * 15),
      quality: Math.round(20 + Math.random() * 20),
      underlying: spot.underlying,
      supportingFactors,
      conflictingFactors,
      reasoning: veryFlat
        ? "Underlying is essentially flat — no directional structure to trade against yet."
        : "Conflicting evidence between underlying structure and option-chain bias — better setups should wait for confirmation.",
      timestamp,
      snapshotRef,
      disclaimer,
    };
  }

  const bull = structureBullish;
  const bias = bull ? "BULLISH" : "BEARISH";
  const optionType: "CE" | "PE" = bull ? "CE" : "PE";
  const preferredStrike = bull ? analysis.atmStrike + strikeStep(spot.underlying) : analysis.atmStrike - strikeStep(spot.underlying);
  const alternativeStrike = analysis.atmStrike;

  const row = chain.find((r) => r.strike === preferredStrike && r.optionType === optionType);
  const entry = row?.ltp ?? round2(70 + Math.random() * 90);
  const stopLoss = round2(entry * 0.7);
  const target1 = round2(entry * 1.3);
  const target2 = round2(entry * 1.6);
  const riskReward = round2((target1 - entry) / (entry - stopLoss));

  const confidence = Math.round(55 + supportingFactors.length * 8 - conflictingFactors.length * 6 + Math.random() * 8);
  const quality = Math.round(50 + supportingFactors.length * 10 - conflictingFactors.length * 8);
  const decision: TradeDecision = confidence >= 75 && quality >= 65 ? "STRONG_TRADE_CANDIDATE" : "TRADE_CANDIDATE";

  return {
    id,
    decision,
    bias,
    confidence: clamp(confidence, 0, 100),
    quality: clamp(quality, 0, 100),
    underlying: spot.underlying,
    strike: preferredStrike,
    optionType,
    entry,
    confirmation: bull
      ? "Wait for underlying to hold above the current level on the next candle before entering — do not chase the first tick."
      : "Wait for underlying to hold below the current level on the next candle before entering — do not chase the first tick.",
    stopLoss,
    target1,
    target2,
    trailingStop: "Once Target 1 is hit, trail stop-loss to entry price.",
    invalidation: bull
      ? `Setup is invalidated if underlying reverses below ${round2(spot.ltp * 0.998)} or option-chain bias flips to PUT_HEAVY.`
      : `Setup is invalidated if underlying reverses above ${round2(spot.ltp * 1.002)} or option-chain bias flips to CALL_HEAVY.`,
    riskReward,
    expectedHoldingPeriod: "Intraday — a few hours, exit by end of session if neither target nor SL is hit.",
    whyThisStrike: `${preferredStrike}${optionType} chosen for better risk/reward than the ATM strike while still being liquid enough (mock liquidity check).`,
    whyNotOther: `ATM ${alternativeStrike}${optionType} was considered but offers a worse risk/reward for the same directional view in this mock evaluation.`,
    supportingFactors,
    conflictingFactors,
    reasoning: bull
      ? "Underlying structure and option-chain bias both lean bullish; evaluated as a directional CE candidate."
      : "Underlying structure and option-chain bias both lean bearish; evaluated as a directional PE candidate.",
    timestamp,
    snapshotRef,
    disclaimer,
  };
}

function strikeStep(underlying: Underlying): number {
  return underlying === "NIFTY" ? 50 : 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
