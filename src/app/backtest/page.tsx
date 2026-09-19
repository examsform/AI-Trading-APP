"use client";
import { useState } from "react";
import Link from "next/link";
import { runBacktest, BacktestResult } from "@/modules/backtesting/engine";
import { computeStats } from "@/modules/performance/analytics";
import { Timeframe } from "@/modules/market-data/providers/MarketDataProvider";

function fmtMoney(n: number) {
  const neg = n < 0;
  return (neg ? "-" : "") + "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function BacktestPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [fastPeriod, setFastPeriod] = useState(5);
  const [slowPeriod, setSlowPeriod] = useState(20);
  const [quantity, setQuantity] = useState(75);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await fetch(`/api/market-data/historical?underlying=NIFTY&timeframe=${timeframe}`).then((r) => r.json());
    const bt = runBacktest(res.candles, { fastPeriod, slowPeriod, quantity });
    setResult(bt);
    setLoading(false);
  }

  const stats = result ? computeStats(result.trades) : null;

  return (
    <div className="space-y-3">
      <Link href="/" className="text-[12px] text-sub">← Dashboard</Link>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-sub">Backtest strategy</div>
          <span className="text-[10px] border border-mockc/35 bg-mockc/10 text-mockc rounded px-1.5 py-0.5">MOCK HISTORY</span>
        </div>

        <label className="text-[11px] text-sub block mt-2.5">Timeframe</label>
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm mt-1">
          <option value="5m">5 minute</option>
          <option value="15m">15 minute</option>
          <option value="1d">1 day</option>
        </select>

        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          <div>
            <label className="text-[11px] text-sub block mb-1">Fast SMA period</label>
            <input type="number" min={2} value={fastPeriod} onChange={(e) => setFastPeriod(parseInt(e.target.value || "2"))} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-[11px] text-sub block mb-1">Slow SMA period</label>
            <input type="number" min={3} value={slowPeriod} onChange={(e) => setSlowPeriod(parseInt(e.target.value || "3"))} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm font-mono" />
          </div>
        </div>

        <label className="text-[11px] text-sub block mt-2.5">Quantity (units of the underlying, proxy)</label>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value || "1"))} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm font-mono mt-1" />

        <button onClick={run} disabled={loading} className="w-full mt-3 bg-signal text-[#181206] font-semibold text-sm rounded-lg py-3 disabled:opacity-60">
          {loading ? "Running…" : "Run backtest"}
        </button>
        <div className="text-[10.5px] text-sub mt-2">
          Runs strictly walk-forward: each decision uses only past candles, and orders fill at the
          <i> next</i> candle's open — never at the candle where the signal appeared. This proxies
          NIFTY spot directionally; a real options backtest additionally needs a historical
          option-chain data source, which is a separate blocker.
        </div>
      </div>

      {result && stats && (
        <>
          {result.warnings.map((w, i) => (
            <div key={i} className="text-[11.5px] text-mockc bg-mockc/10 border border-mockc/30 rounded-lg px-2.5 py-2">
              {w}
            </div>
          ))}

          <div className="bg-panel border border-line rounded-xl p-3.5">
            <div className="text-[11px] text-sub mb-2">{result.strategy} · {result.candlesUsed} candles</div>
            <EquityCurve points={result.equityCurve} />
          </div>

          <div className="bg-panel border border-line rounded-xl p-3.5">
            <div className="text-[11px] text-sub mb-2">Results</div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Trades" value={String(stats.totalTrades)} />
              <Stat label="Win rate" value={`${stats.winRate.toFixed(1)}%`} tone={stats.winRate >= 50 ? "up" : "down"} />
              <Stat label="Net P&L" value={fmtMoney(stats.netPnl)} tone={stats.netPnl >= 0 ? "up" : "down"} />
              <Stat label="Profit factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"} />
              <Stat label="Expectancy/trade" value={fmtMoney(stats.expectancy)} tone={stats.expectancy >= 0 ? "up" : "down"} />
              <Stat label="Max drawdown" value={fmtMoney(-stats.maxDrawdown)} tone="down" />
            </div>
            {!stats.sufficientSample && (
              <div className="text-[11px] text-mockc mt-2.5">Fewer than 20 trades — not statistically meaningful yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EquityCurve({ points }: { points: { time: string; equity: number }[] }) {
  if (points.length < 2) return <div className="text-sub text-xs text-center py-6">Not enough data to plot.</div>;
  const W = 340;
  const H = 100;
  const values = points.map((p) => p.equity);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = W / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${H - ((p.equity - min) / range) * H}`).join(" ");
  const zeroY = H - ((0 - min) / range) * H;
  const last = values[values.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#232B38" strokeWidth={1} strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={last >= 0 ? "#3ECF8E" : "#FF5C5C"} strokeWidth={1.5} />
    </svg>
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
