import { describe, expect, it } from "vitest";
import { closePosition, createDemoAccount, placeOrder } from "./engine";

describe("paper trading engine — deterministic scenario", () => {
  it("places a BUY order at a known LTP and computes correct capital usage", () => {
    const account = createDemoAccount("user-1", "acc-1");
    expect(account.cash).toBe(1_000_000);

    const result = placeOrder({
      account,
      instrument: { underlying: "NIFTY", expiry: "2026-09-25", strike: 25000, optionType: "CE" },
      side: "BUY",
      quantity: 75,
      marketLtp: 185,
    });

    expect(result.order.status).toBe("FILLED");
    // exec price = 185 * 1.002 = 185.37
    expect(result.order.simulatedExecutionPrice).toBeCloseTo(185.37, 2);
    expect(result.position).not.toBeNull();
    expect(result.updatedAccount.usedMargin).toBeCloseTo(185.37 * 75, 2);
  });

  it("rejects an order that exceeds available virtual margin", () => {
    const account = createDemoAccount("user-1", "acc-1");
    const result = placeOrder({
      account,
      instrument: { underlying: "NIFTY", expiry: "2026-09-25", strike: 25000, optionType: "CE" },
      side: "BUY",
      quantity: 1_000_000, // absurd quantity to force rejection
      marketLtp: 185,
    });
    expect(result.order.status).toBe("REJECTED");
    expect(result.position).toBeNull();
    expect(result.updatedAccount.usedMargin).toBe(0);
  });

  it("closes a position and produces a deterministic net P&L", () => {
    const account = createDemoAccount("user-1", "acc-1");
    const opened = placeOrder({
      account,
      instrument: { underlying: "NIFTY", expiry: "2026-09-25", strike: 25000, optionType: "CE" },
      side: "BUY",
      quantity: 75,
      marketLtp: 185,
    });
    const closed = closePosition({
      account: opened.updatedAccount,
      position: opened.position!,
      marketLtp: 220, // market moved up
    });
    expect(closed.trade.exitPrice).toBeLessThan(220); // SELL-side slippage reduces exit price
    expect(closed.trade.netPnl).toBeGreaterThan(0); // should be a winning trade
    expect(closed.updatedAccount.usedMargin).toBeCloseTo(0, 2);
  });
});
