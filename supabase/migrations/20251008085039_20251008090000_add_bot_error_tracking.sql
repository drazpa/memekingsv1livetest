/*
  # Add Bot Error Tracking Fields

  1. Changes to trading_bots table
    - Add `last_error` (text) - Stores the last error message
    - Add `last_error_at` (timestamptz) - Timestamp of last error
    - Add `avg_trade_time` (numeric) - Average time to complete trades in seconds
    - Add `last_successful_trade_at` (timestamptz) - Last successful trade timestamp
    - Add `performance_score` (numeric) - Success rate percentage

  2. Purpose
    - Better error tracking for debugging
    - Performance metrics for bot intelligence
    - Historical data for optimization
*/

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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'avg_trade_time'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN avg_trade_time numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'last_successful_trade_at'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN last_successful_trade_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'performance_score'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN performance_score numeric DEFAULT 0;
  END IF;
END $$;
