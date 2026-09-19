import { MarketDataProvider } from "./providers/MarketDataProvider";
import { MockMarketDataAdapter } from "./providers/MockAdapter";
import { AngelOneMarketDataProvider } from "./providers/AngelOneMarketDataProvider";

/**
 * Active provider is chosen by MARKET_DATA_PROVIDER env var.
 * Personal V1 only targets Angel One (spec section 2).
 */
export function getMarketDataProvider(): MarketDataProvider {
  const configured = process.env.MARKET_DATA_PROVIDER ?? "mock";

  switch (configured) {
    case "mock":
      return new MockMarketDataAdapter();
    case "angelone":
      return new AngelOneMarketDataProvider();
    default:
      console.warn(`Unknown MARKET_DATA_PROVIDER "${configured}", falling back to mock.`);
      return new MockMarketDataAdapter();
  }
}
