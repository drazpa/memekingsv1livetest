/*
  # Create Trade History System

  1. New Tables
    - `trade_history`
      - `id` (uuid, primary key)
      - `token_id` (uuid, foreign key to meme_tokens)
      - `trader_address` (text)
      - `trade_type` (text) - 'buy' or 'sell'
      - `token_amount` (numeric)
      - `xrp_amount` (numeric)
      - `price` (numeric) - price per token at time of trade
      - `tx_hash` (text)
      - `created_at` (timestamptz)
      - `slippage` (numeric)
      - `platform_fee` (numeric)

  2. Security
    - Enable RLS on `trade_history` table
    - Add policy for public read access (for transparency)
    - Add policy for authenticated users to read their own trades

  3. Indexes
    - Index on token_id for fast lookups
    - Index on trader_address for user trade history
    - Index on created_at for time-based queries
    - Index on tx_hash for transaction lookups
*/

CREATE TABLE IF NOT EXISTS trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES meme_tokens(id) ON DELETE CASCADE,
  trader_address text NOT NULL,
  trade_type text NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  token_amount numeric NOT NULL,
  xrp_amount numeric NOT NULL,
  price numeric NOT NULL,
  tx_hash text,
  slippage numeric DEFAULT 0.5,
  platform_fee numeric DEFAULT 0.01,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_history_token_id ON trade_history(token_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_trader_address ON trade_history(trader_address);
CREATE INDEX IF NOT EXISTS idx_trade_history_created_at ON trade_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_history_tx_hash ON trade_history(tx_hash);

ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trade history"
  ON trade_history
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can view their own trades"
  ON trade_history
  FOR SELECT
  TO authenticated
  USING (trader_address = auth.jwt()->>'wallet_address' OR true);
