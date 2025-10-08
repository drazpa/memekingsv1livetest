/*
  # Add Slippage to Trading Bots

  1. Changes
    - Add `slippage` column to `trading_bots` table
      - Type: numeric
      - Default: 5.0 (5% slippage tolerance)
      - Description: Maximum acceptable slippage percentage for trades

  2. Notes
    - Slippage controls how much price movement is acceptable during trade execution
    - Default of 5% provides reasonable protection while allowing flexibility
    - Users can customize this value when creating or editing bots
*/

-- Add slippage column to trading_bots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'slippage'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN slippage numeric DEFAULT 5.0;
  END IF;
END $$;
