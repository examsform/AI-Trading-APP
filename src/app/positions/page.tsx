"use client";
import Link from "next/link";
import { useStore, unrealized } from "@/lib/store";

function fmtMoney(n: number) {
  const neg = n < 0;
  return (neg ? "-" : "") + "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function PositionsPage() {
  const { positions, closedTrades, chain, closePos } = useStore();

  const trades = closedTrades.length;
  const wins = closedTrades.filter((c) => c.netPnl > 0).length;
  const netTotal = closedTrades.reduce((a, c) => a + c.netPnl, 0);

  return (
    <div className="space-y-3">
      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Performance (this session)</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[15px] font-semibold">{trades}</div>
            <div className="text-[10px] text-sub mt-0.5">Trades</div>
          </div>
          <div>
            <div className="text-[15px] font-semibold text-up">{trades ? Math.round((wins / trades) * 100) : 0}%</div>
            <div className="text-[10px] text-sub mt-0.5">Win rate</div>
          </div>
          <div>
            <div className={`text-[15px] font-semibold font-mono ${netTotal >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(netTotal)}</div>
            <div className="text-[10px] text-sub mt-0.5">Net P&amp;L</div>
          </div>
        </div>
        <Link href="/performance" className="block mt-3 text-center bg-panel2 border border-line text-text text-[12.5px] rounded-lg py-2">
          Full AI performance breakdown →
        </Link>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Open positions</div>
        {positions.length === 0 ? (
          <div className="text-center text-sub text-[12.5px] py-5">No open positions yet — place one from the Trade tab.</div>
        ) : (
          positions.map((p) => {
            const row = chain.find((r) => r.strike === p.instrument.strike && r.optionType === p.instrument.optionType);
            const ltp = row?.ltp ?? p.entryPrice;
            const pnl = unrealized(p, ltp);
            return (
              <div key={p.id} className="border-b border-line py-2.5 last:border-b-0">
                <div className="flex justify-between text-[13px] font-semibold">
                  <span>
                    {p.instrument.strike} {p.instrument.optionType} ·{" "}
                    <span className={p.side === "BUY" ? "text-up" : "text-down"}>{p.side}</span>
                  </span>
                  <span className="font-mono">{p.quantity} qty</span>
                </div>
                <div className="flex justify-between text-[11px] text-sub mt-0.5">
                  <span>
                    Entry ₹{p.entryPrice.toFixed(2)} · LTP ₹{ltp.toFixed(2)}
                  </span>
                  <span>{new Date(p.openedAt).toLocaleTimeString("en-IN", { hour12: false })}</span>
                </div>
                <div className={`text-[13px] font-semibold font-mono mt-1 ${pnl >= 0 ? "text-up" : "text-down"}`}>
                  {fmtMoney(pnl)} unrealized
                  <button onClick={() => closePos(p.id)} className="ml-2 bg-panel2 border border-line text-text text-[11px] rounded-md px-2.5 py-1">
                    Close
                  </button>
                </div>
                {p.alertedTarget ? (
                  <div className="mt-1.5 text-[11.5px] text-up bg-up/10 border border-up/30 rounded-md px-2 py-1.5">
                    🎯 AI: target reached — consider selling / closing now.
                  </div>
                ) : p.alertedStopLoss ? (
                  <div className="mt-1.5 text-[11.5px] text-down bg-down/10 border border-down/30 rounded-md px-2 py-1.5">
                    ⛔ AI: stop-loss hit — consider selling / closing now.
                  </div>
                ) : (
                  <div className="text-[10.5px] text-sub mt-1">
                    Target ₹{p.targetPrice.toFixed(2)} · SL ₹{p.stopLossPrice.toFixed(2)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Closed trades</div>
        {closedTrades.length === 0 ? (
          <div className="text-center text-sub text-[12.5px] py-5">No trades closed yet.</div>
        ) : (
          [...closedTrades].reverse().map((t) => (
            <div key={t.id} className="border-b border-line py-2.5 last:border-b-0">
              <div className="flex justify-between text-[13px] font-semibold">
                <span>
                  {t.instrument.strike} {t.instrument.optionType} · {t.side}
                  {t.signal && <span className="text-[10px] text-signal ml-1.5 align-middle">AI {t.signal.confidence}%</span>}
                </span>
                <span className={`font-mono ${t.netPnl >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(t.netPnl)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-sub mt-0.5">
                <span>
                  Entry ₹{t.entryPrice.toFixed(2)} → Exit ₹{t.exitPrice.toFixed(2)}
                </span>
                <span>{new Date(t.closedAt).toLocaleTimeString("en-IN", { hour12: false })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
