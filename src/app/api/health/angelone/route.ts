import { NextResponse } from "next/server";
import { AngelOneMarketDataProvider } from "@/modules/market-data/providers/AngelOneMarketDataProvider";

export async function GET() {
  try {
    const provider = new AngelOneMarketDataProvider();
    const status = await provider.healthCheck();

    return NextResponse.json({
      connected: status.ok,
      message: status.message || (status.ok ? "Connected to Angel One SmartAPI" : "Not connected"),
      provider: "angelone",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        connected: false,
        message: errMessage,
        provider: "angelone",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
