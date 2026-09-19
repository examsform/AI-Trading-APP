import { Timeframe, Underlying } from "@/modules/market-data/providers/MarketDataProvider";

const VALID_UNDERLYINGS: Underlying[] = ["NIFTY", "BANKNIFTY"];
const VALID_TIMEFRAMES: Timeframe[] = ["5m", "15m", "1d"];

export class ValidationError extends Error {}

export function parseUnderlying(value: string | null): Underlying {
  if (!value || !VALID_UNDERLYINGS.includes(value as Underlying)) {
    throw new ValidationError(`Invalid underlying "${value}". Must be one of: ${VALID_UNDERLYINGS.join(", ")}`);
  }
  return value as Underlying;
}

export function parseTimeframe(value: string | null): Timeframe {
  if (!value) return "5m";
  if (!VALID_TIMEFRAMES.includes(value as Timeframe)) {
    throw new ValidationError(`Invalid timeframe "${value}". Must be one of: ${VALID_TIMEFRAMES.join(", ")}`);
  }
  return value as Timeframe;
}

export function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) throw new ValidationError(`Invalid numeric value "${value}".`);
  return Math.min(n, max);
}
