/*
  # Add Token Balance to Trading Bots

  1. New Column
    - `token_balance` (numeric) - Current token balance held by bot
  
  2. Purpose
    - Track live token balance for each bot
    - Display real-time token holdings
    - Calculate accurate profit/loss metrics
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trading_bots' AND column_name = 'token_balance'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN token_balance numeric DEFAULT 0;
  END IF;
END $$;
