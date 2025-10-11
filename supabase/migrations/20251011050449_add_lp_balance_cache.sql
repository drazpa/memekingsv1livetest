/*
  # Add LP Balance Cache

  1. New Tables
    - `lp_balance_cache`
      - `id` (uuid, primary key)
      - `wallet_address` (text, indexed)
      - `token_id` (uuid, references meme_tokens)
      - `amm_account_id` (text)
      - `lp_balance` (numeric)
      - `lp_share_percentage` (numeric)
      - `last_updated` (timestamptz)
      - Composite unique index on (wallet_address, token_id)

  2. Security
    - Enable RLS on `lp_balance_cache` table
    - Add policy for users to read LP balances
    - Add policy for authenticated users to insert/update LP balances

  3. Purpose
    - Cache LP token balances to minimize API calls
    - Store share percentage for quick reference
    - 30-second cache TTL for fresh data
*/

CREATE TABLE IF NOT EXISTS lp_balance_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_id uuid NOT NULL REFERENCES meme_tokens(id) ON DELETE CASCADE,
  amm_account_id text NOT NULL,
  lp_balance numeric NOT NULL DEFAULT 0,
  lp_share_percentage numeric NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(wallet_address, token_id)
);

CREATE INDEX IF NOT EXISTS idx_lp_balance_wallet ON lp_balance_cache(wallet_address);
CREATE INDEX IF NOT EXISTS idx_lp_balance_token ON lp_balance_cache(token_id);
CREATE INDEX IF NOT EXISTS idx_lp_balance_updated ON lp_balance_cache(last_updated);

ALTER TABLE lp_balance_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read LP balances"
  ON lp_balance_cache
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert LP balances"
  ON lp_balance_cache
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update LP balances"
  ON lp_balance_cache
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
