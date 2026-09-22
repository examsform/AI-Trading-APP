"use client";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

const DECISION_STYLE: Record<string, { label: string; className: string }> = {
  STRONG_TRADE_CANDIDATE: { label: "STRONG TRADE CANDIDATE", className: "bg-up/15 text-up" },
  TRADE_CANDIDATE: { label: "TRADE CANDIDATE", className: "bg-up/10 text-up" },
  WATCH: { label: "WATCH", className: "bg-signal/15 text-signal" },
  WAIT: { label: "WAIT", className: "bg-mockc/15 text-mockc" },
  NO_TRADE: { label: "NO TRADE", className: "bg-down/10 text-down" },
  INVALIDATED: { label: "INVALIDATED", className: "bg-down/15 text-down" },
};

const TRADEABLE = ["STRONG_TRADE_CANDIDATE", "TRADE_CANDIDATE"];

export default function AiPage() {
  const { aiSignal, chainAnalysis, regenSignal, tradeSignal, signalHistory } = useStore();
  const router = useRouter();

  function handleUseSignal() {
    const result = tradeSignal();
    if (!result) return; // store already toasts the risk-check failure reason
    router.push(`/trade?strike=${result.instrument.strike}&type=${result.instrument.optionType}`);
  }

  if (!aiSignal) {
    return <div className="text-center text-sub text-sm py-10">Loading AI signal…</div>;
  }

  const tradeable = TRADEABLE.includes(aiSignal.decision);
  const style = DECISION_STYLE[aiSignal.decision] ?? DECISION_STYLE.WAIT;

  return (
    <div className="space-y-3">
      {chainAnalysis && (
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="text-[11px] text-sub mb-2">Option-chain analysis (deterministic, before AI)</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-sub">PCR</div>
              <div className="text-[14px] font-mono font-semibold">{chainAnalysis.pcr?.toFixed(2) ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] text-sub">Bias</div>
              <div className="text-[12px] font-semibold mt-1">{chainAnalysis.bias.replace("_", " ")}</div>
            </div>
            <div>
              <div className="text-[10px] text-sub">ATM</div>
              <div className="text-[14px] font-mono font-semibold">{chainAnalysis.atmStrike}</div>
            </div>
          </div>
          {chainAnalysis.majorCallResistance[0] && (
            <div className="text-[11px] text-sub mt-2">
              Major call resistance: <span className="text-text font-mono">{chainAnalysis.majorCallResistance[0].strike}</span> · Major put support:{" "}
              <span className="text-text font-mono">{chainAnalysis.majorPutSupport[0]?.strike ?? "—"}</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-sub">AI trade plan</div>
          <span className="text-[10px] border border-mockc/35 bg-mockc/10 text-mockc rounded px-1.5 py-0.5">DEMO OUTPUT</span>
        </div>

        <div className={`mt-2.5 px-2.5 py-2 rounded-lg text-center font-bold text-sm ${style.className}`}>{style.label}</div>

        <div className="flex items-center gap-3 mt-2.5">
          <div>
            <div className="text-[10px] text-sub">Confidence</div>
            <div className="text-sm font-mono font-semibold">{aiSignal.confidence}/100</div>
          </div>
          <div>
            <div className="text-[10px] text-sub">Quality</div>
            <div className="text-sm font-mono font-semibold">{aiSignal.quality}/100</div>
          </div>
          {aiSignal.riskReward != null && (
            <div>
              <div className="text-[10px] text-sub">Risk/Reward</div>
              <div className="text-sm font-mono font-semibold">1:{aiSignal.riskReward.toFixed(2)}</div>
            </div>
          )}
        </div>

        {tradeable ? (
          <>
            <div className="text-[13px] font-semibold mt-3">
              NIFTY {aiSignal.strike} {aiSignal.optionType} — {aiSignal.bias}
            </div>

            {aiSignal.confirmation && <InfoRow label="Confirmation" value={aiSignal.confirmation} />}

            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <Level label="Entry" value={aiSignal.entry} />
              <Level label="Stop-loss" value={aiSignal.stopLoss} />
              <Level label="Target 1" value={aiSignal.target1} />
              <Level label="Target 2" value={aiSignal.target2} />
            </div>

            {aiSignal.trailingStop && <InfoRow label="Trailing SL" value={aiSignal.trailingStop} />}
            {aiSignal.invalidation && <InfoRow label="Invalidation" value={aiSignal.invalidation} />}
            {aiSignal.expectedHoldingPeriod && <InfoRow label="Expected holding period" value={aiSignal.expectedHoldingPeriod} />}
            {aiSignal.whyThisStrike && <InfoRow label="Why this strike" value={aiSignal.whyThisStrike} />}
            {aiSignal.whyNotOther && <InfoRow label="Why not the alternative" value={aiSignal.whyNotOther} />}
          </>
        ) : (
          <div className="text-[12.5px] text-sub mt-3">{aiSignal.reasoning}</div>
        )}

        {aiSignal.supportingFactors.length > 0 && (
          <FactorList label="Supporting" items={aiSignal.supportingFactors} tone="up" />
        )}
        {aiSignal.conflictingFactors.length > 0 && (
          <FactorList label="Conflicting" items={aiSignal.conflictingFactors} tone="down" />
        )}

        <div className="text-[10.5px] text-sub mt-2.5">
          Snapshot ref: <span className="font-mono">{aiSignal.snapshotRef}</span> · {aiSignal.disclaimer}
        </div>

        {tradeable && (
          <button onClick={handleUseSignal} className="w-full mt-3 bg-signal text-[#181206] font-semibold text-sm rounded-lg py-3">
            Use this plan → fill order form
          </button>
        )}
        <button onClick={regenSignal} className="w-full mt-2 bg-panel2 border border-line text-text text-sm rounded-lg py-2.5">
          Re-run analysis
        </button>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-1.5">Signal history ({signalHistory.length})</div>
        <div className="text-[12.5px] text-sub leading-relaxed">
          Every analysis run is recorded, never overwritten — {signalHistory.filter((s) => TRADEABLE.includes(s.decision)).length} were
          trade candidates, {signalHistory.filter((s) => !TRADEABLE.includes(s.decision)).length} were WATCH/WAIT/NO TRADE. This is how the
          system proves it's willing to say no trade rather than forcing one every time.
        </div>
      </div>
    </div>
  );
}

function Level({ label, value }: { label: string; value?: number }) {
  if (value == null) return null;
  return (
    <div className="bg-panel2 rounded-lg p-2 text-center">
      <div className="text-[10px] text-sub">{label}</div>
      <div className="text-[13.5px] font-semibold font-mono mt-0.5">₹{value.toFixed(2)}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 text-[11.5px]">
      <span className="text-sub">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function FactorList({ label, items, tone }: { label: string; items: string[]; tone: "up" | "down" }) {
  return (
    <div className="mt-2.5">
      <div className={`text-[10.5px] font-semibold ${tone === "up" ? "text-up" : "text-down"}`}>{label} factors</div>
      <ul className="text-[11.5px] text-sub mt-1 space-y-0.5 list-disc list-inside">
        {items.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
