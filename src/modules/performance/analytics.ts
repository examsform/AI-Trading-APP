import { ClosedTrade } from "../paper-trading/types";

export interface PerformanceStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // 0-100
  grossPnl: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number; // stored as a positive number (magnitude)
  profitFactor: number | null; // null when there are no losses to divide by
  expectancy: number; // average net P&L per trade
  maxDrawdown: number; // largest peak-to-trough dip in cumulative net P&L, positive number
  consecutiveWins: number;
  consecutiveLosses: number;
  sufficientSample: boolean; // spec §13: flag misleading stats on small samples
}

const MIN_SAMPLE_SIZE = 20;

export interface PnlRecord {
  netPnl: number;
  grossPnl: number;
}

export function computeStats<T extends PnlRecord>(trades: T[]): PerformanceStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      grossPnl: 0,
      netPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: null,
      expectancy: 0,
      maxDrawdown: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      sufficientSample: false,
    };
  }

  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl < 0);
  const grossPnl = round2(trades.reduce((s, t) => s + t.grossPnl, 0));
  const netPnl = round2(trades.reduce((s, t) => s + t.netPnl, 0));
  const avgWin = wins.length ? round2(wins.reduce((s, t) => s + t.netPnl, 0) / wins.length) : 0;
  const avgLoss = losses.length ? round2(Math.abs(losses.reduce((s, t) => s + t.netPnl, 0)) / losses.length) : 0;
  const grossWin = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let curWinStreak = 0;
  let curLossStreak = 0;
  let bestWinStreak = 0;
  let bestLossStreak = 0;

  for (const t of trades) {
    cumulative += t.netPnl;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);

    if (t.netPnl > 0) {
      curWinStreak += 1;
      curLossStreak = 0;
    } else if (t.netPnl < 0) {
      curLossStreak += 1;
      curWinStreak = 0;
    }
    bestWinStreak = Math.max(bestWinStreak, curWinStreak);
    bestLossStreak = Math.max(bestLossStreak, curLossStreak);
  }

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: round2((wins.length / trades.length) * 100),
    grossPnl,
    netPnl,
    avgWin,
    avgLoss,
    profitFactor: grossLoss > 0 ? round2(grossWin / grossLoss) : null,
    expectancy: round2(netPnl / trades.length),
    maxDrawdown: round2(maxDrawdown),
    consecutiveWins: bestWinStreak,
    consecutiveLosses: bestLossStreak,
    sufficientSample: trades.length >= MIN_SAMPLE_SIZE,
  };
}

export interface ConfidenceBucketStat {
  bucket: string; // e.g. "60-70%"
  trades: number;
  winRate: number;
  avgNetPnl: number;
}

/**
 * Confidence vs outcome breakdown (spec §21): does higher AI confidence actually
 * correlate with better results? Only meaningful for trades that carry a signal link.
 */
export function computeConfidenceBuckets(trades: ClosedTrade[]): ConfidenceBucketStat[] {
  const withSignal = trades.filter((t) => t.signal != null);
  const buckets = [
    [0, 60],
    [60, 70],
    [70, 80],
    [80, 90],
    [90, 101],
  ] as const;

  return buckets
    .map(([lo, hi]) => {
      const inBucket = withSignal.filter((t) => t.signal!.confidence >= lo && t.signal!.confidence < hi);
      if (inBucket.length === 0) return null;
      const wins = inBucket.filter((t) => t.netPnl > 0).length;
      return {
        bucket: hi >= 101 ? `${lo}-100%` : `${lo}-${hi}%`,
        trades: inBucket.length,
        winRate: round2((wins / inBucket.length) * 100),
        avgNetPnl: round2(inBucket.reduce((s, t) => s + t.netPnl, 0) / inBucket.length),
      };
    })
    .filter((b): b is ConfidenceBucketStat => b !== null);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
