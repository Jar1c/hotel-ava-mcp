-- Day-use pricing per duration for admin Rooms (3h / 6h / 8h / 12h).
-- NULL means "auto": the app falls back to pro-rata (overnight price x hours / 24).
-- Run this in the Supabase SQL editor.

alter table rooms add column if not exists day_use_3h numeric;
alter table rooms add column if not exists day_use_6h numeric;
alter table rooms add column if not exists day_use_8h numeric;
alter table rooms add column if not exists day_use_12h numeric;

-- Backfill with today's pro-rata so the admin form starts from sensible numbers.
update rooms set
  day_use_3h  = round(price * 3 / 24),
  day_use_6h  = round(price * 6 / 24),
  day_use_8h  = round(price * 8 / 24),
  day_use_12h = round(price * 12 / 24)
where day_use_3h is null;
