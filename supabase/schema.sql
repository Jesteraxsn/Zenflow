create extension if not exists btree_gist;
create extension if not exists pgcrypto with schema extensions;

drop function if exists public.create_booking cascade;
drop function if exists public.quote_booking cascade;
drop function if exists public.submit_payment cascade;
drop function if exists public.verify_payment cascade;
drop function if exists public.cancel_booking cascade;
drop function if exists public.get_busy_slots cascade;
drop function if exists public.release_expired_holds cascade;

drop view if exists public.therapist_earnings;
drop table if exists public.activity_logs cascade;
drop table if exists public.payments cascade;
drop table if exists public.bookings cascade;
drop table if exists public.therapist_rates cascade;
drop table if exists public.therapists cascade;
drop table if exists public.services cascade;
drop table if exists public.settings cascade;
drop table if exists public.profiles cascade;
drop type if exists public.user_role cascade;
drop type if exists public.booking_status cascade;
drop type if exists public.booking_source cascade;
drop type if exists public.payment_status cascade;

create type public.user_role as enum ('customer', 'receptionist', 'admin');
create type public.booking_status as enum
  ('pending_payment', 'pending_verification', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.booking_source as enum ('online', 'walk_in');
create type public.payment_status as enum ('submitted', 'verified', 'rejected');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  email      text,
  phone      text,
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  category    text not null,
  description text not null default '',
  durations   int[] not null default '{60}',
  price       numeric(10,2) not null check (price >= 0),  -- lowest price; "from ₱…" labels and fallback
  prices      jsonb not null default '{}',                -- price per duration: {"60": 1150, "90": 1450}
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.therapists (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles (id) on delete set null,
  full_name        text not null,
  title            text not null default 'Massage Therapist',
  specialties      text[] not null default '{}',
  work_days        text not null default 'Mon – Sat',
  shift_start      time not null default '09:00',
  shift_end        time not null default '18:00',
  status           text not null default 'On duty' check (status in ('On duty', 'On break', 'Off today')),
  active           boolean not null default true,
  last_assigned_at timestamptz,               -- drives round-robin "any therapist"
  created_at       timestamptz not null default now()
);

-- Commission rates are staff-only (RLS below), so they live apart from the public therapist list.
create table public.therapist_rates (
  therapist_id    uuid primary key references public.therapists (id) on delete cascade,
  commission_rate numeric(4,3) not null default 0.350 check (commission_rate between 0 and 1)
);

create table public.bookings (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique
               default 'GW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  customer_id  uuid references public.profiles (id) on delete set null,   -- null for walk-ins
  client_name  text not null,
  client_phone text,
  service_id   uuid not null references public.services (id),
  therapist_id uuid not null references public.therapists (id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  price        numeric(10,2) not null,
  status       public.booking_status not null default 'pending_payment',
  source       public.booking_source not null default 'online',
  created_by   uuid references public.profiles (id) on delete set null,
  hold_expires_at timestamptz,               -- set when a payment is rejected; otherwise 30 min from created_at
  addons       text[] not null default '{}', -- 'aromatherapy' | 'hotStone' | 'homeService'
  home_address text,
  discount_label  text,                      -- e.g. 'Senior/PWD 20%' or 'Promo GINHAWA10 10%'
  discount_amount numeric(10,2) not null default 0,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Conflict detection: a therapist can never hold two live bookings that overlap.
  constraint no_double_booking exclude using gist (
    therapist_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending_payment', 'pending_verification', 'confirmed', 'completed'))
);
create index bookings_starts_at_idx on public.bookings (starts_at);
create index bookings_customer_idx on public.bookings (customer_id);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  method      text not null check (method in ('bank_transfer', 'gcash', 'cash', 'card')),
  amount      numeric(10,2) not null check (amount >= 0),
  reference   text,
  proof_path  text,                            -- path in storage bucket "payment-proofs"
  status      public.payment_status not null default 'submitted',
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);

create table public.activity_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  actor_name text not null default 'System',
  actor_role text not null default 'system',
  type       text not null check (type in ('booking', 'payment', 'pricing', 'schedule', 'cancellation', 'security', 'account')),
  action     text not null,
  amount     numeric(10,2),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- helpers ----------
-- Role of the signed-in user (security definer avoids RLS recursion on profiles).
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.app_role() in ('receptionist', 'admin'), false) $$;

-- Runs with the caller's rights: staff calling it directly pass the RLS insert policy; the booking
-- functions below (security definer, table owner) log customer actions without one.
create or replace function public.log_activity(
  p_type text, p_action text, p_amount numeric default null, p_booking uuid default null)
returns void
language plpgsql security invoker set search_path = public
as $$
declare v_name text; v_role text;
begin
  select full_name, role::text into v_name, v_role from profiles where id = auth.uid();
  insert into activity_logs (actor_id, actor_name, actor_role, type, action, amount, booking_id)
  values (auth.uid(), coalesce(nullif(v_name, ''), 'System'), coalesce(v_role, 'system'),
          p_type, p_action, p_amount, p_booking);
end $$;

-- Every sign-up is a customer. Staff roles are only ever granted by an admin
-- (or by the seed below), never by the email address someone registers with.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, full_name, email, phone, role)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          new.email,
          new.raw_user_meta_data ->> 'phone',
          'customer')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- DEMO ONLY: skip email verification — every new account is confirmed instantly.
create or replace function public.auto_confirm_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end $$;

drop trigger if exists on_auth_user_autoconfirm on auth.users;
create trigger on_auth_user_autoconfirm
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- Accounts that existed before a re-run get their profile back.
insert into public.profiles (id, full_name, email)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.email
from auth.users u
on conflict (id) do nothing;

-- Only admins may change anyone's role (including their own).
create or replace function public.guard_role_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(public.app_role(), 'customer') <> 'admin' then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_role_change();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

-- ---------- booking logic (RPCs) ----------

-- Unpaid holds older than 30 minutes free their slot again.
create or replace function public.release_expired_holds()
returns void
language sql security definer set search_path = public
as $$
  update bookings set status = 'cancelled'
  where status = 'pending_payment'
    and coalesce(hold_expires_at, created_at + interval '30 minutes') < now()
$$;

-- Busy ranges for a day, without exposing who booked them.
create or replace function public.get_busy_slots(p_day date)
returns table (therapist_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  perform public.release_expired_holds();
  return query
    select b.therapist_id, b.starts_at, b.ends_at
    from bookings b
    where b.status in ('pending_payment', 'pending_verification', 'confirmed', 'completed')
      and b.starts_at < ((p_day + 1)::timestamp at time zone 'Asia/Manila')
      and b.ends_at   > ( p_day      ::timestamp at time zone 'Asia/Manila');
end $$;

-- Does a free-text schedule like 'Mon – Sat' or 'Mon, Wed, Fri' include this date?
-- Unreadable text counts as every day so a typo never hides a therapist.
-- Mirrors worksOn() in src/lib/availability.js.
create or replace function public.works_on(p_days text, p_day date)
returns boolean
language plpgsql immutable
as $$
declare
  v_names  text[] := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_dow    int := extract(dow from p_day);
  v_part   text;
  v_bits   text[];
  v_a      int;
  v_b      int;
  v_parsed boolean := false;
begin
  if p_days is null or btrim(p_days) = '' or p_days ~* '(daily|every)' then return true; end if;
  foreach v_part in array string_to_array(p_days, ',') loop
    v_bits := regexp_split_to_array(btrim(v_part), '\s*[–—-]\s*');
    v_a := array_position(v_names, lower(left(btrim(v_bits[1]), 3))) - 1;
    v_b := array_position(v_names, lower(left(btrim(coalesce(v_bits[2], v_bits[1])), 3))) - 1;
    continue when v_a is null or v_b is null;
    v_parsed := true;
    if (v_a <= v_b and v_dow between v_a and v_b)
       or (v_a > v_b and (v_dow >= v_a or v_dow <= v_b)) then
      return true;
    end if;
  end loop;
  return not v_parsed;
end $$;

-- Is this therapist working for the whole session? Manila wall-clock time;
-- 'Off today' only blocks today. Mirrors bookableTherapists()/withinShift().
create or replace function public.therapist_on_shift(t public.therapists, p_start timestamptz, p_end timestamptz)
returns boolean
language sql stable
as $$
  select t.active
     and public.works_on(t.work_days, (p_start at time zone 'Asia/Manila')::date)
     and not (t.status = 'Off today'
              and (p_start at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date)
     and (p_end at time zone 'Asia/Manila')::date = (p_start at time zone 'Asia/Manila')::date
     and (p_start at time zone 'Asia/Manila')::time >= t.shift_start
     and (p_end   at time zone 'Asia/Manila')::time <= t.shift_end
$$;

-- The price for a booking: duration price + add-on fees − the better of promo or senior/PWD
-- (they don't combine). Mirrors quote() in src/lib/pricing.js; this is the one that counts.
create or replace function public.quote_booking(
  p_service  uuid,
  p_duration int,
  p_addons   text[] default '{}',
  p_promo    text default null,
  p_senior   boolean default false)
returns table (base numeric, addons_total numeric, discount_label text, discount_amount numeric, total numeric)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_service   services;
  v_fees      jsonb := coalesce((select value from settings where key = 'fees'), '{}');
  v_promo     jsonb := coalesce((select value from settings where key = 'promo'), '{}');
  v_addon     text;
  v_promo_pct numeric := 0;
  v_sen_pct   numeric := 0;
begin
  select * into v_service from services where id = p_service;
  if not found then raise exception 'Treatment not available'; end if;

  base := coalesce((v_service.prices ->> p_duration::text)::numeric, v_service.price);
  addons_total := 0;
  foreach v_addon in array coalesce(p_addons, '{}') loop
    if v_addon not in ('aromatherapy', 'hotStone', 'homeService') then
      raise exception 'Unknown add-on: %', v_addon;
    end if;
    addons_total := addons_total + coalesce((v_fees ->> v_addon)::numeric, 0);
  end loop;

  if nullif(btrim(p_promo), '') is not null then
    if coalesce((v_promo ->> 'active')::boolean, false)
       and upper(btrim(p_promo)) = upper(coalesce(v_promo ->> 'code', '')) then
      v_promo_pct := coalesce((v_promo ->> 'percent')::numeric, 0);
    else
      raise exception 'That promo code isn''t valid.';
    end if;
  end if;
  if p_senior then v_sen_pct := coalesce((v_promo ->> 'senior')::numeric, 0); end if;

  if greatest(v_promo_pct, v_sen_pct) > 0 then
    discount_label := case when v_sen_pct >= v_promo_pct
                           then 'Senior/PWD ' || v_sen_pct || '%'
                           else 'Promo ' || upper(btrim(p_promo)) || ' ' || v_promo_pct || '%' end;
    discount_amount := round((base + addons_total) * greatest(v_promo_pct, v_sen_pct) / 100, 2);
  else
    discount_amount := 0;
  end if;
  total := base + addons_total - discount_amount;
  return next;
end $$;

-- Creates a booking. p_therapist null = "any available therapist" (round-robin).
-- Customers book for themselves (online, pending_payment); staff can encode walk-ins.
create or replace function public.create_booking(
  p_service      uuid,
  p_starts_at    timestamptz,
  p_duration     int,
  p_therapist    uuid default null,
  p_client_name  text default null,
  p_client_phone text default null,
  p_walk_in      boolean default false,
  p_payment_method text default 'cash',
  p_addons       text[] default '{}',
  p_promo        text default null,
  p_senior       boolean default false,
  p_home_address text default null)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_role    public.user_role := public.app_role();
  v_service services;
  v_ends    timestamptz := p_starts_at + make_interval(mins => p_duration);
  v_ther    uuid := p_therapist;
  v_name    text;
  v_booking bookings;
  v_quote   record;
begin
  if auth.uid() is null then raise exception 'Please log in to book'; end if;
  if p_walk_in and v_role not in ('receptionist', 'admin') then
    raise exception 'Only staff can encode walk-ins';
  end if;
  if p_starts_at < now() - interval '15 minutes' then raise exception 'That time has already passed'; end if;
  perform public.release_expired_holds();

  select * into v_service from services where id = p_service and active;
  if not found then raise exception 'Treatment not available'; end if;
  if not (p_duration = any (v_service.durations)) then raise exception 'Invalid duration'; end if;
  if 'homeService' = any (coalesce(p_addons, '{}')) and nullif(btrim(p_home_address), '') is null then
    raise exception 'Please enter the address for home service.';
  end if;
  select * into v_quote from public.quote_booking(p_service, p_duration, p_addons, p_promo, p_senior);

  if v_ther is not null and not p_walk_in then
    -- Customers can only pick a therapist who is working then; staff may override for walk-ins.
    if not exists (select 1 from therapists t where t.id = v_ther and public.therapist_on_shift(t, p_starts_at, v_ends)) then
      raise exception 'That therapist isn''t working at that time. Please pick another time or therapist.';
    end if;
  end if;

  if v_ther is null then
    -- Round-robin: the free, on-shift therapist who was assigned least recently.
    select t.id into v_ther
    from therapists t
    where public.therapist_on_shift(t, p_starts_at, v_ends)
      and not exists (
        select 1 from bookings b
        where b.therapist_id = t.id
          and b.status in ('pending_payment', 'pending_verification', 'confirmed', 'completed')
          and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, v_ends))
    order by t.last_assigned_at nulls first, t.created_at
    limit 1
    for update skip locked;
    if v_ther is null then raise exception 'No therapist is free at that time'; end if;
  end if;

  select full_name into v_name from profiles where id = auth.uid();

  begin
    insert into bookings (customer_id, client_name, client_phone, service_id, therapist_id,
                          starts_at, ends_at, price, status, source, created_by,
                          addons, home_address, discount_label, discount_amount)
    values (case when p_walk_in then null else auth.uid() end,
            coalesce(nullif(p_client_name, ''), v_name, 'Guest'),
            p_client_phone, p_service, v_ther, p_starts_at, v_ends, v_quote.total,
            case when p_walk_in then 'confirmed' else 'pending_payment' end::booking_status,
            case when p_walk_in then 'walk_in' else 'online' end::booking_source,
            auth.uid(),
            coalesce(p_addons, '{}'),
            case when 'homeService' = any (coalesce(p_addons, '{}')) then btrim(p_home_address) end,
            v_quote.discount_label, v_quote.discount_amount)
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'That slot was just taken. Please pick another time.';
  end;

  update therapists set last_assigned_at = now() where id = v_ther;

  -- Walk-ins pay at the counter, so record the payment as already verified.
  if p_walk_in then
    insert into payments (booking_id, method, amount, status, verified_by, verified_at)
    values (v_booking.id, p_payment_method, v_quote.total, 'verified', auth.uid(), now());
  end if;

  perform public.log_activity('booking',
    case when p_walk_in then 'Encoded walk-in ' else 'Booked ' end || v_service.name || ' (' || v_booking.code || ')',
    v_quote.total, v_booking.id);
  return v_booking;
end $$;


-- Customer submits bank-transfer proof → booking awaits verification.
create or replace function public.submit_payment(
  p_booking uuid, p_reference text, p_proof_path text, p_method text default 'bank_transfer')
returns public.payments
language plpgsql security definer set search_path = public
as $$
declare v_booking bookings; v_payment payments;
begin
  select * into v_booking from bookings where id = p_booking;
  if not found or (v_booking.customer_id is distinct from auth.uid() and not public.is_staff()) then
    raise exception 'Booking not found';
  end if;
  if v_booking.status <> 'pending_payment' then raise exception 'Payment already submitted'; end if;

  insert into payments (booking_id, method, amount, reference, proof_path)
  values (p_booking, p_method, v_booking.price, p_reference, p_proof_path)
  returning * into v_payment;
  update bookings set status = 'pending_verification' where id = p_booking;
  perform public.log_activity('payment', 'Submitted payment proof for ' || v_booking.code, v_booking.price, p_booking);
  return v_payment;
end $$;

-- Staff verify (or reject) a payment.
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
         -- a rejected payment gives the customer 24 hours to upload a correct receipt
         hold_expires_at = case when p_approve then hold_expires_at else now() + interval '24 hours' end
   where id = v_payment.booking_id
  returning code into v_code;
  perform public.log_activity('payment',
    case when p_approve then 'Verified payment ' else 'Rejected payment ' end || v_code,
    v_payment.amount, v_payment.booking_id);
end $$;

-- Customer cancels own booking; staff can cancel any.
create or replace function public.cancel_booking(p_booking uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_booking bookings;
begin
  select * into v_booking from bookings where id = p_booking;
  if not found or (v_booking.customer_id is distinct from auth.uid() and not public.is_staff()) then
    raise exception 'Booking not found';
  end if;
  if v_booking.status in ('completed', 'cancelled') then raise exception 'Booking can no longer be cancelled'; end if;
  update bookings set status = 'cancelled' where id = p_booking;
  perform public.log_activity('cancellation', 'Cancelled ' || v_booking.code, -v_booking.price, p_booking);
end $$;

-- ---------- reporting ----------
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

-- ---------- row level security ----------
alter table public.profiles      enable row level security;
alter table public.services      enable row level security;
alter table public.therapists    enable row level security;
alter table public.bookings      enable row level security;
alter table public.payments      enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings      enable row level security;

-- profiles
create policy "read own profile or staff reads all" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin updates profiles" on public.profiles
  for update using (public.app_role() = 'admin');

-- services: public menu; admin edits
create policy "anyone reads active services" on public.services
  for select using (active or public.is_staff());
create policy "admin manages services" on public.services
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- therapists: public list (for booking); admin edits
create policy "anyone reads active therapists" on public.therapists
  for select using (active or public.is_staff());
create policy "admin manages therapists" on public.therapists
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- therapist_rates: staff read, admin edits; every new therapist gets a default row
alter table public.therapist_rates enable row level security;
create policy "staff read rates" on public.therapist_rates
  for select using (public.is_staff());
create policy "admin manages rates" on public.therapist_rates
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create or replace function public.add_therapist_rate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into therapist_rates (therapist_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger therapists_add_rate
  after insert on public.therapists
  for each row execute function public.add_therapist_rate();

-- bookings: writes go through RPCs; staff may edit/delete directly
create policy "customer reads own bookings, staff all" on public.bookings
  for select using (customer_id = auth.uid() or public.is_staff());
create policy "staff updates bookings" on public.bookings
  for update using (public.is_staff()) with check (public.is_staff());
create policy "staff deletes bookings" on public.bookings
  for delete using (public.is_staff());

-- payments
create policy "customer reads own payments, staff all" on public.payments
  for select using (
    public.is_staff()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid()));

-- activity logs: staff read; writes only via log_activity()
create policy "staff writes own log entries" on public.activity_logs
  for insert to authenticated
  with check (public.is_staff() and actor_id = auth.uid());
create policy "staff reads logs" on public.activity_logs
  for select using (public.is_staff());

-- settings (pricing fees, promos): public read, admin write
create policy "anyone reads settings" on public.settings for select using (true);
create policy "admin manages settings" on public.settings
  for all using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- RPC access
revoke execute on function public.create_booking, public.submit_payment,
  public.verify_payment, public.cancel_booking, public.log_activity,
  public.release_expired_holds from public, anon;
grant execute on function public.create_booking, public.submit_payment,
  public.verify_payment, public.cancel_booking, public.log_activity to authenticated;
grant execute on function public.get_busy_slots(date) to anon, authenticated;
grant execute on function public.quote_booking(uuid, int, text[], text, boolean) to anon, authenticated;

-- ---------- storage: payment proofs ----------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "customers upload own proofs" on storage.objects;
drop policy if exists "owners and staff read proofs" on storage.objects;

-- Files live at payment-proofs/<user id>/<file>.
create policy "customers upload own proofs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners and staff read proofs" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------- seed data ----------
insert into public.services (slug, name, category, description, durations, price, prices) values
  ('hilot-renewal', 'Hilot Renewal Ritual', 'Signature Ritual',
   'An ancestral Filipino healing massage using warm coconut oil and banana leaf to release blocked energy.', '{60,90}', 1150, '{"60": 1150, "90": 1450}'),
  ('ginhawa-deep-release', 'Ginhawa Deep Release', 'Massage Therapy',
   'Focused deep-tissue work for chronic tension, combined with calming aromatherapy.', '{60,90}', 1150, '{"60": 1150, "90": 1450}'),
  ('dalisay-facial', 'Dalisay Botanical Facial', 'Facial Care',
   'A nourishing botanical facial with local calamansi and malunggay extracts to brighten and restore.', '{60}', 1250, '{"60": 1250}'),
  ('swedish', 'Swedish Massage', 'Massage Therapy',
   'Long, flowing strokes that ease muscle tension and improve circulation.', '{60}', 750, '{"60": 750}'),
  ('foot-reflexology', 'Foot Reflexology', 'Body Care',
   'Pressure-point therapy on the feet to relieve fatigue and restore balance.', '{30,60}', 300, '{"30": 300, "60": 450}');

insert into public.therapists (full_name, title, specialties, work_days, shift_start, shift_end, status) values
  ('Liza Mendoza',       'Senior Hilot Therapist', '{Hilot,Ventosa,Lymphatic}', 'Mon – Sat', '09:00', '17:00', 'On duty'),
  ('Paolo dela Cruz',    'Massage Therapist',      '{"Deep tissue",Swedish}',   'Tue – Sun', '11:00', '19:00', 'On duty'),
  ('Marisol Villanueva', 'Facialist',              '{Facials,"Skin care"}',     'Mon – Fri', '10:00', '18:00', 'On break'),
  ('Ramon Bautista',     'Wellness Therapist',     '{Reflexology,Stretching}',  'Wed – Sun', '12:00', '20:00', 'Off today'),
  ('Joyce Navarro',      'Massage Therapist',      '{Swedish,Prenatal}',        'Mon – Sat', '13:00', '21:00', 'On duty');

update public.therapist_rates r set commission_rate = v.rate
from public.therapists t, (values ('Liza Mendoza', 0.40), ('Paolo dela Cruz', 0.35), ('Marisol Villanueva', 0.35),
                                  ('Ramon Bautista', 0.30), ('Joyce Navarro', 0.35)) as v(name, rate)
where r.therapist_id = t.id and t.full_name = v.name;

insert into public.settings (key, value) values
  ('bank_details', '{"bank":"Bank of the Philippine Islands (BPI)","accountName":"Ginhawa Spa & Wellness Sanctuary Inc.","accountNumber":"0093 4426 7715","gcash":"0917 482 3361 · Ginhawa Spa"}'),
  ('fees',  '{"homeService":300,"aromatherapy":150,"hotStone":250,"lateCancel":50}'),
  ('promo', '{"code":"GINHAWA10","percent":10,"active":true,"senior":20}');

-- ---------- demo accounts + a week of activity ----------
-- Demo logins (password for all: ginhawa2026)
--   admin@ginhawa.demo      → Admin        (Marlinda Alminaza, spa owner)
--   frontdesk@ginhawa.demo  → Receptionist (Jayson Reyes)
--   patricia@ginhawa.demo   → Customer     (Patricia Diamante)
-- Dates are relative to the day you run this, so the dashboards always look current.
do $$
declare
  v_today  date := (now() at time zone 'Asia/Manila')::date;
  v_slots  time[] := array['10:00', '11:30', '13:00', '14:30', '16:00', '17:30']::time[];
  v_ther   uuid[];
  v_svc    uuid[];
  v_cust   uuid[];
  v_admin  uuid;
  v_desk   uuid;
  v_pat    uuid;
  v_start  timestamptz;
  v_bid    uuid;
  v_sid    uuid;
  v_dur    int;
  v_price  numeric;
  v_status booking_status;
  v_source booking_source;
  v_cid    uuid;
  v_name   text;
  u        record;
  d int; i int; j int; k int := 0;
begin
  delete from auth.users where email like '%@ginhawa.demo';

  for u in
    select * from (values
      ('admin@ginhawa.demo',     'Marlinda Alminaza', '0917 100 0001'),
      ('frontdesk@ginhawa.demo', 'Jayson Reyes',      '0917 100 0002'),
      ('patricia@ginhawa.demo',  'Patricia Diamante', '0917 555 0142'),
      ('andrea@ginhawa.demo',    'Andrea Lim',        '0918 222 7781'),
      ('carlo@ginhawa.demo',     'Carlo Reyes',       '0921 401 9932'),
      ('bea@ginhawa.demo',       'Bea Torres',        '0915 873 1120'),
      ('jun@ginhawa.demo',       'Jun Aquino',        '0927 664 0019')
    ) as t(email, full_name, phone)
  loop
    v_bid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_bid, 'authenticated', 'authenticated', u.email,
            extensions.crypt('ginhawa2026', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', u.full_name, 'phone', u.phone),
            now() - interval '30 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_bid, v_bid::text,
            jsonb_build_object('sub', v_bid::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;

  update profiles set role = 'admin'        where email = 'admin@ginhawa.demo';
  update profiles set role = 'receptionist' where email = 'frontdesk@ginhawa.demo';

  select id into v_admin from profiles where email = 'admin@ginhawa.demo';
  select id into v_desk  from profiles where email = 'frontdesk@ginhawa.demo';
  select id into v_pat   from profiles where email = 'patricia@ginhawa.demo';
  select array_agg(id order by email) into v_cust from profiles where role = 'customer' and email like '%@ginhawa.demo';
  select array_agg(id order by full_name) into v_ther from therapists;
  select array_agg(id order by slug) into v_svc from services;

  -- Past 7 days + today: a steady flow of sessions across therapists and slots.
  for d in -7..0 loop
    for i in 1..array_length(v_ther, 1) loop
      for j in 1..array_length(v_slots, 1) loop
        continue when (d + i * 2 + j) % 3 = 0;                         -- leave gaps
        continue when d = 0 and (select status from therapists where id = v_ther[i]) = 'Off today';
        k := k + 1;
        v_start := ((v_today + d) + v_slots[j]) at time zone 'Asia/Manila';
        v_sid   := v_svc[1 + (i + j + d + 7) % array_length(v_svc, 1)];
        select durations[array_upper(durations, 1)], coalesce((prices ->> durations[array_upper(durations, 1)]::text)::numeric, price)
          into v_dur, v_price from services where id = v_sid;
        v_source := case when k % 4 = 0 then 'walk_in' else 'online' end;
        v_cid    := case when v_source = 'walk_in' then null else v_cust[1 + k % array_length(v_cust, 1)] end;
        v_name   := coalesce((select full_name from profiles where id = v_cid),
                             (array['Rina Uy', 'Leo Garcia', 'Ana Cruz', 'Mark Tan'])[1 + k % 4]);

        if d < 0 then
          v_status := case when k % 23 = 0 then 'cancelled' when k % 29 = 0 then 'no_show' else 'completed' end;
        elsif v_start < now() then
          v_status := 'completed';
        else
          v_status := case when k % 5 = 0 then 'pending_verification' else 'confirmed' end;
        end if;

        insert into bookings (customer_id, client_name, client_phone, service_id, therapist_id,
                              starts_at, ends_at, price, status, source, created_by, created_at)
        values (v_cid, v_name, null, v_sid, v_ther[i], v_start, v_start + make_interval(mins => v_dur),
                v_price, v_status, v_source, coalesce(v_cid, v_desk), v_start - interval '2 days')
        returning id into v_bid;

        if v_status <> 'cancelled' then
          insert into payments (booking_id, method, amount, reference, status, verified_by, verified_at, created_at)
          values (v_bid,
                  case when v_source = 'walk_in' then 'cash' when k % 2 = 0 then 'gcash' else 'bank_transfer' end,
                  v_price,
                  case when v_source = 'online' then lpad((k * 7919 % 1000000)::text, 6, '0') || ' ' || lpad((k * 104729 % 10000)::text, 4, '0') end,
                  case when v_status = 'pending_verification' then 'submitted' else 'verified' end::payment_status,
                  case when v_status = 'pending_verification' then null else v_desk end,
                  case when v_status = 'pending_verification' then null else v_start - interval '1 day' end,
                  v_start - interval '2 days');
        end if;
      end loop;
    end loop;
  end loop;

  -- Patricia's own story: a past facial and an upcoming hilot ritual.
  v_start := ((v_today + 3) + time '14:30') at time zone 'Asia/Manila';
  select id, coalesce((prices ->> '90')::numeric, price) into v_sid, v_price from services where slug = 'hilot-renewal';
  insert into bookings (customer_id, client_name, service_id, therapist_id, starts_at, ends_at, price, status, source, created_by)
  values (v_pat, 'Patricia Diamante', v_sid, v_ther[2], v_start, v_start + interval '90 minutes', v_price, 'confirmed', 'online', v_pat)
  returning id into v_bid;
  insert into payments (booking_id, method, amount, reference, status, verified_by, verified_at)
  values (v_bid, 'bank_transfer', v_price, '4821 0093 1157', 'verified', v_desk, now());

  -- Recent activity feed.
  insert into activity_logs (actor_id, actor_name, actor_role, type, action, amount, created_at) values
    (v_pat,   'Patricia Diamante', 'customer',     'booking',  'Booked Hilot Renewal Ritual',              v_price, now() - interval '20 minutes'),
    (v_desk,  'Jayson Reyes',      'receptionist', 'payment',  'Verified payment for Patricia Diamante',   v_price, now() - interval '15 minutes'),
    (v_admin, 'Marlinda Alminaza', 'admin',        'pricing',  'Updated price: Swedish Massage ₱700 → ₱750', null,  now() - interval '2 hours'),
    (v_desk,  'Jayson Reyes',      'receptionist', 'booking',  'Encoded walk-in for Carlo Reyes',          450,     now() - interval '3 hours'),
    (null,    'System',            'system',       'security', 'Blocked 3 failed login attempts from 112.198.x.x', null, now() - interval '5 hours'),
    (v_admin, 'Marlinda Alminaza', 'admin',        'schedule', 'Set Ramon Bautista to Off today',          null,    now() - interval '6 hours');

  update therapists set last_assigned_at = now() - (random() * interval '1 day');
end $$;
