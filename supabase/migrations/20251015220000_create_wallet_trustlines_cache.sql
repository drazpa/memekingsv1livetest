/*
  # Create wallet trustlines cache table

  1. New Tables
    - `wallet_trustlines`
      - `id` (uuid, primary key)
      - `wallet_address` (text, wallet address)
      - `token_id` (uuid, foreign key to meme_tokens)
      - `currency` (text, currency hex code)
      - `issuer` (text, issuer address)
      - `has_trustline` (boolean, whether trustline exists)
      - `last_checked` (timestamptz, when last checked)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on wallet_trustlines table
    - Public read access for caching
    - No write policies needed (app manages cache)

  3. Indexes
    - Unique index on wallet_address + token_id
    - Index on last_checked for cleanup queries
*/

CREATE TABLE IF NOT EXISTS wallet_trustlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_id uuid REFERENCES meme_tokens(id) ON DELETE CASCADE,
  currency text NOT NULL,
  issuer text NOT NULL,
  has_trustline boolean NOT NULL DEFAULT false,
  last_checked timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(wallet_address, token_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_trustlines_wallet ON wallet_trustlines(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_trustlines_token ON wallet_trustlines(token_id);
CREATE INDEX IF NOT EXISTS idx_wallet_trustlines_last_checked ON wallet_trustlines(last_checked);

ALTER TABLE wallet_trustlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for trustlines cache"
  ON wallet_trustlines
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert access for trustlines cache"
  ON wallet_trustlines
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public update access for trustlines cache"
  ON wallet_trustlines
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
