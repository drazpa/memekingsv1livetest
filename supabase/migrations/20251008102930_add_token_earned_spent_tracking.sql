/*
  # Add Token Earned and Spent Tracking

  1. New Columns
    - `total_tokens_earned` (numeric) - Total tokens earned from selling
    - `total_tokens_spent` (numeric) - Total tokens spent from buying
  
  2. Changes
    - Add columns to trading_bots table with default 0
    - These track the actual token amounts, not XRP amounts
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trading_bots' AND column_name = 'total_tokens_earned'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN total_tokens_earned numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trading_bots' AND column_name = 'total_tokens_spent'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN total_tokens_spent numeric DEFAULT 0;
  END IF;
END $$;