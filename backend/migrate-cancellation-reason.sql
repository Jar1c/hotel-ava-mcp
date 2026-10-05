-- Why a booking was cancelled — shown to the guest and the admin.
-- Run this in the Supabase SQL editor.

alter table bookings add column if not exists cancellation_reason text;
