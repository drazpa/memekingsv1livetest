/*
  # Add Token Holders Cache

  1. New Tables
    - `token_holders`
      - `id` (uuid, primary key)
      - `token_id` (uuid, foreign key to meme_tokens)
      - `holder_address` (text) - Wallet address of the holder
      - `balance` (numeric) - Token balance held
      - `percentage` (numeric) - Percentage of total supply held
      - `is_developer_wallet` (boolean) - Whether this is the receiver/dev wallet
      - `rank` (integer) - Holder rank by balance
      - `last_updated` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `token_holders` table
    - Add policy for public read access to holder data
    - This data is public blockchain information

  3. Indexes
    - Index on token_id for fast lookups
    - Index on holder_address for searching
    - Index on rank for sorted queries

  4. Notes
    - Data is cached from XRPL for performance
    - Updated periodically via background jobs or manual refresh
    - Developer wallet is flagged for special display
*/

CREATE TABLE IF NOT EXISTS token_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES meme_tokens(id) ON DELETE CASCADE,
  holder_address text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  is_developer_wallet boolean DEFAULT false,
  rank integer NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(token_id, holder_address)
);

ALTER TABLE token_holders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view token holders"
  ON token_holders
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert holders"
  ON token_holders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update holders"
  ON token_holders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_token_holders_token_id ON token_holders(token_id);
CREATE INDEX IF NOT EXISTS idx_token_holders_address ON token_holders(holder_address);
CREATE INDEX IF NOT EXISTS idx_token_holders_rank ON token_holders(token_id, rank);
CREATE INDEX IF NOT EXISTS idx_token_holders_percentage ON token_holders(token_id, percentage DESC);
