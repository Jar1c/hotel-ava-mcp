-- Add name_changed_at column for 7-day name change cooldown
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name_changed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: set name_changed_at to created_at for existing users
UPDATE public.users SET name_changed_at = created_at WHERE name_changed_at IS NULL;
