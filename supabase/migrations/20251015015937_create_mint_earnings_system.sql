/*
  # Mint Earnings System

  1. New Tables
    - `mint_earnings`
      - `id` (uuid, primary key) - Unique identifier for each earning record
      - `wallet_address` (text, NOT NULL) - Receiver wallet that earned XRP
      - `token_id` (uuid) - Reference to the token that was minted
      - `amount` (numeric, DEFAULT 0.10) - Amount earned (0.10 XRP per mint)
      - `claimed` (boolean, DEFAULT false) - Whether earnings have been claimed
      - `claimed_at` (timestamptz) - When the earnings were claimed
      - `created_at` (timestamptz, DEFAULT now()) - When the earning was recorded
      - `tx_hash` (text) - Transaction hash of the claim transaction

  2. Security
    - Enable RLS on `mint_earnings` table
    - Add policies for public read access
    - Add policies for update when claiming

  3. Notes
    - Each token mint creates a 0.10 XRP earning record
    - Receiver wallet earns the 0.10 XRP per mint
    - Connected wallet can claim accumulated unclaimed earnings
    - Earnings tracked per wallet for analytics and charts
*/

CREATE TABLE IF NOT EXISTS mint_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_id uuid REFERENCES meme_tokens(id) ON DELETE SET NULL,
  amount numeric DEFAULT 0.10 NOT NULL,
  claimed boolean DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  tx_hash text
);

ALTER TABLE mint_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mint earnings"
  ON mint_earnings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert mint earnings"
  ON mint_earnings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update mint earnings"
  ON mint_earnings
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mint_earnings_wallet ON mint_earnings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_mint_earnings_claimed ON mint_earnings(claimed);
CREATE INDEX IF NOT EXISTS idx_mint_earnings_wallet_claimed ON mint_earnings(wallet_address, claimed);
CREATE INDEX IF NOT EXISTS idx_mint_earnings_created_at ON mint_earnings(created_at DESC);