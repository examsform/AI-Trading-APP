"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  closePosition as engineClosePosition,
  createDemoAccount,
  evaluateExitAlert,
  placeOrder as engineePlaceOrder,
  unrealizedPnl,
} from "@/modules/paper-trading/engine";
import { ClosedTrade, DemoAccount, Instrument, OrderSide, PaperPosition } from "@/modules/paper-trading/types";
import { OptionChainRow, SpotPrice } from "@/modules/market-data/providers/MarketDataProvider";
import { AiSignal, generateSignal } from "@/modules/ai-engine/mockSignalEngine";
import { analyzeOptionChain, OptionChainAnalysis } from "@/modules/option-chain-analytics/analytics";
import { DEFAULT_RISK_RULES, validateSignal } from "@/modules/risk-engine/validate";
import { logAuditEvent } from "@/modules/audit/log";

const STORAGE_KEY = "ai-trading-demo-account-v1";
const SIGNAL_HISTORY_KEY = "ai-trading-signal-history-v1";
const MAX_SIGNAL_HISTORY = 200;

function loadPersisted(): { account: DemoAccount; positions: PaperPosition[]; closedTrades: ClosedTrade[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(account: DemoAccount, positions: PaperPosition[], closedTrades: ClosedTrade[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ account, positions, closedTrades }));
  } catch {
    // storage unavailable — state simply won't survive a reload this session
  }
}

// Signal lifecycle (spec section 87): every generated signal is appended, never overwritten.
function loadSignalHistory(): AiSignal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SIGNAL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendSignalHistory(signal: AiSignal) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSignalHistory();
    const updated = [...existing, signal].slice(-MAX_SIGNAL_HISTORY);
    window.localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // storage unavailable
  }
}

interface StoreState {
  account: DemoAccount;
  positions: PaperPosition[];
  closedTrades: ClosedTrade[];
  nifty?: SpotPrice;
  banknifty?: SpotPrice;
  chain: OptionChainRow[];
  chainAnalysis?: OptionChainAnalysis;
  aiSignal?: AiSignal;
  signalHistory: AiSignal[];
  toastMsg?: string;
  placeOrder: (instrument: Instrument, side: OrderSide, quantity: number, signal?: PaperPosition["signal"]) => void;
  closePos: (id: string) => void;
  regenSignal: () => void;
  tradeSignal: () => { instrument: Instrument; signal: PaperPosition["signal"] } | null;
  consumePendingSignal: () => PaperPosition["signal"] | undefined;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const persisted = typeof window !== "undefined" ? loadPersisted() : null;
  const [account, setAccount] = useState<DemoAccount>(() => persisted?.account ?? createDemoAccount("local-user", "local-account"));
  const [positions, setPositions] = useState<PaperPosition[]>(() => persisted?.positions ?? []);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(() => persisted?.closedTrades ?? []);
  const [nifty, setNifty] = useState<SpotPrice>();
  const [banknifty, setBanknifty] = useState<SpotPrice>();
  const [chain, setChain] = useState<OptionChainRow[]>([]);
  const [chainAnalysis, setChainAnalysis] = useState<OptionChainAnalysis>();
  const [aiSignal, setAiSignal] = useState<AiSignal>();
  const [signalHistory, setSignalHistory] = useState<AiSignal[]>(() => (typeof window !== "undefined" ? loadSignalHistory() : []));
  const [pendingSignal, setPendingSignal] = useState<PaperPosition["signal"]>();
  const [toastMsg, setToastMsg] = useState<string>();

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(undefined), 2600);
  }, []);

  const recordSignal = useCallback((signal: AiSignal) => {
    setAiSignal(signal);
    setSignalHistory((prev) => [...prev, signal].slice(-MAX_SIGNAL_HISTORY));
    appendSignalHistory(signal);
    logAuditEvent("AI_SIGNAL_GENERATED", { signal });
  }, []);

  // Persist to localStorage whenever the tradeable state changes.
  useEffect(() => {
    persist(account, positions, closedTrades);
  }, [account, positions, closedTrades]);

  // Poll the market-data API (active provider — mock today) every few seconds.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const [n, b] = await Promise.all([
          fetch("/api/market-data?underlying=NIFTY").then((r) => r.json()),
          fetch("/api/market-data?underlying=BANKNIFTY").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setNifty(n.spot);
        setBanknifty(b.spot);
        setChain(n.chain);
        const analysis = analyzeOptionChain(n.chain, n.spot.ltp);
        setChainAnalysis(analysis);
        if (!aiSignal) {
          recordSignal(generateSignal(n.spot, n.chain, analysis));
        }
      } catch {
        // Provider unavailable — do not fabricate data, just leave state as-is
        // and let the UI show its last-known/STALE state.
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate exit alerts whenever the chain refreshes.
  useEffect(() => {
    if (chain.length === 0) return;
    setPositions((prev) =>
      prev.map((p) => {
        const row = chain.find((r) => r.strike === p.instrument.strike && r.optionType === p.instrument.optionType);
        if (!row?.ltp) return p;
        const updated = evaluateExitAlert(p, row.ltp);
        if (updated.alertedTarget && !p.alertedTarget) {
          notify(`🎯 AI exit alert: target reached on ${p.instrument.strike}${p.instrument.optionType}.`);
          logAuditEvent("EXIT_ALERT", { positionId: p.id, kind: "TARGET", ltp: row.ltp, position: p });
        }
        if (updated.alertedStopLoss && !p.alertedStopLoss) {
          notify(`⛔ AI exit alert: stop-loss hit on ${p.instrument.strike}${p.instrument.optionType}.`);
          logAuditEvent("EXIT_ALERT", { positionId: p.id, kind: "STOP_LOSS", ltp: row.ltp, position: p });
        }
        return updated;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain]);

  const placeOrder = useCallback(
    (instrument: Instrument, side: OrderSide, quantity: number, signal?: PaperPosition["signal"]) => {
      const row = chain.find((r) => r.strike === instrument.strike && r.optionType === instrument.optionType);
      const marketLtp = row?.ltp ?? 100;
      const result = engineePlaceOrder({ account, instrument, side, quantity, marketLtp, signal });
      if (result.order.status === "REJECTED") {
        notify(`Order rejected: ${result.order.rejectionReason}`);
        logAuditEvent("ORDER_REJECTED", { order: result.order });
        return;
      }
      setAccount(result.updatedAccount);
      setPositions((prev) => [...prev, result.position!]);
      logAuditEvent("ORDER_PLACED", { order: result.order, position: result.position });
      notify(`Paper order filled: ${side} ${instrument.strike}${instrument.optionType} x${quantity} @ ₹${result.order.simulatedExecutionPrice.toFixed(2)}`);
    },
    [account, chain, notify]
  );

  const closePos = useCallback(
    (id: string) => {
      const pos = positions.find((p) => p.id === id);
      if (!pos) return;
      const row = chain.find((r) => r.strike === pos.instrument.strike && r.optionType === pos.instrument.optionType);
      const marketLtp = row?.ltp ?? pos.entryPrice;
      const { trade, updatedAccount } = engineClosePosition({ account, position: pos, marketLtp });
      setAccount(updatedAccount);
      setPositions((prev) => prev.filter((p) => p.id !== id));
      setClosedTrades((prev) => [...prev, trade]);
      logAuditEvent("POSITION_CLOSED", { trade });
      notify(`Closed ${pos.instrument.strike}${pos.instrument.optionType}: net P&L ₹${trade.netPnl.toFixed(2)}`);
    },
    [account, chain, positions, notify]
  );

  const regenSignal = useCallback(() => {
    if (!nifty || !chainAnalysis) return;
    recordSignal(generateSignal(nifty, chain, chainAnalysis));
  }, [nifty, chain, chainAnalysis, recordSignal]);

  const tradeSignal = useCallback((): { instrument: Instrument; signal: PaperPosition["signal"] } | null => {
    if (!aiSignal) return null;
    const check = validateSignal(aiSignal, account, 75, positions.length, DEFAULT_RISK_RULES);
    logAuditEvent("RISK_CHECK", { signal: aiSignal, approved: check.approved, reasons: check.reasons });
    if (!check.approved) {
      notify(`Risk check failed: ${check.reasons[0]}`);
      return null;
    }
    const signal: PaperPosition["signal"] = { signalId: aiSignal.id, bias: aiSignal.bias, confidence: aiSignal.confidence };
    setPendingSignal(signal);
    return {
      instrument: {
        underlying: aiSignal.underlying,
        expiry: chain[0]?.expiry ?? new Date().toISOString().slice(0, 10),
        strike: aiSignal.strike!,
        optionType: aiSignal.optionType!,
      },
      signal,
    };
  }, [aiSignal, account, positions, chain, notify]);

  const consumePendingSignal = useCallback(() => {
    const s = pendingSignal;
    setPendingSignal(undefined);
    return s;
  }, [pendingSignal]);

  const value = useMemo<StoreState>(
    () => ({
      account,
      positions,
      closedTrades,
      nifty,
      banknifty,
      chain,
      chainAnalysis,
      aiSignal,
      signalHistory,
      toastMsg,
      placeOrder,
      closePos,
      regenSignal,
      tradeSignal,
      consumePendingSignal,
    }),
    [account, positions, closedTrades, nifty, banknifty, chain, chainAnalysis, aiSignal, signalHistory, toastMsg, placeOrder, closePos, regenSignal, tradeSignal, consumePendingSignal]
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[78px] max-w-[90%] bg-[#1D2430] border border-line text-text text-xs px-4 py-2.5 rounded-xl z-20 text-center">
          {toastMsg}
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function unrealized(position: PaperPosition, ltp: number) {
  return unrealizedPnl(position, ltp);
}
