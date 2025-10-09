/*
  # Add Error Tracking Fields to Trading Bots

  1. Changes to `trading_bots` table
    - Add `last_error` (text, nullable) - Last error message encountered by the bot
    - Add `last_error_at` (timestamptz, nullable) - Timestamp of the last error

  2. Purpose
    - Track recent errors for better debugging and user visibility
    - Help users understand why their bots might be failing
    - Provide context for failed trades

  3. Notes
    - These fields are nullable and will only be populated when an error occurs
    - The bot continues operating even after errors; these fields just track the last issue
*/

-- Add error tracking fields to trading_bots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN last_error text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'last_error_at'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN last_error_at timestamptz;
  END IF;
END $$;