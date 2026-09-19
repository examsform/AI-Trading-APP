import { NextRequest, NextResponse } from "next/server";
import { getMarketDataProvider } from "@/modules/market-data";
import { parseUnderlying, ValidationError } from "@/lib/validation";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`market-data:${clientKeyFromRequest(req)}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  try {
    const underlying = parseUnderlying(req.nextUrl.searchParams.get("underlying") ?? "NIFTY");
    const provider = getMarketDataProvider();

    const spot = await provider.getSpotPrice(underlying);
    const expiries = await provider.getAvailableExpiries(underlying);
    const chain = await provider.getOptionChain(underlying, expiries[0]);

    return NextResponse.json({ provider: provider.name, spot, expiries, chain });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Never leak internal error details (stack traces, provider credentials, etc.) to the client.
    console.error("market-data route failed:", err);
    return NextResponse.json({ error: "Market data temporarily unavailable" }, { status: 503 });
  }
}
