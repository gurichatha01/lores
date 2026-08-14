-- LORES · Brief 2 · 10-report pack credit ledger
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- Safe to re-run: everything is create-or-replace / if-not-exists.

-- 1. The ledger. One row per pack purchase (per Razorpay payment_id).
--    user_id stays NULL until the buyer creates an account and claims it.
create table if not exists public.pack_credits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users (id) on delete cascade,          -- NULL until claimed
  credits_remaining integer     not null check (credits_remaining >= 0),
  payment_id        text        not null unique,                                 -- Razorpay payment id; idempotency key
  amount            integer     not null,                                        -- paid amount in smallest unit (paise/cents)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists pack_credits_user_id_idx  on public.pack_credits (user_id);
create index if not exists pack_credits_unclaimed_idx on public.pack_credits (created_at) where user_id is null;

-- 2. Lock the table down. All access goes through the server's service-role key,
--    which BYPASSES RLS. Enabling RLS with NO policies means the anon/browser key
--    (and any logged-in user) can never read or write credits directly.
alter table public.pack_credits enable row level security;
revoke all on public.pack_credits from anon, authenticated;

-- 3. Atomic, idempotent claim: bind an unclaimed payment_id to a user, exactly once.
--    Returns the credit count + a status the server maps to a clean response.
create or replace function public.claim_pack(p_payment_id text, p_user_id uuid)
returns table (credits_remaining integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_rec public.pack_credits%rowtype;
begin
  select * into row_rec from public.pack_credits
    where payment_id = p_payment_id
    for update;

  if not found then
    return query select null::integer, 'not_found';
  elsif row_rec.user_id is null then
    update public.pack_credits
      set user_id = p_user_id, updated_at = now()
      where payment_id = p_payment_id
      returning public.pack_credits.credits_remaining into row_rec.credits_remaining;
    return query select row_rec.credits_remaining, 'claimed';
  elsif row_rec.user_id = p_user_id then
    -- Already claimed by the same account: idempotent no-op success.
    return query select row_rec.credits_remaining, 'already_claimed';
  else
    return query select null::integer, 'claimed_by_other';
  end if;
end;
$$;

-- 4. Atomic spend: decrement exactly one credit from the caller's oldest row that
--    still has credits. Never goes below zero, immune to double-submit races
--    (SKIP LOCKED + the WHERE guard). Returns the new remaining count, or -1 when
--    the user has no credits at all.
create or replace function public.spend_pack_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_remaining integer;
begin
  update public.pack_credits
    set credits_remaining = credits_remaining - 1, updated_at = now()
    where id = (
      select id from public.pack_credits
        where user_id = p_user_id and credits_remaining > 0
        order by created_at asc
        limit 1
        for update skip locked
    )
    returning credits_remaining into new_remaining;

  if not found then
    return -1;
  end if;
  return new_remaining;
end;
$$;

-- 5. Total remaining credits for a user (sum across any packs they own).
create or replace function public.total_pack_credits(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(credits_remaining), 0)::integer
    from public.pack_credits
    where user_id = p_user_id;
$$;

-- 6. Only the server (service-role) may call these. Never the browser.
revoke all on function public.claim_pack(text, uuid)       from public, anon, authenticated;
revoke all on function public.spend_pack_credit(uuid)      from public, anon, authenticated;
revoke all on function public.total_pack_credits(uuid)     from public, anon, authenticated;
grant execute on function public.claim_pack(text, uuid)    to service_role;
grant execute on function public.spend_pack_credit(uuid)   to service_role;
grant execute on function public.total_pack_credits(uuid)  to service_role;
