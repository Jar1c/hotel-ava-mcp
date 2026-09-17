-- Fix RLS on approved_discounts so anon key (used by Flask backend) can write
-- Run this in Supabase SQL Editor

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can approve" ON approved_discounts;
DROP POLICY IF EXISTS "Authenticated users can dismiss" ON approved_discounts;

-- Allow anyone to insert (Flask backend uses anon key, role = 'anon')
CREATE POLICY "Anyone can approve discounts"
  ON approved_discounts FOR INSERT
  WITH CHECK (true);

-- Allow anyone to delete (Flask backend uses anon key)
CREATE POLICY "Anyone can dismiss discounts"
  ON approved_discounts FOR DELETE
  USING (true);

-- Seed current approved discounts (only Standard should be approved)
INSERT INTO approved_discounts (event_room_type_key)
VALUES ('BER Months Early Bird-Standard')
ON CONFLICT (event_room_type_key) DO NOTHING;
