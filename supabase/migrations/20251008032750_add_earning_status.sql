/*
  # Add Earning Status to Token Earnings

  1. Changes
    - Add `is_earning` column to track if user is actively earning
    - Add `earning_started_at` to track when earning was started
    - Add `pending_amount` to store the amount when earning is stopped

  2. Notes
    - Users must start earning to begin accumulating
    - Users must stop earning before claiming
    - Pending amount is calculated and frozen when stopped
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'token_earnings' AND column_name = 'is_earning'
  ) THEN
    ALTER TABLE token_earnings ADD COLUMN is_earning boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'token_earnings' AND column_name = 'earning_started_at'
  ) THEN
    ALTER TABLE token_earnings ADD COLUMN earning_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'token_earnings' AND column_name = 'pending_amount'
  ) THEN
    ALTER TABLE token_earnings ADD COLUMN pending_amount numeric DEFAULT 0;
  END IF;
END $$;
