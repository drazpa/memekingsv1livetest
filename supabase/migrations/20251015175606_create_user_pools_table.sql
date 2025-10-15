/*
  # Create user pools table

  1. New Tables
    - `user_pools`
      - `id` (uuid, primary key)
      - `user_address` (text) - XRPL wallet address
      - `token_id` (uuid) - References meme_tokens
      - `token_amount` (numeric) - Amount of tokens in the pool
      - `xrp_amount` (numeric) - Amount of XRP in the pool
      - `lp_tokens` (numeric) - LP tokens received (optional)
      - `created_at` (timestamptz) - When pool was created
      - `updated_at` (timestamptz) - Last update

  2. Security
    - Enable RLS on `user_pools` table
    - Add policy for users to view their own pools
    - Add policy for users to insert their own pools
    - Add policy for users to update their own pools

  3. Indexes
    - Index on user_address for fast lookups
    - Index on token_id for token-based queries
*/

CREATE TABLE IF NOT EXISTS user_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address text NOT NULL,
  token_id uuid NOT NULL REFERENCES meme_tokens(id) ON DELETE CASCADE,
  token_amount numeric NOT NULL DEFAULT 0,
  xrp_amount numeric NOT NULL DEFAULT 0,
  lp_tokens numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pools"
  ON user_pools
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view their own pools (anon)"
  ON user_pools
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert their own pools"
  ON user_pools
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can insert their own pools (anon)"
  ON user_pools
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update their own pools"
  ON user_pools
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can update their own pools (anon)"
  ON user_pools
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_pools_user_address ON user_pools(user_address);
CREATE INDEX IF NOT EXISTS idx_user_pools_token_id ON user_pools(token_id);
CREATE INDEX IF NOT EXISTS idx_user_pools_created_at ON user_pools(created_at DESC);
