export type MarketSessionState = "PRE_MARKET" | "REGULAR_MARKET" | "POST_MARKET" | "CLOSED";
export type DataFreshnessState = "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE" | "MOCK";

export interface MarketHoursInfo {
  session: MarketSessionState;
  isOpen: boolean;
  message: string;
  nextOpenOrClose: string;
}

export interface ReanalysisTriggerInput {
  lastAnalysisTimestamp: string;
  lastSpotLtp: number;
  currentSpotLtp: number;
  lastPcr: number;
  currentPcr: number;
  isSignalInvalidated?: boolean;
}

// Fixed NSE Holidays for 2026 reference (major national holidays)
const NSE_HOLIDAYS_2026 = [
  "2026-01-26", // Republic Day
  "2026-03-25", // Holi
  "2026-04-02", // Good Friday
  "2026-04-14", // Ambedkar Jayanti
  "2026-05-01", // Maharashtra Day
  "2026-08-15", // Independence Day
  "2026-10-02", // Gandhi Jayanti
  "2026-11-01", // Diwali / Laxmi Pujan (Mohurat trading exception handled in session)
  "2026-12-25", // Christmas
];

export function getMarketSessionInfo(dateOverride?: Date): MarketHoursInfo {
  const now = dateOverride ?? new Date();

  // Convert to Indian Standard Time (IST) offset +5:30
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 3600000;
  const istDate = new Date(utcMs + istOffset);

  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const dayOfWeek = istDate.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = NSE_HOLIDAYS_2026.includes(dateStr);

  if (isWeekend || isHoliday) {
    return {
      session: "CLOSED",
      isOpen: false,
      message: isHoliday ? "Market is closed today (NSE Holiday)" : "Market is closed for weekend",
      nextOpenOrClose: "Opens Monday at 09:15 AM IST",
    };
  }

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const preMarketStart = 9 * 60; // 09:00 AM
  const marketOpen = 9 * 60 + 15; // 09:15 AM
  const marketClose = 15 * 60 + 30; // 03:30 PM
  const postMarketEnd = 16 * 60; // 04:00 PM

  if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    return {
      session: "PRE_MARKET",
      isOpen: false,
      message: "Pre-market session in progress (09:00 - 09:15 AM)",
      nextOpenOrClose: "Regular session opens at 09:15 AM IST",
    };
  }

  if (timeInMinutes >= marketOpen && timeInMinutes <= marketClose) {
    return {
      session: "REGULAR_MARKET",
      isOpen: true,
      message: "Regular Market session LIVE (09:15 AM - 03:30 PM IST)",
      nextOpenOrClose: "Closes at 03:30 PM IST",
    };
  }

  if (timeInMinutes > marketClose && timeInMinutes <= postMarketEnd) {
    return {
      session: "POST_MARKET",
      isOpen: false,
      message: "Post-market closing session (03:30 - 04:00 PM IST)",
      nextOpenOrClose: "Session ended. Market opens next trading day at 09:15 AM IST",
    };
  }

  return {
    session: "CLOSED",
    isOpen: false,
    message: "Market is closed",
    nextOpenOrClose: "Opens next trading day at 09:15 AM IST",
  };
}

export function evaluateDataFreshness(lastTickTimestamp: string, providerType: "MOCK" | "REAL"): DataFreshnessState {
  if (providerType === "MOCK") return "MOCK";

  const ageMs = Date.now() - new Date(lastTickTimestamp).getTime();

  if (isNaN(ageMs) || ageMs > 60000) return "UNAVAILABLE";
  if (ageMs > 15000) return "STALE";
  if (ageMs > 5000) return "DELAYED";
  return "LIVE";
}

export function shouldReanalyze(input: ReanalysisTriggerInput): { trigger: boolean; reason: string } {
  const lastTime = new Date(input.lastAnalysisTimestamp).getTime();
  const now = Date.now();
  const elapsedSec = (now - lastTime) / 1000;

  // Minimum 15-second debounce guard (spec section 68)
  if (elapsedSec < 15) {
    return { trigger: false, reason: "Debounce guard: less than 15s since last AI analysis" };
  }

  if (input.isSignalInvalidated) {
    return { trigger: true, reason: "Existing signal invalidated" };
  }

  // Spot price movement > 0.5%
  const spotChangePct = Math.abs((input.currentSpotLtp - input.lastSpotLtp) / input.lastSpotLtp) * 100;
  if (spotChangePct >= 0.5) {
    return { trigger: true, reason: `Significant spot move (${spotChangePct.toFixed(2)}%)` };
  }

  // Major PCR shift >= 0.15
  const pcrShift = Math.abs(input.currentPcr - input.lastPcr);
  if (pcrShift >= 0.15) {
    return { trigger: true, reason: `Significant PCR shift (${pcrShift.toFixed(2)})` };
  }

  return { trigger: false, reason: "No re-analysis trigger thresholds breached" };
}
