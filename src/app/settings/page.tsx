"use client";
import { useState } from "react";
import Link from "next/link";
import { DEFAULT_RISK_RULES } from "@/modules/risk-engine/validate";

export default function SettingsPage() {
  const [rules, setRules] = useState(DEFAULT_RISK_RULES);
  const [saved, setSaved] = useState(false);

  function save() {
    // Persisted only in this browser tab for now — once Supabase is connected,
    // this should write to a `risk_rules` config table instead (see db migration).
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Risk rules</div>

        <Field
          label="Max risk per trade (% of virtual capital)"
          value={rules.maxRiskPerTradePct * 100}
          onChange={(v) => setRules((r) => ({ ...r, maxRiskPerTradePct: v / 100 }))}
          suffix="%"
        />
        <Field
          label="Minimum risk/reward ratio"
          value={rules.minRiskRewardRatio}
          onChange={(v) => setRules((r) => ({ ...r, minRiskRewardRatio: v }))}
          suffix=":1"
        />
        <Field
          label="Max open positions"
          value={rules.maxOpenPositions}
          onChange={(v) => setRules((r) => ({ ...r, maxOpenPositions: Math.round(v) }))}
        />

        <button onClick={save} className="w-full mt-3 bg-signal text-[#181206] font-semibold text-sm rounded-lg py-2.5">
          {saved ? "Saved ✓" : "Save"}
        </button>
        <div className="text-[10.5px] text-sub mt-2">
          Any AI signal that fails these checks is rejected before it can become a paper order —
          the AI cannot bypass this layer.
        </div>
      </div>

      <Link href="/audit" className="block bg-panel border border-line rounded-xl p-3.5">
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-semibold">View audit trail</span>
          <span className="text-sub text-sm">→</span>
        </div>
        <div className="text-[11px] text-sub mt-1">Every signal, risk check, order, and exit alert — timestamped.</div>
      </Link>

      <Link href="/backtest" className="block bg-panel border border-line rounded-xl p-3.5">
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-semibold">Run a backtest</span>
          <span className="text-sub text-sm">→</span>
        </div>
        <div className="text-[11px] text-sub mt-1">Test an SMA-crossover strategy against historical mock candles.</div>
      </Link>

      <Link href="/journal" className="block bg-panel border border-line rounded-xl p-3.5">
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-semibold">Manual trade journal</span>
          <span className="text-sub text-sm">→</span>
        </div>
        <div className="text-[11px] text-sub mt-1">Log what you actually executed on Angel One vs. what the AI plan said.</div>
      </Link>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Demo account</div>
        <div className="text-[12.5px] text-sub">
          Default virtual capital is locked at <span className="font-mono text-text">₹10,00,000</span> per the
          product spec. Changing this per-account will be exposed here once accounts are backed by Supabase.
        </div>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">Connections</div>
        <ConnRow label="Market data provider" value="Mock" />
        <AngelOneConnRow />
        <ConnRow label="AI provider" value="Rule-based mock" />
        <div className="text-[10.5px] text-sub mt-2">
          Personal V1 uses Angel One only — no other broker is integrated in this build. Real orders are
          never placed automatically; the app only ever shows a plan for you to execute manually.
        </div>
      </div>
    </div>
  );
}

function AngelOneConnRow() {
  const [status, setStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: "Checking...",
  });

  useState(() => {
    fetch("/api/health/angelone")
      .then((res) => res.json())
      .then((data) => setStatus({ connected: Boolean(data.connected), message: data.message }))
      .catch(() => setStatus({ connected: false, message: "Not connected" }));
  });

  return (
    <div className="flex justify-between text-xs py-1">
      <span>Angel One (SmartAPI)</span>
      <span
        className={`text-[10px] border rounded px-1.5 py-0.5 ${
          status.connected
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400 font-semibold"
            : "border-mockc/35 bg-mockc/10 text-mockc"
        }`}
        title={status.message}
      >
        {status.connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="mt-2.5">
      <label className="text-[11px] text-sub block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
          className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm font-mono"
        />
        {suffix && <span className="text-sub text-xs">{suffix}</span>}
      </div>
    </div>
  );
}

function ConnRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs py-1">
      <span>{label}</span>
      <span className="text-[10px] border border-mockc/35 bg-mockc/10 text-mockc rounded px-1.5 py-0.5">{value}</span>
    </div>
  );
}
