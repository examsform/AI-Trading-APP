"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { addJournalEntry, closeJournalEntry, deleteJournalEntry, listJournalEntries, ManualJournalEntry } from "@/modules/journal/manualJournal";

function fmtMoney(n: number) {
  const neg = n < 0;
  return (neg ? "-" : "") + "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function JournalPage() {
  const { aiSignal, signalHistory } = useStore();
  const [entries, setEntries] = useState<ManualJournalEntry[]>([]);
  const [strike, setStrike] = useState(aiSignal?.strike ?? 24900);
  const [optionType, setOptionType] = useState<"CE" | "PE">(aiSignal?.optionType ?? "CE");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [entry, setEntry] = useState(aiSignal?.entry ?? 100);
  const [qty, setQty] = useState(75);
  const [linkToSignal, setLinkToSignal] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setEntries(listJournalEntries());
  }, []);

  function handleAdd() {
    const created = addJournalEntry({
      underlying: "NIFTY",
      strike,
      optionType,
      side,
      actualEntry: entry,
      actualQuantity: qty,
      notes: notes || undefined,
      linkedSignalId: linkToSignal ? aiSignal?.id : undefined,
    });
    setEntries((prev) => [...prev, created]);
    setNotes("");
  }

  function handleClose(id: string, actualEntry: number, qty: number, side: "BUY" | "SELL") {
    const exitStr = window.prompt("Actual exit price (₹)?");
    if (!exitStr) return;
    const exitPrice = parseFloat(exitStr);
    if (!Number.isFinite(exitPrice)) return;
    const dir = side === "BUY" ? 1 : -1;
    const pnl = (exitPrice - actualEntry) * qty * dir;
    setEntries(closeJournalEntry(id, exitPrice, pnl));
  }

  function handleDelete(id: string) {
    setEntries(deleteJournalEntry(id));
  }

  const linkedSignalFor = (entryRow: ManualJournalEntry) => signalHistory.find((s) => s.id === entryRow.linkedSignalId);

  return (
    <div className="space-y-3">
      <Link href="/" className="text-[12px] text-sub">← Dashboard</Link>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Log a real Angel One trade</div>
        <div className="text-[10.5px] text-sub mb-2.5">
          This is separate from paper trading — it's a record of what you actually executed manually on
          Angel One, so it can be compared against what the AI plan said.
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] text-sub block mb-1">Strike</label>
            <input type="number" value={strike} onChange={(e) => setStrike(parseInt(e.target.value || "0"))} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-[11px] text-sub block mb-1">Type</label>
            <select value={optionType} onChange={(e) => setOptionType(e.target.value as "CE" | "PE")} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm">
              <option value="CE">CE</option>
              <option value="PE">PE</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-sub block mb-1">Side</label>
            <select value={side} onChange={(e) => setSide(e.target.value as "BUY" | "SELL")} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm">
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-sub block mb-1">Actual entry (₹)</label>
            <input type="number" value={entry} onChange={(e) => setEntry(parseFloat(e.target.value || "0"))} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-[11px] text-sub block mb-1">Actual quantity</label>
            <input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value || "0"))} className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm font-mono" />
          </div>
        </div>

        {aiSignal?.strike != null && (
          <label className="flex items-center gap-2 mt-2.5 text-[11.5px] text-sub">
            <input type="checkbox" checked={linkToSignal} onChange={(e) => setLinkToSignal(e.target.checked)} />
            Link to the current AI plan ({aiSignal.strike}{aiSignal.optionType}, {aiSignal.decision})
          </label>
        )}

        <label className="text-[11px] text-sub block mt-2.5 mb-1">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. entered late, followed the plan exactly, etc." className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm" />

        <button onClick={handleAdd} className="w-full mt-3 bg-signal text-[#181206] font-semibold text-sm rounded-lg py-2.5">
          Log this trade
        </button>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Journal ({entries.length})</div>
        {entries.length === 0 ? (
          <div className="text-center text-sub text-[12.5px] py-6">No manual trades logged yet.</div>
        ) : (
          [...entries].reverse().map((e) => {
            const signal = linkedSignalFor(e);
            return (
              <div key={e.id} className="border-b border-line py-2.5 last:border-b-0">
                <div className="flex justify-between text-[13px] font-semibold">
                  <span>
                    {e.strike} {e.optionType} · {e.side}
                  </span>
                  {e.actualPnl != null ? (
                    <span className={`font-mono ${e.actualPnl >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(e.actualPnl)}</span>
                  ) : (
                    <span className="text-[10px] text-signal">OPEN</span>
                  )}
                </div>
                <div className="text-[11px] text-sub mt-0.5">
                  Entry ₹{e.actualEntry.toFixed(2)} x{e.actualQuantity} {e.actualExit != null && `→ Exit ₹${e.actualExit.toFixed(2)}`}
                </div>
                {e.notes && <div className="text-[11px] text-sub mt-0.5 italic">"{e.notes}"</div>}

                {signal && (
                  <div className="mt-1.5 text-[10.5px] bg-panel2 border border-line rounded-md px-2 py-1.5">
                    <span className="text-sub">AI plan said: </span>
                    entry ₹{signal.entry?.toFixed(2)} · SL ₹{signal.stopLoss?.toFixed(2)} · T1 ₹{signal.target1?.toFixed(2)} ({signal.decision})
                    {e.actualEntry != null && signal.entry != null && (
                      <span className="text-sub"> — you entered at {e.actualEntry > signal.entry ? "a worse" : "a better"} price than the plan.</span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-1.5">
                  {e.actualExit == null && (
                    <button onClick={() => handleClose(e.id, e.actualEntry, e.actualQuantity, e.side)} className="bg-panel2 border border-line text-text text-[11px] rounded-md px-2.5 py-1">
                      Close
                    </button>
                  )}
                  <button onClick={() => handleDelete(e.id)} className="bg-panel2 border border-line text-sub text-[11px] rounded-md px-2.5 py-1">
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
