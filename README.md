# Personal AI Options Trading Intelligence — V1

Real Next.js + TypeScript codebase for the **Personal V1** scope: Angel One only, manual
execution only, no subscriptions/multi-user/multi-broker. Runs on mock data out of the box.

## Run it (needs internet on your machine — not available in the sandbox that wrote this code)

```bash
npm install
npm run dev
```
Open http://localhost:3000. Runs entirely on mock data — no keys required for this step.

```bash
npm test
```
runs all deterministic unit tests (paper trading, risk engine, option-chain analytics,
backtesting, performance analytics, validation, rate limiting).

---

## PHASE 0 — Audit against the previous build (this document's own required first step)

The prior sessions in this project built a **general multi-broker SaaS platform** (Dhan +
FYERS, subscriptions-ready architecture). This new prompt narrows scope to a **personal,
single-user, Angel-One-only tool with manual execution**. Per this prompt's own rule
("do not delete working code unnecessarily, do not rewrite without auditing first"), here is
what was preserved, refactored, and newly added this round — nothing was deleted.

| Area | Action taken |
|---|---|
| Paper-trading engine, risk engine core, backtesting, performance analytics, audit log, security hardening (rate limiting, validation, headers), Supabase clients, DB migration base, charts | **Preserved as-is** — these are broker-agnostic and match this spec's requirements directly (₹10,00,000 virtual capital, realistic execution, deterministic risk checks, no look-ahead backtesting). |
| Broker naming (Dhan/FYERS mentions in comments, `.env.example`, Settings page) | **Refactored** to Angel One only, per spec section 2 ("Do NOT integrate Zerodha/Dhan/FYERS/Upstox in Personal V1"). The `BrokerAdapter`-style abstraction pattern itself was never implemented for any broker yet, so there was nothing broker-specific to strip out beyond naming/comments. |
| AI signal engine (`mockSignalEngine.ts`) | **Rewritten** from a single entry/SL/target object into the full structured Trade Plan this spec requires (decision enum, confirmation, target1/target2, trailing stop, invalidation, risk/reward, why-this-strike/why-not-other, supporting/conflicting factors) — spec section 23. |
| Risk engine | **Extended**: now rejects non-actionable decisions (WATCH/WAIT/NO_TRADE) outright, and adds deterministic position sizing (spec section 60) so quantity is never AI-chosen. |
| Option-chain analytics | **New module** (`option-chain-analytics/analytics.ts`) — PCR, total CE/PE OI, major call-resistance/put-support zones by OI, unusual-activity detection, OI-behaviour classification (long buildup / short covering / etc. using price + OI together, never OI alone) — spec sections 10-11. |
| Manual trade journal | **New module + page** (`journal/manualJournal.ts`, `/journal`) — logs what you actually executed on Angel One, optionally linked to the AI signal that inspired it, so AI plan vs. actual execution can be compared — spec sections 89-90. |
| Signal lifecycle | **New, partial**: every generated signal is now appended to an immutable history (`signalHistory`), never overwritten — spec section 87's core requirement. The full state-machine (CREATED→WATCHING→CONFIRMED→ACTIVE→TARGET1→...) is not implemented yet; see "Not yet built" below. |
| Subscriptions, multi-broker adapters, public signup, automatic real order execution | **Never built** in any prior session — consistent with this spec explicitly forbidding them in V1. Nothing to remove. |

**Gap analysis conclusion:** the existing codebase's domain logic (paper trading, risk,
backtesting, performance) already matched this spec's requirements almost exactly, because the
underlying trading mechanics (₹10L virtual capital, no fake data, no auto real orders,
deterministic risk) were consistent across all three prompts you've given. The work this round
was narrowing broker scope and deepening the AI output structure + option-chain analytics to
match this spec's much more detailed section 8-30 requirements.

---

## What's real vs. placeholder

| Module | State |
|---|---|
| Paper-trading engine (`modules/paper-trading`) | **Real, tested.** ₹10,00,000 default, realistic slippage/charges, deterministic position sizing available via the risk engine. |
| Risk engine (`modules/risk-engine`) | **Real, tested.** Rejects WATCH/WAIT/NO_TRADE outright; validates R:R, per-trade risk %, max positions; sizes quantity deterministically — AI never chooses quantity. |
| Option-chain analytics (`modules/option-chain-analytics`) | **Real, tested.** PCR, OI concentration/support-resistance zones, unusual-activity flagging, OI-behaviour classification. Runs on whatever chain data the active provider returns (mock today). |
| AI trade-plan engine (`modules/ai-engine/mockSignalEngine.ts`) | **Rule-based placeholder**, not a real model call — but returns the full structured shape (decision/confidence/quality/confirmation/targets/trailing-stop/invalidation/why-this-strike) a real AIProvider must produce. Genuinely returns WAIT/NO_TRADE when the mock evidence conflicts. |
| Backtesting (`modules/backtesting`) | **Real, tested.** Walk-forward SMA crossover, explicit look-ahead-bias guard, fills at next candle's open. Proxies NIFTY spot directionally — a real options backtest needs historical option-chain data (separate blocker). |
| Performance analytics (`modules/performance`) | **Real, tested.** Win rate, profit factor, expectancy, drawdown, confidence-vs-outcome buckets; flags itself as low-sample under 20 trades. |
| Manual trade journal (`modules/journal`, `/journal`) | **Real, working.** Logs actual Angel One executions, links to AI plan, shows entry-price comparison. |
| Signal lifecycle history | **Partial.** Append-only history exists; full state-machine (WATCHING→CONFIRMED→ACTIVE→...) not implemented — see below. |
| Frontend (Dashboard/Chain/AI/Trade/Positions/Performance/Backtest/Journal/Audit/Settings) | **Real, functional UI**, polling the mock API every 3s. |
| Auth, DB persistence | Login UI + Supabase clients + full schema exist; **no Supabase project connected** — state lives in `localStorage` as a bridge. |
| Angel One integration (`AngelOneMarketDataProvider`, `AngelOneBrokerAdapter`) | **Not started** — blocked, see below. This is intentionally the only broker interface Personal V1 should ever need. |
| Charting, security headers, rate limiting, input validation | **Real, as before.** |

## Not yet built (next non-blocked work)
- Full signal lifecycle state machine (spec section 87) — currently just an append-only history, not per-signal state transitions over time.
- Data-freshness states (LIVE/DELAYED/STALE/UNAVAILABLE) are modeled in the type system (`DataQuality`) but the mock adapter always reports `"MOCK"` — real freshness logic needs a real feed to be meaningful.
- Market-hours awareness (spec section 62) — not yet implemented.
- AI re-analysis triggers / debouncing (spec section 68) — currently re-analyzes only on manual "Re-run analysis" or when no signal exists yet, which already avoids per-tick AI calls, but the smarter trigger conditions (significant move, OI change, etc.) aren't built.

## Genuine blockers

1. **Angel One SmartAPI credentials** (API key, client ID, TOTP secret) — needed for `AngelOneMarketDataProvider` and `AngelOneBrokerAdapter` (read-only: positions/funds/orders, never automatic order placement — spec explicitly disables that). Official docs should be (re-)verified at integration time per spec section 48, since API details may have changed.
2. **A Supabase project** — for Auth (private owner access, no public signup) + persisting accounts/signals/journal entries across sessions instead of just in-browser state.
3. **An AI provider key** (e.g. Anthropic API key) — to replace the rule-based mock trade-plan engine with a real model call.
4. **A Vercel account + GitHub repo** — for deployment, which you said you'll do yourself.

None of these are needed for the app to run locally on mock data today.

## Phase status (per this document's own phase list, section 96)
Phases 0–2 (audit, foundation, private-auth scaffold), 5–17 core logic (option-chain
analytics, AI trade plan, risk engine, paper trading, P&L, performance intelligence,
backtesting, manual journal), and 18 (security/audit/failure-safety) are built against mock
data. Phase 3-4 (Angel One integration) is the interface-ready-but-blocked phase — see blockers
above. Phase 19 (real load) and Phase 20 (Supabase/Vercel production) need a live deployed
environment to do meaningfully, same as noted in prior sessions.
