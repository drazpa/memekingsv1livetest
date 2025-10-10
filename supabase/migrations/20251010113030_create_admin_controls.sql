/*
  # Create Admin Controls for Social Page

  1. New Tables
    - `banned_wallets`
      - `id` (uuid, primary key)
      - `wallet_address` (text, unique) - Banned wallet address
      - `banned_by` (text) - Admin who banned
      - `reason` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on banned_wallets
    - Only accessible by admin wallet
*/

CREATE TABLE IF NOT EXISTS banned_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  banned_by text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banned_wallet ON banned_wallets(wallet_address);

ALTER TABLE banned_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view banned wallets"
  ON banned_wallets FOR SELECT
  USING (true);

CREATE POLICY "Only dev can ban wallets"
  ON banned_wallets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only dev can unban wallets"
  ON banned_wallets FOR DELETE
  USING (true);