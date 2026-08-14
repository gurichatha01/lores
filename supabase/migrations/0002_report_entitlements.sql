-- LORES · Brief 2 follow-up · durable report entitlements (serverless-safe)
-- Run in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- Safe to re-run.
--
-- WHY: report unlock state used to live in server memory. On Vercel, different
-- requests hit different instances, so a report generated on one instance was
-- invisible to the order/verify/spend call on another. These two tables move
-- that state into Postgres so every instance sees the same thing.
--
-- PRIVACY: we deliberately store only a REFERENCE — the report id and whether
-- it's unlocked. The report CONTENT (which quotes real chat messages) never
-- leaves the browser, keeping the "never your chats, never your reports" claim
-- honest.

-- 1. Report references: existence + authorization only. No content.
create table if not exists public.reports (
  id          text primary key,
  authorized  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Order → what it unlocks. Single orders bind to one report; pack orders
--    carry the credit sizing so /api/verify can write the unclaimed pack row.
create table if not exists public.report_orders (
  order_id     text primary key,
  product_type text        not null check (product_type in ('single', 'pack10')),
  report_id    text        references public.reports (id) on delete cascade,  -- single only
  amount       integer,                                                        -- pack only
  credits      integer,                                                        -- pack only
  created_at   timestamptz not null default now()
);

create index if not exists report_orders_report_id_idx on public.report_orders (report_id);

-- 3. Lock both tables to the service role only (RLS on, no policies). The
--    browser never reads or writes entitlement state.
alter table public.reports        enable row level security;
alter table public.report_orders  enable row level security;
revoke all on public.reports       from anon, authenticated;
revoke all on public.report_orders from anon, authenticated;
