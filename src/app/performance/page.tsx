"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { computeConfidenceBuckets, computeStats } from "@/modules/performance/analytics";

function fmtMoney(n: number) {
  const neg = n < 0;
  return (neg ? "-" : "") + "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function PerformancePage() {
  const { closedTrades } = useStore();
  const stats = computeStats(closedTrades);
  const buckets = computeConfidenceBuckets(closedTrades);
  const signalLinked = closedTrades.filter((t) => t.signal != null).length;

  return (
    <div className="space-y-3">
      <Link href="/positions" className="text-[12px] text-sub">← Positions</Link>

      {!stats.sufficientSample && (
        <div className="text-[11.5px] text-mockc bg-mockc/10 border border-mockc/30 rounded-lg px-2.5 py-2">
          Only {stats.totalTrades} trade{stats.totalTrades === 1 ? "" : "s"} recorded — treat these numbers as
          indicative, not statistically meaningful, until at least 20 trades.
        </div>
      )}

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Core metrics</div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Win rate" value={`${stats.winRate.toFixed(1)}%`} tone={stats.winRate >= 50 ? "up" : "down"} />
          <Stat label="Net P&L" value={fmtMoney(stats.netPnl)} tone={stats.netPnl >= 0 ? "up" : "down"} />
          <Stat label="Profit factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"} />
          <Stat label="Expectancy / trade" value={fmtMoney(stats.expectancy)} tone={stats.expectancy >= 0 ? "up" : "down"} />
          <Stat label="Avg win" value={fmtMoney(stats.avgWin)} tone="up" />
          <Stat label="Avg loss" value={fmtMoney(-stats.avgLoss)} tone="down" />
          <Stat label="Max drawdown" value={fmtMoney(-stats.maxDrawdown)} tone="down" />
          <Stat label="Best win/loss streak" value={`${stats.consecutiveWins}W / ${stats.consecutiveLosses}L`} />
        </div>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">AI confidence vs outcome</div>
        {buckets.length === 0 ? (
          <div className="text-center text-sub text-[12.5px] py-4">
            No signal-linked trades yet — trades placed via "Use this signal" on the AI tab will show up here.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-sub border-b border-line">
                <th className="text-left font-medium py-1.5">Confidence</th>
                <th className="text-right font-medium py-1.5">Trades</th>
                <th className="text-right font-medium py-1.5">Win rate</th>
                <th className="text-right font-medium py-1.5">Avg P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.bucket} className="border-b border-line last:border-b-0">
                  <td className="py-1.5 font-mono">{b.bucket}</td>
                  <td className="py-1.5 text-right font-mono">{b.trades}</td>
                  <td className="py-1.5 text-right font-mono">{b.winRate.toFixed(0)}%</td>
                  <td className={`py-1.5 text-right font-mono ${b.avgNetPnl >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(b.avgNetPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="text-[10.5px] text-sub mt-2">
          {signalLinked} of {closedTrades.length} closed trades were opened directly from an AI signal.
        </div>
      </div>

      <div className="text-[10.5px] text-sub px-1">
        This answers: "if the AI's signals had actually been paper-traded, what would the result have been?" —
        computed only from real recorded trades in this session, never fabricated.
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <div className="text-[10px] text-sub">{label}</div>
      <div className={`text-[14.5px] font-semibold font-mono mt-0.5 ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>
        {value}
      </div>
    </div>
  );
}
