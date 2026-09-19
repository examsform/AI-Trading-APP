"use client";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function ChainPage() {
  const { chain, chainAnalysis } = useStore();
  const router = useRouter();

  const strikes = Array.from(new Set(chain.map((r) => r.strike))).sort((a, b) => a - b);
  const spot = chain.length ? chain[0] : null;

  return (
    <div className="space-y-3">
      {chainAnalysis && (
        <div className="bg-panel border border-line rounded-xl p-3">
          <div className="text-[11px] text-sub mb-2">AI option-chain analysis</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <MiniStat label="PCR" value={chainAnalysis.pcr?.toFixed(2) ?? "—"} />
            <MiniStat label="Bias" value={chainAnalysis.bias.split("_")[0]} />
            <MiniStat label="CE OI" value={(chainAnalysis.totalCeOi / 1000).toFixed(0) + "K"} />
            <MiniStat label="PE OI" value={(chainAnalysis.totalPeOi / 1000).toFixed(0) + "K"} />
          </div>
          <div className="text-[10.5px] text-sub mt-2">
            Resistance zone: <span className="text-down font-mono">{chainAnalysis.majorCallResistance.map((z) => z.strike).join(", ") || "—"}</span> · Support
            zone: <span className="text-up font-mono">{chainAnalysis.majorPutSupport.map((z) => z.strike).join(", ") || "—"}</span>
          </div>
          {chainAnalysis.unusualActivity.length > 0 && (
            <div className="text-[10.5px] text-signal mt-1">
              Unusual activity: {chainAnalysis.unusualActivity.map((u) => `${u.strike}${u.optionType}`).join(", ")}
            </div>
          )}
        </div>
      )}

      <div className="bg-panel border border-line rounded-xl p-2">
        <div className="flex items-center justify-between px-1.5 pb-2">
          <div className="text-[11px] text-sub">
            NIFTY option chain {spot ? `· expiry ${spot.expiry}` : ""} {chainAnalysis ? `· ATM ${chainAnalysis.atmStrike}` : ""}
          </div>
          <span className="text-[10px] border border-mockc/35 bg-mockc/10 text-mockc rounded px-1.5 py-0.5">MOCK</span>
        </div>
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr className="text-sub border-b border-line">
              <th className="text-right font-medium py-1.5">OI</th>
              <th className="text-right font-medium py-1.5">Chg OI</th>
              <th className="text-right font-medium py-1.5">LTP</th>
              <th className="text-left font-medium py-1.5">Strike</th>
              <th className="text-right font-medium py-1.5">LTP</th>
              <th className="text-right font-medium py-1.5">Chg OI</th>
              <th className="text-right font-medium py-1.5">OI</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike) => {
              const ce = chain.find((r) => r.strike === strike && r.optionType === "CE");
              const pe = chain.find((r) => r.strike === strike && r.optionType === "PE");
              const isAtm = chainAnalysis?.atmStrike === strike;
              return (
                <tr
                  key={strike}
                  className={`border-b border-line active:bg-white/5 ${isAtm ? "bg-signal/10" : ""}`}
                  onClick={() => router.push(`/trade?strike=${strike}&type=CE`)}
                >
                  <td className="text-right font-mono py-1.5">{ce?.oi?.toLocaleString("en-IN") ?? "-"}</td>
                  <td className={`text-right font-mono py-1.5 ${((ce?.oiChange ?? 0) >= 0) ? "text-up" : "text-down"}`}>
                    {ce?.oiChange != null ? (ce.oiChange >= 0 ? "+" : "") + ce.oiChange.toLocaleString("en-IN") : "-"}
                  </td>
                  <td className="text-right font-mono py-1.5">{ce?.ltp?.toFixed(2) ?? "-"}</td>
                  <td className="text-left font-mono font-semibold py-1.5">{strike}</td>
                  <td className="text-right font-mono py-1.5">{pe?.ltp?.toFixed(2) ?? "-"}</td>
                  <td className={`text-right font-mono py-1.5 ${((pe?.oiChange ?? 0) >= 0) ? "text-up" : "text-down"}`}>
                    {pe?.oiChange != null ? (pe.oiChange >= 0 ? "+" : "") + pe.oiChange.toLocaleString("en-IN") : "-"}
                  </td>
                  <td className="text-right font-mono py-1.5">{pe?.oi?.toLocaleString("en-IN") ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="text-[10.5px] text-sub mt-2 px-1.5">
          CE columns left of strike, PE columns right. Highlighted row = ATM. Tap a row to open the Trade tab prefilled with that strike.
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-sub">{label}</div>
      <div className="text-[13px] font-mono font-semibold mt-0.5">{value}</div>
    </div>
  );
}
