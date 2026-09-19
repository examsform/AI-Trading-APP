export interface ManualJournalEntry {
  id: string;
  underlying: "NIFTY" | "BANKNIFTY";
  strike: number;
  optionType: "CE" | "PE";
  side: "BUY" | "SELL";
  actualEntry: number;
  actualQuantity: number;
  actualExit?: number;
  actualStopLoss?: number;
  actualTarget?: number;
  actualPnl?: number;
  notes?: string;
  linkedSignalId?: string; // ties back to AiSignal.id, if this trade followed an AI plan
  createdAt: string;
  closedAt?: string;
}

const STORAGE_KEY = "ai-trading-manual-journal-v1";

export function listJournalEntries(): ManualJournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(entries: ManualJournalEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable
  }
}

export function addJournalEntry(input: Omit<ManualJournalEntry, "id" | "createdAt">): ManualJournalEntry {
  const entry: ManualJournalEntry = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  saveAll([...listJournalEntries(), entry]);
  return entry;
}

export function closeJournalEntry(id: string, actualExit: number, actualPnl: number): ManualJournalEntry[] {
  const updated = listJournalEntries().map((e) => (e.id === id ? { ...e, actualExit, actualPnl, closedAt: new Date().toISOString() } : e));
  saveAll(updated);
  return updated;
}

export function deleteJournalEntry(id: string): ManualJournalEntry[] {
  const updated = listJournalEntries().filter((e) => e.id !== id);
  saveAll(updated);
  return updated;
}
