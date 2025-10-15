/*
  # Add AMM Pool Extended Fields

  1. Changes to `meme_tokens` table
    - Add `amm_account_id` (text) - The XRPL account ID of the AMM pool
    - Add `amm_lp_token_balance` (numeric) - The LP token balance in the pool
    - Add `amm_trading_fee` (integer) - The trading fee in basis points (e.g., 500 = 0.5%)

  2. Purpose
    These fields store comprehensive AMM pool information fetched directly from XRPL,
    ensuring accurate tracking and enabling proper integration with AMM functionality.

    - `amm_account_id`: Required to interact with the specific AMM instance
    - `amm_lp_token_balance`: Tracks the total LP tokens representing pool shares
    - `amm_trading_fee`: Stores the fee charged for swaps through this pool
*/

-- Add AMM pool extended fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'amm_account_id'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN amm_account_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'amm_lp_token_balance'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN amm_lp_token_balance numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'amm_trading_fee'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN amm_trading_fee integer;
  END IF;
END $$;

-- Add index on amm_account_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_meme_tokens_amm_account ON meme_tokens(amm_account_id);
