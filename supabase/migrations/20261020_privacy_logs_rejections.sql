-- 2026-10-20: privacy and payment-rejection fixes.
-- Safe on a live database: existing commission rates are copied before the old column is dropped.
-- Paste into Supabase → SQL Editor → Run. (schema.sql already includes these changes.)

-- 1. Commission rates move to a staff-only table, so customers and visitors can't read them.
create table if not exists public.therapist_rates (
  therapist_id    uuid primary key references public.therapists (id) on delete cascade,
  commission_rate numeric(4,3) not null default 0.350 check (commission_rate between 0 and 1)
);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'therapists' and column_name = 'commission_rate') then
    insert into public.therapist_rates (therapist_id, commission_rate)
    select id, commission_rate from public.therapists
    on conflict (therapist_id) do nothing;
  end if;
end $$;

alter table public.therapist_rates enable row level security;
drop policy if exists "staff read rates" on public.therapist_rates;
drop policy if exists "admin manages rates" on public.therapist_rates;
create policy "staff read rates" on public.therapist_rates
  for select using (public.is_staff());
create policy "admin manages rates" on public.therapist_rates
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- Every new therapist gets a rate row (the admin page then sets the real value).
create or replace function public.add_therapist_rate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into therapist_rates (therapist_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists therapists_add_rate on public.therapists;
create trigger therapists_add_rate
  after insert on public.therapists
  for each row execute function public.add_therapist_rate();

drop view if exists public.therapist_earnings;
alter table public.therapists drop column if exists commission_rate;

create view public.therapist_earnings
with (security_invoker = true) as
select t.id as therapist_id,
       t.full_name as therapist,
       count(b.id)::int as sessions,
       coalesce(sum(b.price), 0)::numeric(12,2) as gross,
       coalesce(sum(b.price * r.commission_rate), 0)::numeric(12,2) as commission
from therapists t
left join therapist_rates r on r.therapist_id = t.id
left join bookings b on b.therapist_id = t.id and b.status in ('confirmed', 'completed')
group by t.id, t.full_name;

-- 2. Only staff may write log entries directly. The booking functions still log customer
--    actions: they run as the table owner, which RLS doesn't restrict.
alter function public.log_activity(text, text, numeric, uuid) security invoker;

drop policy if exists "staff writes own log entries" on public.activity_logs;
create policy "staff writes own log entries" on public.activity_logs
  for insert to authenticated
  with check (public.is_staff() and actor_id = auth.uid());

-- 3. A rejected payment gives the customer 24 hours to upload a correct receipt,
--    instead of the original 30-minute hold cancelling the booking straight away.
alter table public.bookings add column if not exists hold_expires_at timestamptz;

create or replace function public.release_expired_holds()
returns void
language sql security definer set search_path = public
as $$
  update bookings set status = 'cancelled'
  where status = 'pending_payment'
    and coalesce(hold_expires_at, created_at + interval '30 minutes') < now()
$$;

create or replace function public.verify_payment(p_payment uuid, p_approve boolean default true)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_payment payments; v_code text;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into v_payment from payments where id = p_payment;
  if not found then raise exception 'Payment not found'; end if;

  update payments
     set status = case when p_approve then 'verified' else 'rejected' end::payment_status,
         verified_by = auth.uid(), verified_at = now()
   where id = p_payment;
  update bookings
     set status = case when p_approve then 'confirmed' else 'pending_payment' end::booking_status,
         hold_expires_at = case when p_approve then hold_expires_at else now() + interval '24 hours' end
   where id = v_payment.booking_id
  returning code into v_code;
  perform public.log_activity('payment',
    case when p_approve then 'Verified payment ' else 'Rejected payment ' end || v_code,
    v_payment.amount, v_payment.booking_id);
end $$;
