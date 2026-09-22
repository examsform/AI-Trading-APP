import { AiSignal } from "../ai-engine/mockSignalEngine";
import { DemoAccount } from "../paper-trading/types";

export interface RiskRules {
  maxRiskPerTradePct: number; // % of account cash
  minRiskRewardRatio: number;
  maxOpenPositions: number;
}

export const DEFAULT_RISK_RULES: RiskRules = {
  maxRiskPerTradePct: 0.02, // never risk more than 2% of virtual capital on one trade
  minRiskRewardRatio: 1.2,
  maxOpenPositions: 5,
};

export interface RiskCheckResult {
  approved: boolean;
  reasons: string[];
}

const TRADEABLE_DECISIONS = ["STRONG_TRADE_CANDIDATE", "TRADE_CANDIDATE"];

/**
 * Deterministic checks the AI cannot bypass (spec section 59).
 * quantity is what the caller intends to trade; this only validates, it never places anything.
 */
export function validateSignal(
  signal: AiSignal,
  account: DemoAccount,
  quantity: number,
  openPositionCount: number,
  rules: RiskRules = DEFAULT_RISK_RULES
): RiskCheckResult {
  const reasons: string[] = [];

  if (!TRADEABLE_DECISIONS.includes(signal.decision)) {
    reasons.push(`AI decision is ${signal.decision} — not an actionable trade candidate.`);
    return { approved: false, reasons };
  }

  if (signal.entry == null || signal.stopLoss == null || signal.target1 == null) {
    reasons.push("Trade candidate is missing entry/stop-loss/target — cannot validate.");
    return { approved: false, reasons };
  }

  const riskPerUnit = signal.entry - signal.stopLoss;
  const rewardPerUnit = signal.target1 - signal.entry;
  if (riskPerUnit <= 0 || rewardPerUnit <= 0) {
    reasons.push("Invalid entry/stop-loss/target ordering.");
  } else if (rewardPerUnit / riskPerUnit < rules.minRiskRewardRatio) {
    reasons.push(`Risk/reward ${(rewardPerUnit / riskPerUnit).toFixed(2)} below minimum ${rules.minRiskRewardRatio}.`);
  }

  const maxRiskAmount = account.cash * rules.maxRiskPerTradePct;
  const tradeRiskAmount = riskPerUnit * quantity;
  if (tradeRiskAmount > maxRiskAmount) {
    reasons.push(
      `Trade risk ₹${tradeRiskAmount.toFixed(0)} exceeds max allowed ₹${maxRiskAmount.toFixed(0)} (${rules.maxRiskPerTradePct * 100}% of capital).`
    );
  }

  if (openPositionCount >= rules.maxOpenPositions) {
    reasons.push(`Max open positions (${rules.maxOpenPositions}) reached.`);
  }

  return { approved: reasons.length === 0, reasons };
}

/**
 * Deterministic position sizing (spec section 60) — the AI never chooses quantity.
 * quantity = floor(available risk budget / risk per unit), rounded down to a lot multiple.
 */
export function calculatePositionSize(signal: AiSignal, account: DemoAccount, lotSize: number, rules: RiskRules = DEFAULT_RISK_RULES): number {
  if (signal.entry == null || signal.stopLoss == null) return 0;
  const riskPerUnit = signal.entry - signal.stopLoss;
  if (riskPerUnit <= 0) return 0;

  const riskBudget = account.cash * rules.maxRiskPerTradePct;
  const rawQuantity = Math.floor(riskBudget / riskPerUnit);
  const lots = Math.floor(rawQuantity / lotSize);
  return Math.max(0, lots * lotSize);
}
