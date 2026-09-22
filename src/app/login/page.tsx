"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setError("No Supabase project connected yet. Add NEXT_PUBLIC_SUPABASE_URL / ANON_KEY to .env, then this form will work.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "login" ? "bg-signal text-[#181206]" : "bg-panel2 border border-line text-text"}`}
        >
          Log in
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "signup" ? "bg-signal text-[#181206]" : "bg-panel2 border border-line text-text"}`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[11px] text-sub block mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-sub block mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-panel2 border border-line text-text rounded-lg px-2.5 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="text-[12px] text-down bg-down/10 border border-down/30 rounded-lg px-2.5 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-signal text-[#181206] font-semibold text-sm rounded-lg py-3 disabled:opacity-60"
        >
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <div className="text-[10.5px] text-sub mt-3">
        Trading account access is separate from your broker login — this only signs you into the platform itself.
      </div>
    </div>
  );
}
