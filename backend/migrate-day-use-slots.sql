-- Allow multiple day-use bookings per room on the SAME date when the time
-- slots don't overlap (e.g. 2:00-5:00 PM and 6:00-9:00 PM coexist).
--
-- The old bookings_no_overlap constraint compared only daterange(check_in,
-- check_out), and a day-use row stores check_out = check_in + 1 day — so ANY
-- second booking on that date (even hours later) collided and surfaced a raw
-- Postgres 23P01 error to the guest at checkout.
--
-- Day-use rows are now outside the exclusion constraint; overlap for them is
-- enforced in the app by find_room_conflict() with a 1-hour gap (and mirrored
-- in /api/rooms/check-availability). Overnight rows keep full DB protection
-- for pending + confirmed.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out) WITH &&
  )
  WHERE (status IN ('pending', 'confirmed') AND COALESCE(stay_type, 'overnight') <> 'day');
