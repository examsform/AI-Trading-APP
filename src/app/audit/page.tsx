"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuditEntry, clearAuditLog, readAuditLog } from "@/modules/audit/log";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    setEntries(readAuditLog().slice().reverse());
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/settings" className="text-[12px] text-sub">← Settings</Link>
        <button
          onClick={() => {
            clearAuditLog();
            setEntries([]);
          }}
          className="text-[11px] border border-line text-sub rounded px-2.5 py-1"
        >
          Clear log
        </button>
      </div>

      <div className="bg-panel border border-line rounded-xl p-3.5">
        <div className="text-[11px] text-sub mb-2">
          Audit trail ({entries.length}) · stored in this browser tab until Supabase's <code>audit_log</code> table is connected
        </div>
        {entries.length === 0 ? (
          <div className="text-center text-sub text-[12.5px] py-6">No events recorded yet — place a trade or generate a signal.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="border-b border-line py-2 last:border-b-0">
              <div className="flex justify-between text-[11.5px]">
                <span className="font-semibold">{e.type.replace(/_/g, " ")}</span>
                <span className="text-sub">{new Date(e.timestamp).toLocaleTimeString("en-IN", { hour12: false })}</span>
              </div>
              <pre className="text-[10px] text-sub mt-1 whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(e.data, null, 0).slice(0, 300)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
