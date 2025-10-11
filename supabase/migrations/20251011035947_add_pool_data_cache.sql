/*
  # Add Pool Data Cache for AMM Pools

  1. New Tables
    - `pool_data_cache`
      - `id` (uuid, primary key)
      - `token_id` (uuid) - Foreign key to meme_tokens
      - `xrp_amount` (numeric) - XRP in pool
      - `token_amount` (numeric) - Token amount in pool
      - `lp_tokens` (numeric) - Total LP tokens
      - `price` (numeric) - Token price in XRP
      - `account_id` (text) - AMM account ID
      - `volume_24h` (numeric) - 24h trading volume
      - `price_change_24h` (numeric) - 24h price change %
      - `last_updated` (timestamptz) - When cached
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Fast lookup by token_id
    - Index on last_updated for cleanup

  3. Security
    - Enable RLS with public read access
    - Data expires after 30 seconds
*/

CREATE TABLE IF NOT EXISTS pool_data_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid UNIQUE REFERENCES meme_tokens(id) ON DELETE CASCADE,
  xrp_amount numeric NOT NULL DEFAULT 0,
  token_amount numeric NOT NULL DEFAULT 0,
  lp_tokens numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  account_id text NOT NULL,
  volume_24h numeric DEFAULT 0,
  price_change_24h numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pool_cache_token ON pool_data_cache(token_id);
CREATE INDEX IF NOT EXISTS idx_pool_cache_updated ON pool_data_cache(last_updated);

ALTER TABLE pool_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pool cache"
  ON pool_data_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert pool cache"
  ON pool_data_cache
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update pool cache"
  ON pool_data_cache
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete pool cache"
  ON pool_data_cache
  FOR DELETE
  TO anon, authenticated
  USING (true);
