import {
  ClosedTrade,
  DEFAULT_EXECUTION_CONFIG,
  DemoAccount,
  ExecutionConfig,
  Instrument,
  OrderSide,
  PaperOrder,
  PaperPosition,
  SignalLink,
} from "./types";

export { DEFAULT_EXECUTION_CONFIG };

// Locked requirement: default demo capital is exactly ₹10,00,000.
// Configurable later via account settings — never change the default silently.
export const DEFAULT_DEMO_CAPITAL = 1_000_000;

export function createDemoAccount(userId: string, id: string): DemoAccount {
  return {
    id,
    userId,
    initialCapital: DEFAULT_DEMO_CAPITAL,
    cash: DEFAULT_DEMO_CAPITAL,
    usedMargin: 0,
  };
}

/**
 * Simulated execution price MUST stay distinct from real market LTP (spec section 8).
 * This is the only place slippage is applied.
 */
export function simulateExecutionPrice(
  marketLtp: number,
  side: OrderSide,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG
): number {
  const direction = side === "BUY" ? 1 : -1;
  const slippage = marketLtp * config.slippagePct * direction;
  return round2(marketLtp + slippage);
}

export function simulateCharges(
  execPrice: number,
  quantity: number,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG
): number {
  const notional = execPrice * quantity;
  return Math.max(config.minCharges, round2(notional * config.brokeragePct));
}

export interface PlaceOrderInput {
  account: DemoAccount;
  instrument: Instrument;
  side: OrderSide;
  quantity: number;
  marketLtp: number; // must come from a real/authorized market-data source, not invented
  config?: ExecutionConfig;
  targetPct?: number; // default +40% for BUY, -35% (i.e. lower) for SELL
  stopLossPct?: number;
  signal?: SignalLink; // set only when this order originates from an AI signal
}

export interface PlaceOrderResult {
  order: PaperOrder;
  position: PaperPosition | null;
  updatedAccount: DemoAccount;
}

/**
 * Places a paper order against real/authorized market data. Never places a real broker order.
 * Rejects (does not silently clamp) when virtual margin is insufficient.
 */
export function placeOrder(input: PlaceOrderInput): PlaceOrderResult {
  const config = input.config ?? DEFAULT_EXECUTION_CONFIG;
  const execPrice = simulateExecutionPrice(input.marketLtp, input.side, config);
  const notional = execPrice * input.quantity;
  const charges = simulateCharges(execPrice, input.quantity, config);
  const available = input.account.cash - input.account.usedMargin;

  const baseOrder: Omit<PaperOrder, "status" | "rejectionReason"> = {
    id: crypto.randomUUID(),
    accountId: input.account.id,
    instrument: input.instrument,
    side: input.side,
    quantity: input.quantity,
    requestedAt: new Date().toISOString(),
    marketLtpAtRequest: input.marketLtp,
    simulatedExecutionPrice: execPrice,
    charges,
  };

  if (notional + charges > available) {
    return {
      order: { ...baseOrder, status: "REJECTED", rejectionReason: "INSUFFICIENT_VIRTUAL_MARGIN", signal: input.signal },
      position: null,
      updatedAccount: input.account,
    };
  }

  const targetPct = input.targetPct ?? 0.4;
  const stopLossPct = input.stopLossPct ?? 0.35;
  const buyLike = input.side === "BUY";

  const position: PaperPosition = {
    id: crypto.randomUUID(),
    accountId: input.account.id,
    instrument: input.instrument,
    side: input.side,
    quantity: input.quantity,
    entryPrice: execPrice,
    entryCharges: charges,
    openedAt: baseOrder.requestedAt,
    targetPrice: round2(buyLike ? execPrice * (1 + targetPct) : execPrice * (1 - targetPct)),
    stopLossPrice: round2(buyLike ? execPrice * (1 - stopLossPct) : execPrice * (1 + stopLossPct)),
    alertedTarget: false,
    alertedStopLoss: false,
    signal: input.signal,
  };

  const updatedAccount: DemoAccount = {
    ...input.account,
    usedMargin: input.account.usedMargin + notional,
  };

  return {
    order: { ...baseOrder, status: "FILLED", signal: input.signal },
    position,
    updatedAccount,
  };
}

export interface ClosePositionInput {
  account: DemoAccount;
  position: PaperPosition;
  marketLtp: number;
  config?: ExecutionConfig;
}

export interface ClosePositionResult {
  trade: ClosedTrade;
  updatedAccount: DemoAccount;
}

export function closePosition(input: ClosePositionInput): ClosePositionResult {
  const config = input.config ?? DEFAULT_EXECUTION_CONFIG;
  const exitSide: OrderSide = input.position.side === "BUY" ? "SELL" : "BUY";
  const execExit = simulateExecutionPrice(input.marketLtp, exitSide, config);
  const exitCharges = simulateCharges(execExit, input.position.quantity, config);

  const direction = input.position.side === "BUY" ? 1 : -1;
  const grossPnl = round2((execExit - input.position.entryPrice) * input.position.quantity * direction);
  const netPnl = round2(grossPnl - input.position.entryCharges - exitCharges);

  const entryNotional = input.position.entryPrice * input.position.quantity;

  const updatedAccount: DemoAccount = {
    ...input.account,
    usedMargin: round2(input.account.usedMargin - entryNotional),
    cash: round2(input.account.cash + netPnl),
  };

  const trade: ClosedTrade = {
    ...input.position,
    exitPrice: execExit,
    exitCharges,
    closedAt: new Date().toISOString(),
    grossPnl,
    netPnl,
  };

  return { trade, updatedAccount };
}

/**
 * Evaluates open positions against their stored target/stop-loss for exit alerts.
 * Never auto-closes — this only flags; a human (or later, an authorized automation rule)
 * decides to actually exit. Matches spec section 11: AI signal ≠ automatic trade.
 */
export function evaluateExitAlert(position: PaperPosition, currentLtp: number): PaperPosition {
  if (position.alertedTarget || position.alertedStopLoss) return position;
  const hitTarget = position.side === "BUY" ? currentLtp >= position.targetPrice : currentLtp <= position.targetPrice;
  const hitStop = position.side === "BUY" ? currentLtp <= position.stopLossPrice : currentLtp >= position.stopLossPrice;
  if (hitTarget) return { ...position, alertedTarget: true };
  if (hitStop) return { ...position, alertedStopLoss: true };
  return position;
}

export function unrealizedPnl(position: PaperPosition, currentLtp: number): number {
  const direction = position.side === "BUY" ? 1 : -1;
  return round2((currentLtp - position.entryPrice) * position.quantity * direction - position.entryCharges);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
