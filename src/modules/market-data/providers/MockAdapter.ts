import { Candle, MarketDataProvider, OptionChainRow, SpotPrice, Timeframe, Underlying } from "./MarketDataProvider";

/**
 * MOCK PROVIDER — for local UI development and tests ONLY.
 * Per the platform's "No Fake Data" rule, this must never be the active provider
 * in production, and every value it returns is tagged quality: "MOCK" so the UI
 * can show clear MOCK/DEMO badges instead of pretending this is real market data.
 */
export class MockMarketDataAdapter implements MarketDataProvider {
  name = "mock";
  private niftySpot = 24812.35;
  private bnSpot = 51204.8;

  async getSpotPrice(underlying: Underlying): Promise<SpotPrice> {
    const isNifty = underlying === "NIFTY";
    const base = isNifty ? this.niftySpot : this.bnSpot;
    const drift = (Math.random() - 0.5) * (isNifty ? 8 : 22);
    const ltp = round2(base + drift);
    if (isNifty) this.niftySpot = ltp;
    else this.bnSpot = ltp;

    return {
      underlying,
      ltp,
      change: round2(drift),
      changePct: round2((drift / base) * 100),
      timestamp: new Date().toISOString(),
      source: "mock",
      quality: "MOCK",
    };
  }

  async getAvailableExpiries(_underlying: Underlying): Promise<string[]> {
    return [nextThursdayISO()];
  }

  // Deterministic-ish mock OHLC series — a real adapter must source this from
  // an authorized historical-data feed, never fabricate it for actual analysis.
  async getHistoricalData(underlying: Underlying, timeframe: Timeframe, count: number): Promise<Candle[]> {
    const base = underlying === "NIFTY" ? this.niftySpot : this.bnSpot;
    const stepMs = timeframe === "5m" ? 5 * 60_000 : timeframe === "15m" ? 15 * 60_000 : 24 * 60 * 60_000;
    const candles: Candle[] = [];
    let price = base - (Math.random() - 0.5) * base * 0.02;
    const now = Date.now();

    for (let i = count; i > 0; i--) {
      const open = price;
      const drift = (Math.random() - 0.5) * base * 0.004;
      const close = Math.max(1, open + drift);
      const high = Math.max(open, close) + Math.random() * base * 0.0015;
      const low = Math.min(open, close) - Math.random() * base * 0.0015;
      candles.push({
        timestamp: new Date(now - i * stepMs).toISOString(),
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume: Math.round(100_000 + Math.random() * 400_000),
      });
      price = close;
    }
    return candles;
  }

  async getOptionChain(underlying: Underlying, expiry: string): Promise<OptionChainRow[]> {
    const spot = underlying === "NIFTY" ? this.niftySpot : this.bnSpot;
    const step = underlying === "NIFTY" ? 50 : 100;
    const atm = Math.round(spot / step) * step;
    const rows: OptionChainRow[] = [];
    const timestamp = new Date().toISOString();

    for (let i = -4; i <= 4; i++) {
      const strike = atm + i * step;
      const dist = Math.abs(strike - spot);
      for (const optionType of ["CE", "PE"] as const) {
        const intrinsic = optionType === "CE" ? spot - strike : strike - spot;
        const ltp = Math.max(2, round2(intrinsic + 120 - dist * 0.35 + (Math.random() * 6 - 3)));
        rows.push({
          underlying,
          expiry,
          strike,
          optionType,
          ltp,
          bid: round2(ltp - 1),
          ask: round2(ltp + 1),
          volume: Math.round(50_000 + Math.random() * 200_000),
          oi: Math.round(20_000 + Math.random() * 80_000),
          oiChange: Math.round((Math.random() - 0.5) * 20_000),
          iv: round2(12 + Math.random() * 10),
          greeks: null, // mock adapter does not fabricate Greeks; a real provider must supply or validly derive them
          timestamp,
          source: "mock",
          quality: "MOCK",
        });
      }
    }
    return rows;
  }

  async healthCheck() {
    return { ok: true, message: "Mock adapter always reports healthy — not a real data source." };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nextThursdayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilThu = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilThu);
  return d.toISOString().slice(0, 10);
}
