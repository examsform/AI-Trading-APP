import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "AI Trading Intelligence",
  description: "India-focused AI trading intelligence platform — paper trading with virtual capital.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">
        <StoreProvider>
          <div className="mx-auto max-w-[480px] min-h-screen flex flex-col pb-16">
            <header className="px-4 pt-4 pb-3 sticky top-0 bg-bg z-10 border-b border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-semibold">AI Trading Intelligence</h1>
                  <p className="text-[11px] text-sub mt-0.5">India · NIFTY / BANKNIFTY · Paper Trading</p>
                </div>
                <span className="text-[10px] border border-line text-sub rounded px-2 py-0.5">v0.1</span>
              </div>
              <div className="mt-2.5 bg-mockc/10 border border-mockc/35 text-mockc text-[11px] px-2.5 py-1.5 rounded-lg leading-relaxed">
                <b>MOCK/DEMO DATA.</b> No real market-data or broker connection is configured yet
                (MARKET_DATA_PROVIDER=mock). Every price and AI signal below is simulated.
              </div>
            </header>
            <main className="flex-1 px-4 py-4">{children}</main>
            <BottomNav />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
