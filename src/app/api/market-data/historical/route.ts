import { NextRequest, NextResponse } from "next/server";
import { getMarketDataProvider } from "@/modules/market-data";
import { parseUnderlying, parseTimeframe, parsePositiveInt, ValidationError } from "@/lib/validation";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`market-data-historical:${clientKeyFromRequest(req)}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  try {
    const underlying = parseUnderlying(req.nextUrl.searchParams.get("underlying") ?? "NIFTY");
    const timeframe = parseTimeframe(req.nextUrl.searchParams.get("timeframe"));
    const count = parsePositiveInt(req.nextUrl.searchParams.get("count"), 60, 500);
    const provider = getMarketDataProvider();

    const candles = await provider.getHistoricalData(underlying, timeframe, count);

    return NextResponse.json({ provider: provider.name, underlying, timeframe, candles });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("historical market-data route failed:", err);
    return NextResponse.json({ error: "Historical data temporarily unavailable" }, { status: 503 });
  }
}
