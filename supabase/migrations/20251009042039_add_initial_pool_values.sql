/*
  # Add Initial Pool Values for Price Change Calculation

  1. Changes
    - Add `initial_xrp_amount` column to store the starting XRP amount in the pool
    - Add `initial_asset_amount` column to store the starting token amount in the pool
    - Copy existing `amm_xrp_amount` and `amm_asset_amount` values to the new columns
    - These initial values will NEVER be updated, only used for calculating % change

  2. Purpose
    - Enable accurate 24h price change calculations by comparing current live price 
      against the initial pool creation price
    - Current `amm_xrp_amount` and `amm_asset_amount` can be updated with live values
      without losing the baseline for percentage calculations
*/

-- Add new columns for initial pool values
ALTER TABLE meme_tokens 
ADD COLUMN IF NOT EXISTS initial_xrp_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS initial_asset_amount numeric DEFAULT 0;

-- Copy existing values to initial columns for all tokens with AMM pools
UPDATE meme_tokens 
SET 
  initial_xrp_amount = COALESCE(amm_xrp_amount, 0),
  initial_asset_amount = COALESCE(amm_asset_amount, 0)
WHERE amm_pool_created = true 
  AND (initial_xrp_amount = 0 OR initial_xrp_amount IS NULL);
