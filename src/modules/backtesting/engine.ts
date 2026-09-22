import { Candle } from "../market-data/providers/MarketDataProvider";
import { DEFAULT_EXECUTION_CONFIG, simulateCharges, simulateExecutionPrice } from "../paper-trading/engine";
import { ExecutionConfig } from "../paper-trading/types";

export interface BacktestConfig {
  fastPeriod: number;
  slowPeriod: number;
  quantity: number;
  executionConfig?: ExecutionConfig;
}

export interface BacktestTrade {
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  quantity: number;
  charges: number;
  grossPnl: number;
  netPnl: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equityCurve: { time: string; equity: number }[];
  strategy: string;
  candlesUsed: number;
  warnings: string[];
}

function sma(values: number[], period: number, uptoIndexInclusive: number): number | null {
  if (uptoIndexInclusive + 1 < period) return null;
  let sum = 0;
  for (let i = uptoIndexInclusive - period + 1; i <= uptoIndexInclusive; i++) sum += values[i];
  return sum / period;
}

/**
 * SMA crossover strategy, run strictly walk-forward:
 *  - the crossover decision at candle i uses only closes[0..i] (data available AT or BEFORE i)
 *  - the resulting order is executed at candle i+1's OPEN, never at candle i's own close/high/low,
 *    which is the standard guard against look-ahead bias (spec section 22).
 * This operates on the underlying's spot price series as a directional proxy — a real
 * options backtest additionally needs historical option-chain data, which is a separate
 * blocker (no licensed historical option-chain source is connected yet).
 */
export function runBacktest(candles: Candle[], config: BacktestConfig): BacktestResult {
  const warnings: string[] = [];
  if (candles.length < config.slowPeriod + 2) {
    warnings.push("Not enough candles for the configured slow period — results may be empty or unreliable.");
  }

  const execConfig = config.executionConfig ?? DEFAULT_EXECUTION_CONFIG;
  const closes = candles.map((c) => c.close);
  const trades: BacktestTrade[] = [];
  const equityCurve: { time: string; equity: number }[] = [];

  let inPosition = false;
  let entryPrice = 0;
  let entryTime = "";
  let equity = 0;

  for (let i = 0; i < candles.length - 1; i++) {
    const fast = sma(closes, config.fastPeriod, i);
    const slow = sma(closes, config.slowPeriod, i);
    const prevFast = sma(closes, config.fastPeriod, i - 1);
    const prevSlow = sma(closes, config.slowPeriod, i - 1);

    equityCurve.push({ time: candles[i].timestamp, equity: round2(equity) });

    if (fast == null || slow == null || prevFast == null || prevSlow == null) continue;

    const crossedUp = prevFast <= prevSlow && fast > slow;
    const crossedDown = prevFast >= prevSlow && fast < slow;
    const nextOpen = candles[i + 1].open; // execution price — never candle i's own price

    if (!inPosition && crossedUp) {
      entryPrice = simulateExecutionPrice(nextOpen, "BUY", execConfig);
      entryTime = candles[i + 1].timestamp;
      inPosition = true;
    } else if (inPosition && crossedDown) {
      const exitPrice = simulateExecutionPrice(nextOpen, "SELL", execConfig);
      const entryCharges = simulateCharges(entryPrice, config.quantity, execConfig);
      const exitCharges = simulateCharges(exitPrice, config.quantity, execConfig);
      const grossPnl = round2((exitPrice - entryPrice) * config.quantity);
      const netPnl = round2(grossPnl - entryCharges - exitCharges);
      trades.push({
        entryTime,
        entryPrice,
        exitTime: candles[i + 1].timestamp,
        exitPrice,
        quantity: config.quantity,
        charges: round2(entryCharges + exitCharges),
        grossPnl,
        netPnl,
      });
      equity += netPnl;
      inPosition = false;
    }
  }

  if (inPosition) {
    warnings.push("An open position remained at the end of the historical window and was not counted as a closed trade.");
  }

  equityCurve.push({ time: candles[candles.length - 1].timestamp, equity: round2(equity) });

  return {
    trades,
    equityCurve,
    strategy: `SMA(${config.fastPeriod}) / SMA(${config.slowPeriod}) crossover`,
    candlesUsed: candles.length,
    warnings,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
