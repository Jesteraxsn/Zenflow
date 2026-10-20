-- 2026-10-20: add-ons (aromatherapy, hot stone, home service), promo codes and the senior/PWD
-- discount, using the fees and promo settings from Admin → Pricing.
-- Safe on a live database: adds columns and replaces create_booking.
-- Paste into Supabase → SQL Editor → Run. (schema.sql already includes these changes.)

alter table public.bookings add column if not exists addons          text[] not null default '{}';
alter table public.bookings add column if not exists home_address    text;
alter table public.bookings add column if not exists discount_label  text;
alter table public.bookings add column if not exists discount_amount numeric(10,2) not null default 0;

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

grant execute on function public.quote_booking(uuid, int, text[], text, boolean) to anon, authenticated;

-- create_booking gains add-ons, promo, senior/PWD and a home-service address.
drop function if exists public.create_booking(uuid, timestamptz, int, uuid, text, text, boolean, text);

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

revoke execute on function public.create_booking(uuid, timestamptz, int, uuid, text, text, boolean, text, text[], text, boolean, text) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz, int, uuid, text, text, boolean, text, text[], text, boolean, text) to authenticated;
