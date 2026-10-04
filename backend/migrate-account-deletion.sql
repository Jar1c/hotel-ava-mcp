-- ── Account deletion: 30-day grace period ─────────────────────────────────────
-- Run ONCE in the Supabase SQL editor. Safe to re-run (every step is idempotent
-- or guarded by IF NOT EXISTS).
--
-- ═══ STEP 0 — BACKUP (run this first; it is your rollback source) ═══════════
CREATE TABLE IF NOT EXISTS backup_users_20261004         AS TABLE public.users;
CREATE TABLE IF NOT EXISTS backup_bookings_20261004      AS TABLE public.bookings;
CREATE TABLE IF NOT EXISTS backup_reviews_20261004       AS TABLE public.reviews;
CREATE TABLE IF NOT EXISTS backup_notifications_20261004 AS TABLE public.notifications;
-- IF NOT EXISTS: a re-run never overwrites the first backup.
-- (Names carry the date so a future feature can take a fresh snapshot.)

-- ═══ STEP 1 — Deletion schedule columns ═════════════════════════════════════
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;

-- ═══ STEP 2 — User references must SURVIVE account deletion (anonymized) ════
-- DROP NOT NULL is a no-op when the column is already nullable.
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.reviews   ALTER COLUMN user_id DROP NOT NULL;

-- Any foreign key on these user_id columns becomes ON DELETE SET NULL, so a
-- hard delete can NEVER cascade bookings/reviews away (they keep amounts and
-- dates with user reference nulled). No-op when no such FK exists.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid IN ('public.bookings'::regclass, 'public.reviews'::regclass)
      AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (user_id)%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL',
      r.tbl, r.conname);
    RAISE NOTICE 'Recreated %.% as ON DELETE SET NULL', r.tbl, r.conname;
  END LOOP;
END $$;

-- ═══ ROLLBACK (only if you must undo this migration) ═════════════════════════
-- 1) Drop the new columns (bookings/reviews with user_id NULL must be cleaned
--    up first if you ever want NOT NULL back):
--      ALTER TABLE public.users DROP COLUMN IF EXISTS deletion_requested_at;
--      ALTER TABLE public.users DROP COLUMN IF EXISTS scheduled_deletion_at;
--      -- ALTER TABLE public.bookings ALTER COLUMN user_id SET NOT NULL;  -- fails while anonymized rows exist
--      -- ALTER TABLE public.reviews   ALTER COLUMN user_id SET NOT NULL;
-- 2) Restore pre-migration rows from the backup_* tables, e.g.:
--      -- TRUNCATE public.notifications;
--      -- INSERT INTO public.notifications SELECT * FROM backup_notifications_20261004;
--    Bookings/reviews anonymized AFTER this migration are NOT auto-restored —
--    merge them manually from backup_bookings_20261004 / backup_reviews_20261004.
-- 3) The FKs recreated above can be reverted by dropping them and re-adding
--    with ON DELETE CASCADE if the original behaviour is ever required.
