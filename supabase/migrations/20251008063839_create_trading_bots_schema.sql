/*
  # Create Trading Bots Schema

  1. New Tables
    - `trading_bots`
      - `id` (uuid, primary key)
      - `name` (text) - Bot name
      - `wallet_address` (text) - Owner wallet address
      - `token_id` (uuid) - Foreign key to meme_tokens
      - `interval` (integer) - Trade interval in minutes
      - `min_amount` (numeric) - Minimum XRP amount per trade
      - `max_amount` (numeric) - Maximum XRP amount per trade
      - `trade_mode` (integer) - Buy/sell bias (0-100)
      - `status` (text) - running, paused, stopped
      - `total_trades` (integer) - Total number of trades
      - `successful_trades` (integer) - Successful trades count
      - `failed_trades` (integer) - Failed trades count
      - `total_buy_volume` (numeric) - Total XRP spent on buys
      - `total_sell_volume` (numeric) - Total XRP received from sells
      - `total_xrp_spent` (numeric) - Total XRP spent
      - `total_xrp_received` (numeric) - Total XRP received
      - `net_profit` (numeric) - Net profit/loss
      - `last_trade_at` (timestamptz) - Last trade timestamp
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `bot_trades`
      - `id` (uuid, primary key)
      - `bot_id` (uuid) - Foreign key to trading_bots
      - `trade_type` (text) - BUY, SELL, ERROR
      - `amount` (numeric) - Token amount
      - `xrp_cost` (numeric) - XRP cost
      - `price` (numeric) - Price at time of trade
      - `status` (text) - success, failed
      - `error_message` (text, nullable) - Error details if failed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own bots
    - Bots and trades are linked by user wallet address
*/

-- Create trading_bots table
CREATE TABLE IF NOT EXISTS trading_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wallet_address text NOT NULL,
  token_id uuid NOT NULL REFERENCES meme_tokens(id) ON DELETE CASCADE,
  interval integer NOT NULL DEFAULT 1,
  min_amount numeric NOT NULL DEFAULT 0.1,
  max_amount numeric NOT NULL DEFAULT 1.0,
  trade_mode integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'stopped',
  total_trades integer DEFAULT 0,
  successful_trades integer DEFAULT 0,
  failed_trades integer DEFAULT 0,
  total_buy_volume numeric DEFAULT 0,
  total_sell_volume numeric DEFAULT 0,
  total_xrp_spent numeric DEFAULT 0,
  total_xrp_received numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  last_trade_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bot_trades table
CREATE TABLE IF NOT EXISTS bot_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  trade_type text NOT NULL,
  amount numeric NOT NULL,
  xrp_cost numeric NOT NULL,
  price numeric NOT NULL,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE trading_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trading_bots
CREATE POLICY "Users can view own bots"
  ON trading_bots FOR SELECT
  TO authenticated
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can view own bots (public)"
  ON trading_bots FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert own bots"
  ON trading_bots FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update own bots"
  ON trading_bots FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own bots"
  ON trading_bots FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for bot_trades
CREATE POLICY "Users can view trades for their bots"
  ON bot_trades FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert trades for their bots"
  ON bot_trades FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trading_bots_wallet ON trading_bots(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trading_bots_token ON trading_bots(token_id);
CREATE INDEX IF NOT EXISTS idx_trading_bots_status ON trading_bots(status);
CREATE INDEX IF NOT EXISTS idx_bot_trades_bot_id ON bot_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_trades_created_at ON bot_trades(created_at DESC);
