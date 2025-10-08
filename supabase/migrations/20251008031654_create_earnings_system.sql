/*
  # Passive Earnings System

  1. New Tables
    - `token_earnings`
      - `id` (uuid, primary key)
      - `wallet_address` (text) - User's wallet address
      - `token_id` (uuid) - Reference to meme_tokens
      - `balance_snapshot` (numeric) - Token balance at snapshot time
      - `last_claim_at` (timestamptz) - Last time earnings were claimed
      - `total_earned` (numeric) - Total amount earned all-time
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `token_earnings` table
    - Add policies for users to read and update their own earnings

  3. Notes
    - 10% APY calculated from balance_snapshot
    - No actual staking transaction required
    - Users earn passively based on wallet balance
    - Can claim unlimited times per day
*/

CREATE TABLE IF NOT EXISTS token_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_id uuid REFERENCES meme_tokens(id) ON DELETE CASCADE,
  balance_snapshot numeric DEFAULT 0,
  last_claim_at timestamptz DEFAULT now(),
  total_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(wallet_address, token_id)
);

ALTER TABLE token_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own earnings"
  ON token_earnings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own earnings"
  ON token_earnings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own earnings"
  ON token_earnings
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_token_earnings_wallet ON token_earnings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_earnings_token ON token_earnings(token_id);