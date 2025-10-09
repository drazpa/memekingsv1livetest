/*
  # Add Token Price Cache

  1. Changes
    - Add price caching columns to meme_tokens table
    - These fields will store the latest price data fetched from XRPL
    - This allows instant display of prices without waiting for XRPL queries

  2. New Columns
    - `current_price` (decimal) - Current price in XRP
    - `amm_xrp_amount` (decimal) - Current XRP in AMM pool
    - `amm_asset_amount` (decimal) - Current token amount in AMM pool
    - `price_updated_at` (timestamptz) - Last time price was updated
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'current_price'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN current_price decimal DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'price_updated_at'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN price_updated_at timestamptz DEFAULT now();
  END IF;
END $$;