export type OptionType = "CE" | "PE";
export type OrderSide = "BUY" | "SELL";
export type Underlying = "NIFTY" | "BANKNIFTY";

export interface ExecutionConfig {
  slippagePct: number; // e.g. 0.002 = 0.2%
  brokeragePct: number; // simulated brokerage+taxes as % of notional
  minCharges: number; // minimum charge floor in INR
}

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  slippagePct: 0.002,
  brokeragePct: 0.0006,
  minCharges: 20,
};

export interface Instrument {
  underlying: Underlying;
  expiry: string; // ISO date
  strike: number;
  optionType: OptionType;
}

export interface DemoAccount {
  id: string;
  userId: string;
  initialCapital: number; // locked default: 1_000_000
  cash: number;
  usedMargin: number;
}

export interface SignalLink {
  signalId: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number; // 0-100, as reported at signal time
}

export interface PaperOrder {
  id: string;
  accountId: string;
  instrument: Instrument;
  side: OrderSide;
  quantity: number;
  requestedAt: string;
  marketLtpAtRequest: number; // real/mock market LTP at time of request
  simulatedExecutionPrice: number; // MUST stay separate from market LTP (spec section 8)
  charges: number;
  status: "FILLED" | "REJECTED";
  rejectionReason?: string;
  signal?: SignalLink; // present only if this order originated from an AI signal
}

export interface PaperPosition {
  id: string;
  accountId: string;
  instrument: Instrument;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  entryCharges: number;
  openedAt: string;
  targetPrice: number;
  stopLossPrice: number;
  alertedTarget: boolean;
  alertedStopLoss: boolean;
  signal?: SignalLink;
}

export interface ClosedTrade extends PaperPosition {
  exitPrice: number;
  exitCharges: number;
  closedAt: string;
  grossPnl: number;
  netPnl: number;
}
