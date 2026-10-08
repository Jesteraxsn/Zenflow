-- 2026-10-09: a separate price for each service duration.
-- Safe on a live database: adds a column, fills it from each service's current price
-- (so nothing a customer pays changes until an admin edits it), and replaces create_booking.
-- Paste into Supabase → SQL Editor → Run. (schema.sql already includes these changes.)

alter table public.services add column if not exists prices jsonb not null default '{}';

update public.services s
set prices = (select jsonb_object_agg(d::text, s.price) from unnest(s.durations) d)
where s.prices = '{}'::jsonb;

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
  p_payment_method text default 'cash')
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
  v_price   numeric;
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
  -- Each duration has its own price; fall back to the base price if one is missing.
  v_price := coalesce((v_service.prices ->> p_duration::text)::numeric, v_service.price);

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
                          starts_at, ends_at, price, status, source, created_by)
    values (case when p_walk_in then null else auth.uid() end,
            coalesce(nullif(p_client_name, ''), v_name, 'Guest'),
            p_client_phone, p_service, v_ther, p_starts_at, v_ends, v_price,
            case when p_walk_in then 'confirmed' else 'pending_payment' end::booking_status,
            case when p_walk_in then 'walk_in' else 'online' end::booking_source,
            auth.uid())
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'That slot was just taken. Please pick another time.';
  end;

  update therapists set last_assigned_at = now() where id = v_ther;

  -- Walk-ins pay at the counter, so record the payment as already verified.
  if p_walk_in then
    insert into payments (booking_id, method, amount, status, verified_by, verified_at)
    values (v_booking.id, p_payment_method, v_price, 'verified', auth.uid(), now());
  end if;

  perform public.log_activity('booking',
    case when p_walk_in then 'Encoded walk-in ' else 'Booked ' end || v_service.name || ' (' || v_booking.code || ')',
    v_price, v_booking.id);
  return v_booking;
end $$;

