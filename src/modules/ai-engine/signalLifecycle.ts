import { AiSignal } from "./mockSignalEngine";

export type SignalLifecycleState =
  | "CREATED"
  | "WATCHING"
  | "CONFIRMED"
  | "ACTIVE"
  | "TARGET1_HIT"
  | "TARGET2_HIT"
  | "STOP_LOSS_HIT"
  | "INVALIDATED"
  | "EXPIRED";

export interface SignalLifecycleRecord {
  signalId: string;
  signal: AiSignal;
  currentState: SignalLifecycleState;
  history: {
    state: SignalLifecycleState;
    timestamp: string;
    reason: string;
    priceAtTransition?: number;
  }[];
  createdAt: string;
  updatedAt: string;
  entryPriceActual?: number;
  exitPriceActual?: number;
}

export function createLifecycleRecord(signal: AiSignal): SignalLifecycleRecord {
  const now = new Date().toISOString();
  const initialState: SignalLifecycleState =
    signal.decision === "NO_TRADE" || signal.decision === "INVALIDATED"
      ? "INVALIDATED"
      : signal.decision === "WAIT"
      ? "EXPIRED"
      : "CREATED";

  return {
    signalId: signal.id,
    signal,
    currentState: initialState,
    history: [
      {
        state: initialState,
        timestamp: now,
        reason: `Signal initialized with decision ${signal.decision}`,
        priceAtTransition: signal.entry,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function evaluateLifecycleUpdate(
  record: SignalLifecycleRecord,
  currentOptionLtp: number,
  underlyingLtp: number
): { record: SignalLifecycleRecord; stateChanged: boolean } {
  const { signal, currentState } = record;

  // Terminal states cannot transition further
  if (
    currentState === "TARGET2_HIT" ||
    currentState === "STOP_LOSS_HIT" ||
    currentState === "INVALIDATED" ||
    currentState === "EXPIRED"
  ) {
    return { record, stateChanged: false };
  }

  const now = new Date().toISOString();
  let nextState: SignalLifecycleState = currentState;
  let reason = "";

  // Target and SL evaluation if option pricing is present
  if (signal.entry && signal.stopLoss && signal.target1) {
    // Check stop loss first (highest priority)
    if (currentOptionLtp <= signal.stopLoss) {
      nextState = "STOP_LOSS_HIT";
      reason = `Option price (${currentOptionLtp}) hit or fell below Stop Loss (${signal.stopLoss})`;
    } else if (signal.target2 && currentOptionLtp >= signal.target2) {
      nextState = "TARGET2_HIT";
      reason = `Option price (${currentOptionLtp}) hit Target 2 (${signal.target2})`;
    } else if (currentOptionLtp >= signal.target1 && currentState !== "TARGET1_HIT") {
      nextState = "TARGET1_HIT";
      reason = `Option price (${currentOptionLtp}) hit Target 1 (${signal.target1})`;
    } else if (currentState === "CREATED") {
      // Transition from CREATED to WATCHING or CONFIRMED
      if (Math.abs(currentOptionLtp - signal.entry) / signal.entry <= 0.03) {
        nextState = "CONFIRMED";
        reason = `Option price (${currentOptionLtp}) within entry range (${signal.entry})`;
      } else {
        nextState = "WATCHING";
        reason = `Monitoring price action near entry (${signal.entry})`;
      }
    } else if (currentState === "CONFIRMED" || currentState === "WATCHING") {
      if (Math.abs(currentOptionLtp - signal.entry) / signal.entry <= 0.015) {
        nextState = "ACTIVE";
        reason = `Trade active at entry level (${signal.entry})`;
      }
    }
  }

  if (nextState !== currentState) {
    const updatedRecord: SignalLifecycleRecord = {
      ...record,
      currentState: nextState,
      updatedAt: now,
      history: [
        ...record.history,
        {
          state: nextState,
          timestamp: now,
          reason,
          priceAtTransition: currentOptionLtp,
        },
      ],
    };

    if (nextState === "ACTIVE" && !updatedRecord.entryPriceActual) {
      updatedRecord.entryPriceActual = currentOptionLtp;
    }
    if (
      ((nextState as string) === "TARGET1_HIT" ||
        (nextState as string) === "TARGET2_HIT" ||
        (nextState as string) === "STOP_LOSS_HIT" ||
        (nextState as string) === "INVALIDATED") &&
      !updatedRecord.exitPriceActual
    ) {
      updatedRecord.exitPriceActual = currentOptionLtp;
    }

    return { record: updatedRecord, stateChanged: true };
  }

  return { record, stateChanged: false };
}
