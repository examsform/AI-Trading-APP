"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { OrderSide, Underlying } from "@/modules/paper-trading/types";

function TradeForm() {
  const { chain, placeOrder, consumePendingSignal } = useStore();
  const params = useSearchParams();

  const [instr, setInstr] = useState<Underlying>("NIFTY");
  const [strikeVal, setStrikeVal] = useState<string>("");
  const [side, setSide] = useState<OrderSide>("BUY");
  const [lots, setLots] = useState(1);

  const strikes = Array.from(new Set(chain.map((r) => r.strike))).sort((a, b) => a - b);

  useEffect(() => {
    const strikeParam = params.get("strike");
    const typeParam = params.get("type");
    if (strikeParam && typeParam) setStrikeVal(`${strikeParam}-${typeParam}`);
    else if (strikes.length && !strikeVal) setStrikeVal(`${strikes[0]}-CE`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, chain.length]);

  const lotSize = instr === "NIFTY" ? 75 : 35;

  function handlePlace() {
    if (!strikeVal) return;
    const [strikeStr, optionType] = strikeVal.split("-") as [string, "CE" | "PE"];
    const instrument = { underlying: instr, expiry: chain[0]?.expiry ?? new Date().toISOString().slice(0, 10), strike: Number(strikeStr), optionType };
    const pendingSignal = consumePendingSignal();
    placeOrder(instrument, side, lots * lotSize, pendingSignal);
  }

  const selectedLtp = (() => {
    if (!strikeVal) return null;
    const [strikeStr, optionType] = strikeVal.split("-") as [string, "CE" | "PE"];
    const row = chain.find((r) => r.strike === Number(strikeStr) && r.optionType === optionType);
    return row?.ltp ?? null;
  })();

  return (
    <div className="bg-panel border border-line rounded-xl p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-sub">Place paper order</div>
        <span className="text-[10px] border border-mockc/35 bg-mockc/10 text-mockc rounded px-1.5 py-0.5">SIMULATED</span>
      </div>

      <label className="text-[11px] text-sub block mt-2.5">Instrument</label>
      <select
        value={instr}
        onChange={(e) => setInstr(e.target.value as Underlying)}
        className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm mt-1"
      >
        <option value="NIFTY">NIFTY</option>
        <option value="BANKNIFTY">BANKNIFTY</option>
      </select>

      <label className="text-[11px] text-sub block mt-2.5">Strike / Type {selectedLtp != null && <span className="font-mono">· LTP {selectedLtp.toFixed(2)}</span>}</label>
      <select
        value={strikeVal}
        onChange={(e) => setStrikeVal(e.target.value)}
        className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm mt-1"
      >
        {strikes.map((s) => (
          <optgroup key={s} label={`${s}`}>
            <option value={`${s}-CE`}>{s} CE</option>
            <option value={`${s}-PE`}>{s} PE</option>
          </optgroup>
        ))}
      </select>

      <label className="text-[11px] text-sub block mt-2.5">Side</label>
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={() => setSide("BUY")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${side === "BUY" ? "bg-up/15 text-up" : "bg-panel2 border border-line text-text"}`}
        >
          BUY
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${side === "SELL" ? "bg-down/15 text-down" : "bg-panel2 border border-line text-text"}`}
        >
          SELL
        </button>
      </div>

      <label className="text-[11px] text-sub block mt-2.5">Lots (1 lot = {lotSize})</label>
      <input
        type="number"
        min={1}
        max={20}
        value={lots}
        onChange={(e) => setLots(Math.max(1, parseInt(e.target.value || "1")))}
        className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm mt-1"
      />

      <button onClick={handlePlace} className="w-full mt-3.5 bg-signal text-[#181206] font-semibold text-sm rounded-lg py-3">
        Place virtual order
      </button>
      <div className="text-[10.5px] text-sub mt-2">
        Execution uses the mock LTP plus simulated slippage. No real broker order is sent in this build.
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-sub">Loading trade page...</div>}>
      <TradeForm />
    </Suspense>
  );
}
