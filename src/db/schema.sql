-- ====================================================================
-- Personal AI Options Trading Intelligence — Supabase PostgreSQL Schema
-- Single-User Private Schema (No Multi-Tenant / No Public Signup)
-- ====================================================================

-- 1. AI Signals Table
CREATE TABLE IF NOT EXISTS public.signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision VARCHAR(50) NOT NULL,
    bias VARCHAR(20) NOT NULL,
    confidence INT NOT NULL,
    quality INT NOT NULL,
    underlying VARCHAR(20) NOT NULL,
    strike NUMERIC,
    option_type VARCHAR(5),
    entry NUMERIC,
    stop_loss NUMERIC,
    target1 NUMERIC,
    target2 NUMERIC,
    reasoning TEXT,
    supporting_factors JSONB DEFAULT '[]'::jsonb,
    conflicting_factors JSONB DEFAULT '[]'::jsonb,
    snapshot_ref VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Manual Trade Journal Table
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES public.signals(id) ON DELETE SET NULL,
    underlying VARCHAR(20) NOT NULL,
    strike NUMERIC NOT NULL,
    option_type VARCHAR(5) NOT NULL,
    action VARCHAR(10) NOT NULL, -- 'BUY' or 'SELL'
    quantity INT NOT NULL,
    executed_entry_price NUMERIC NOT NULL,
    executed_exit_price NUMERIC,
    status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'CANCELLED'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 3. Paper Trading Accounts Table
CREATE TABLE IF NOT EXISTS public.paper_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name VARCHAR(100) DEFAULT 'Main Paper Capital',
    initial_balance NUMERIC DEFAULT 1000000.00,
    current_balance NUMERIC DEFAULT 1000000.00,
    realized_pnl NUMERIC DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) policies for private single owner access
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Single Owner Access" ON public.signals FOR ALL USING (true);
CREATE POLICY "Single Owner Access" ON public.journal_entries FOR ALL USING (true);
CREATE POLICY "Single Owner Access" ON public.paper_accounts FOR ALL USING (true);
CREATE POLICY "Single Owner Access" ON public.audit_logs FOR ALL USING (true);
CREATE POLICY "Single Owner Access" ON public.user_settings FOR ALL USING (true);
