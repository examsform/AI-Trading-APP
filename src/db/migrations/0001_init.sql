-- Core schema for the AI Trading Intelligence Platform (Phase 3)
-- Run this in the Supabase SQL editor, or via `supabase db push`, once a project is connected.

create extension if not exists "uuid-ossp";

-- ── Accounts ────────────────────────────────────────────────────────────────
create table demo_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  initial_capital numeric(14,2) not null default 1000000.00,
  cash numeric(14,2) not null default 1000000.00,
  used_margin numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ── Market data snapshots (for audit + backtesting) ────────────────────────
create table option_chain_snapshots (
  id uuid primary key default uuid_generate_v4(),
  underlying text not null check (underlying in ('NIFTY','BANKNIFTY')),
  expiry date not null,
  strike numeric(10,2) not null,
  option_type text not null check (option_type in ('CE','PE')),
  ltp numeric(10,2),
  bid numeric(10,2),
  ask numeric(10,2),
  volume bigint,
  oi bigint,
  oi_change bigint,
  iv numeric(6,2),
  greeks jsonb,
  source text not null,
  quality text not null check (quality in ('LIVE','DELAYED','STALE','UNAVAILABLE','MOCK')),
  captured_at timestamptz not null default now()
);
create index idx_chain_underlying_expiry_time on option_chain_snapshots (underlying, expiry, captured_at desc);

-- ── AI signals ──────────────────────────────────────────────────────────────
create table ai_signals (
  id uuid primary key default uuid_generate_v4(),
  underlying text not null,
  decision text not null check (decision in ('STRONG_TRADE_CANDIDATE','TRADE_CANDIDATE','WATCH','WAIT','NO_TRADE','INVALIDATED')),
  bias text not null check (bias in ('BULLISH','BEARISH','NEUTRAL')),
  confidence numeric(5,2),
  quality numeric(5,2),
  strike numeric(10,2),
  option_type text check (option_type in ('CE','PE')),
  entry numeric(10,2),
  confirmation text,
  stop_loss numeric(10,2),
  target1 numeric(10,2),
  target2 numeric(10,2),
  trailing_stop text,
  invalidation text,
  risk_reward numeric(6,2),
  expected_holding_period text,
  why_this_strike text,
  why_not_other text,
  supporting_factors text[],
  conflicting_factors text[],
  reasoning text,
  snapshot_id uuid references option_chain_snapshots(id),
  provider text not null default 'mock',
  created_at timestamptz not null default now()
);

-- Signal lifecycle (spec section 87): signals are never overwritten, only appended to.
-- Each row here is one lifecycle transition for a given signal id.
create table ai_signal_updates (
  id uuid primary key default uuid_generate_v4(),
  signal_id uuid not null references ai_signals(id),
  status text not null check (status in ('CREATED','WATCHING','CONFIRMED','ACTIVE','TARGET1','TARGET2','EXITED','INVALIDATED','CANCELLED','NO_TRADE')),
  note text,
  created_at timestamptz not null default now()
);

-- ── Manual trade journal (spec section 89-90) ──────────────────────────────
-- What the user actually executed manually on Angel One — separate from paper trading,
-- optionally linked back to the AI signal that inspired it, so AI plan vs actual execution
-- can be compared. Immutable once closed (spec section 88).
create table manual_trade_journal (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_signal_id uuid references ai_signals(id),
  underlying text not null,
  strike numeric(10,2) not null,
  option_type text not null check (option_type in ('CE','PE')),
  side text not null check (side in ('BUY','SELL')),
  actual_entry numeric(10,2) not null,
  actual_quantity integer not null,
  actual_exit numeric(10,2),
  actual_stop_loss numeric(10,2),
  actual_target numeric(10,2),
  actual_pnl numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ── Risk validation log ─────────────────────────────────────────────────────
create table risk_checks (
  id uuid primary key default uuid_generate_v4(),
  signal_id uuid references ai_signals(id),
  approved boolean not null,
  reasons text[],
  created_at timestamptz not null default now()
);

-- ── Orders / positions / trades ─────────────────────────────────────────────
create table paper_orders (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references demo_accounts(id) on delete cascade,
  underlying text not null,
  expiry date not null,
  strike numeric(10,2) not null,
  option_type text not null check (option_type in ('CE','PE')),
  side text not null check (side in ('BUY','SELL')),
  quantity integer not null,
  market_ltp_at_request numeric(10,2) not null,
  simulated_execution_price numeric(10,2) not null,
  charges numeric(10,2) not null,
  status text not null check (status in ('FILLED','REJECTED')),
  rejection_reason text,
  signal_id uuid references ai_signals(id),
  requested_at timestamptz not null default now()
);

create table paper_positions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references demo_accounts(id) on delete cascade,
  order_id uuid references paper_orders(id),
  underlying text not null,
  expiry date not null,
  strike numeric(10,2) not null,
  option_type text not null check (option_type in ('CE','PE')),
  side text not null check (side in ('BUY','SELL')),
  quantity integer not null,
  entry_price numeric(10,2) not null,
  entry_charges numeric(10,2) not null,
  target_price numeric(10,2),
  stop_loss_price numeric(10,2),
  alerted_target boolean not null default false,
  alerted_stop_loss boolean not null default false,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table closed_trades (
  id uuid primary key default uuid_generate_v4(),
  position_id uuid not null references paper_positions(id),
  account_id uuid not null references demo_accounts(id) on delete cascade,
  exit_price numeric(10,2) not null,
  exit_charges numeric(10,2) not null,
  gross_pnl numeric(12,2) not null,
  net_pnl numeric(12,2) not null,
  closed_at timestamptz not null default now()
);

-- ── Audit log ────────────────────────────────────────────────────────────────
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  event_type text not null,
  event_data jsonb,
  created_at timestamptz not null default now()
);

-- ── Row-level security ───────────────────────────────────────────────────────
alter table demo_accounts enable row level security;
alter table paper_orders enable row level security;
alter table paper_positions enable row level security;
alter table closed_trades enable row level security;
alter table manual_trade_journal enable row level security;

create policy "own demo account" on demo_accounts
  for all using (auth.uid() = user_id);

create policy "own orders" on paper_orders
  for all using (account_id in (select id from demo_accounts where user_id = auth.uid()));

create policy "own positions" on paper_positions
  for all using (account_id in (select id from demo_accounts where user_id = auth.uid()));

create policy "own trades" on closed_trades
  for all using (account_id in (select id from demo_accounts where user_id = auth.uid()));

create policy "own journal" on manual_trade_journal
  for all using (auth.uid() = user_id);
