export type DataQuality = "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE" | "MOCK";
export type Underlying = "NIFTY" | "BANKNIFTY";

export interface OptionChainRow {
  underlying: Underlying;
  expiry: string;
  strike: number;
  optionType: "CE" | "PE";
  ltp: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  oi: number | null;
  oiChange: number | null;
  iv: number | null;
  greeks: { delta?: number; gamma?: number; theta?: number; vega?: number } | null;
  timestamp: string;
  source: string;
  quality: DataQuality;
}

export interface SpotPrice {
  underlying: Underlying;
  ltp: number;
  change: number;
  changePct: number;
  timestamp: string;
  source: string;
  quality: DataQuality;
}

// Every adapter (AngelOneMarketDataProvider, MockAdapter, ...) implements this.
// No code outside this folder should ever import a vendor SDK directly.
export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "5m" | "15m" | "1d";

export interface MarketDataProvider {
  name: string;
  getSpotPrice(underlying: Underlying): Promise<SpotPrice>;
  getOptionChain(underlying: Underlying, expiry: string): Promise<OptionChainRow[]>;
  getAvailableExpiries(underlying: Underlying): Promise<string[]>;
  getHistoricalData(underlying: Underlying, timeframe: Timeframe, count: number): Promise<Candle[]>;
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
}
