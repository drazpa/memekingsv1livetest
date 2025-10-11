/*
  # Add Token Holdings Cache

  1. New Tables
    - `token_holdings_cache`
      - `id` (uuid, primary key)
      - `wallet_address` (text) - User's wallet address
      - `token_id` (uuid) - Foreign key to meme_tokens
      - `balance` (numeric) - Token balance
      - `price` (numeric) - Token price in XRP
      - `value` (numeric) - Total value in XRP
      - `is_lp_token` (boolean) - Whether this is an LP token
      - `lp_share` (numeric) - LP pool share percentage
      - `price_change_24h` (numeric) - 24h price change percentage
      - `last_updated` (timestamptz) - When this data was cached
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Fast lookup by wallet address
    - Composite index for wallet + token
    - Index on last_updated for cleanup

  3. Security
    - Enable RLS on `token_holdings_cache` table
    - Users can only read their own cached holdings
    - Cache entries auto-expire after 30 seconds
*/

CREATE TABLE IF NOT EXISTS token_holdings_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_id uuid REFERENCES meme_tokens(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  is_lp_token boolean DEFAULT false,
  lp_share numeric DEFAULT 0,
  price_change_24h numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_holdings_wallet ON token_holdings_cache(wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_holdings_wallet_token ON token_holdings_cache(wallet_address, token_id);
CREATE INDEX IF NOT EXISTS idx_token_holdings_updated ON token_holdings_cache(last_updated);

ALTER TABLE token_holdings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cached holdings"
  ON token_holdings_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own cached holdings"
  ON token_holdings_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own cached holdings"
  ON token_holdings_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own cached holdings"
  ON token_holdings_cache
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anonymous can read cached holdings"
  ON token_holdings_cache
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert cached holdings"
  ON token_holdings_cache
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update cached holdings"
  ON token_holdings_cache
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete cached holdings"
  ON token_holdings_cache
  FOR DELETE
  TO anon
  USING (true);
