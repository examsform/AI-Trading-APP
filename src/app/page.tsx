"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import CandlestickChart from "@/components/CandlestickChart";
import { Candle, Timeframe } from "@/modules/market-data/providers/MarketDataProvider";

function fmtMoney(n: number) {
  const neg = n < 0;
  return (neg ? "-" : "") + "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function DashboardPage() {
  const { nifty, banknifty, account, closedTrades } = useStore();
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/market-data/historical?underlying=NIFTY&timeframe=${timeframe}`).then((r) => r.json());
      if (!cancelled) setCandles(res.candles);
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [timeframe]);

  const realizedTotal = closedTrades.reduce((s, t) => s + t.netPnl, 0);

  return (
    <div className="space-y-3">
      <PriceCard label="NIFTY 50" spot={nifty} />

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] text-sub">NIFTY chart</div>
          <div className="flex gap-1">
            {(["5m", "15m", "1d"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`text-[10px] px-2 py-1 rounded ${timeframe === tf ? "bg-signal text-[#181206] font-semibold" : "bg-panel2 border border-line text-sub"}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <CandlestickChart candles={candles} />
        <div className="text-[10px] text-sub mt-1">Mock OHLC — not real NIFTY price history.</div>
      </div>

      <PriceCard label="BANK NIFTY" spot={banknifty} />

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Demo account</div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="text-[11px] text-sub">Virtual capital</div>
            <div className="font-mono text-base font-semibold">{fmtMoney(account.initialCapital)}</div>
          </div>
          <div>
            <div className="text-[11px] text-sub">Available margin</div>
            <div className="font-mono text-base font-semibold">{fmtMoney(account.cash - account.usedMargin)}</div>
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-[11px] text-sub">Realized P&amp;L (closed trades)</div>
          <div className={`font-mono text-base font-semibold ${realizedTotal >= 0 ? "text-up" : "text-down"}`}>
            {fmtMoney(realizedTotal)}
          </div>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">System status</div>
        <div className="space-y-1.5 text-xs">
          <Row label="Market data provider" value="MOCK — no provider connected" tone="mock" />
          <Row label="Angel One (SmartAPI)" value="NOT CONNECTED" tone="mock" />
          <Row label="AI engine" value="RULE-BASED MOCK" tone="mock" />
        </div>
      </div>
    </div>
  );
}

function PriceCard({ label, spot }: { label: string; spot?: { ltp: number; change: number; changePct: number; timestamp: string; quality: string } }) {
  const up = (spot?.change ?? 0) >= 0;
  return (
    <div className="bg-panel border border-line rounded-xl p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-sub">{label}</div>
        <span className="text-[10px] border border-mockc/35 bg-mockc/10 text-mockc rounded px-1.5 py-0.5">MOCK</span>
      </div>
      {spot ? (
        <>
          <div>
            <span className="font-mono text-2xl font-semibold">{spot.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            <span className={`font-mono text-xs ml-1.5 ${up ? "text-up" : "text-down"}`}>
              {up ? "+" : ""}
              {spot.change.toFixed(2)} ({spot.changePct.toFixed(2)}%)
            </span>
          </div>
          <div className="text-[11px] text-sub mt-1">Last tick: {new Date(spot.timestamp).toLocaleTimeString("en-IN", { hour12: false })}</div>
        </>
      ) : (
        <div className="text-sub text-sm mt-1">Loading…</div>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "mock" | "live" }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={`text-[10px] rounded px-1.5 py-0.5 border ${tone === "mock" ? "border-mockc/35 bg-mockc/10 text-mockc" : "border-up/35 bg-up/10 text-up"}`}>
        {value}
      </span>
    </div>
  );
}
