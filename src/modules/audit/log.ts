export type AuditEventType =
  | "AI_SIGNAL_GENERATED"
  | "RISK_CHECK"
  | "ORDER_PLACED"
  | "ORDER_REJECTED"
  | "POSITION_CLOSED"
  | "EXIT_ALERT";

export interface AuditEntry {
  id: string;
  type: AuditEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

const STORAGE_KEY = "ai-trading-audit-log-v1";
const MAX_ENTRIES = 500; // keep the browser-side log bounded until a real DB table takes over

export function logAuditEvent(type: AuditEventType, data: Record<string, unknown>): AuditEntry {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const existing = readAuditLog();
      const updated = [...existing, entry].slice(-MAX_ENTRIES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // localStorage unavailable (e.g. private mode) — audit entry is still returned to the caller
    }
  }

  return entry;
}

export function readAuditLog(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearAuditLog(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// NOTE: once Supabase is connected, replace the localStorage read/write above with
// inserts/selects against the `audit_log` table (see src/db/migrations/0001_init.sql).
// The function signatures here are designed to stay the same so callers don't change.
