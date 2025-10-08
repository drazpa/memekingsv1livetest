/*
  # Add Strategy Fields to Trading Bots

  1. Changes
    - Add `strategy` column for bot trading strategies
    - Add `max_daily_trades` column to limit daily trades
    - Add `stop_loss_percent` column for stop loss percentage
    - Add `take_profit_percent` column for take profit percentage

  2. Notes
    - All fields are optional with sensible defaults
    - Strategy defaults to 'balanced'
    - Max daily trades defaults to 50
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'strategy'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN strategy text DEFAULT 'balanced';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'max_daily_trades'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN max_daily_trades integer DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'stop_loss_percent'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN stop_loss_percent numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'take_profit_percent'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN take_profit_percent numeric DEFAULT 0;
  END IF;
END $$;
