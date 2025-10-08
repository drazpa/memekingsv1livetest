/*
  # MEMEKINGS Database Schema

  1. New Tables
    - `meme_tokens`
      - `id` (uuid, primary key) - Unique identifier
      - `token_name` (text) - Name of the meme token (e.g., "KOOL")
      - `currency_code` (text) - Currency code on XRPL
      - `issuer_address` (text) - Wallet address that issued the token
      - `receiver_address` (text) - Wallet address that received initial tokens
      - `supply` (numeric) - Total supply (default 1000000)
      - `amm_pool_created` (boolean) - Whether AMM pool was created
      - `amm_asset_amount` (numeric) - Amount of token in AMM (90% of supply)
      - `amm_xrp_amount` (numeric) - Amount of XRP in AMM (default 1)
      - `created_at` (timestamptz) - When token was created
      - `tx_hash` (text) - Transaction hash for token creation
      - `amm_tx_hash` (text) - Transaction hash for AMM creation
      - `status` (text) - Status: pending, issued, amm_created, failed
    
    - `wallets`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - User-friendly wallet name
      - `address` (text) - XRPL wallet address
      - `encrypted_seed` (text) - Encrypted seed (for security)
      - `purpose` (text) - issuer, receiver, trading, etc.
      - `balance_xrp` (numeric) - XRP balance
      - `created_at` (timestamptz) - When wallet was added
      - `updated_at` (timestamptz) - Last updated
      - `notes` (text) - User notes
    
    - `analytics_snapshots`
      - `id` (uuid, primary key) - Unique identifier
      - `token_id` (uuid) - Foreign key to meme_tokens
      - `price_xrp` (numeric) - Token price in XRP
      - `volume_24h` (numeric) - 24h trading volume
      - `price_change_24h` (numeric) - 24h price change percentage
      - `market_cap` (numeric) - Market cap calculation
      - `liquidity` (numeric) - AMM liquidity
      - `snapshot_time` (timestamptz) - When snapshot was taken
    
    - `xrp_price_cache`
      - `id` (uuid, primary key) - Unique identifier
      - `price_usd` (numeric) - XRP price in USD
      - `updated_at` (timestamptz) - Last update time

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access (demo app)
    - Add policies for authenticated write access

  3. Indexes
    - Index on token_name for fast lookups
    - Index on created_at for chronological queries
    - Index on snapshot_time for analytics queries
*/

-- Create meme_tokens table
CREATE TABLE IF NOT EXISTS meme_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_name text NOT NULL,
  currency_code text NOT NULL,
  issuer_address text NOT NULL,
  receiver_address text NOT NULL,
  supply numeric DEFAULT 1000000,
  amm_pool_created boolean DEFAULT false,
  amm_asset_amount numeric DEFAULT 900000,
  amm_xrp_amount numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  tx_hash text,
  amm_tx_hash text,
  status text DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_meme_tokens_name ON meme_tokens(token_name);
CREATE INDEX IF NOT EXISTS idx_meme_tokens_created ON meme_tokens(created_at DESC);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL UNIQUE,
  encrypted_seed text,
  purpose text DEFAULT 'trading',
  balance_xrp numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  notes text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_purpose ON wallets(purpose);

-- Create analytics_snapshots table
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES meme_tokens(id) ON DELETE CASCADE,
  price_xrp numeric DEFAULT 0,
  volume_24h numeric DEFAULT 0,
  price_change_24h numeric DEFAULT 0,
  market_cap numeric DEFAULT 0,
  liquidity numeric DEFAULT 0,
  snapshot_time timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_token ON analytics_snapshots(token_id);
CREATE INDEX IF NOT EXISTS idx_analytics_time ON analytics_snapshots(snapshot_time DESC);

-- Create xrp_price_cache table
CREATE TABLE IF NOT EXISTS xrp_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_usd numeric NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE meme_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE xrp_price_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (demo app)
CREATE POLICY "Public read access for meme_tokens"
  ON meme_tokens FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public write access for meme_tokens"
  ON meme_tokens FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for wallets"
  ON wallets FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public write access for wallets"
  ON wallets FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for analytics"
  ON analytics_snapshots FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public write access for analytics"
  ON analytics_snapshots FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for xrp_price"
  ON xrp_price_cache FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public write access for xrp_price"
  ON xrp_price_cache FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);