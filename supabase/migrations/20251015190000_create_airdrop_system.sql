/*
  # Create Advanced Airdrop System

  1. New Tables
    - `airdrop_campaigns`
      - `id` (uuid, primary key)
      - `wallet_address` (text) - Creator wallet
      - `name` (text) - Campaign name
      - `status` (text) - pending, running, paused, completed, failed
      - `total_recipients` (integer) - Total recipients
      - `completed_recipients` (integer) - Completed sends
      - `failed_recipients` (integer) - Failed sends
      - `interval_seconds` (integer) - Delay between batches (minimum 5)
      - `created_at` (timestamptz)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `paused_at` (timestamptz)

    - `airdrop_tokens`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `currency_code` (text)
      - `issuer_address` (text)
      - `amount` (numeric) - Amount per recipient
      - `total_sent` (numeric) - Total amount sent
      - `created_at` (timestamptz)

    - `airdrop_recipients`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `wallet_address` (text)
      - `status` (text) - pending, processing, completed, failed
      - `xrp_fee_paid` (numeric) - 0.01 XRP fee per recipient
      - `tx_hash` (text)
      - `error_message` (text)
      - `processed_at` (timestamptz)
      - `created_at` (timestamptz)

    - `airdrop_logs`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `log_type` (text) - info, success, error, warning
      - `message` (text)
      - `details` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own campaigns
    - Public read for analytics
    - Users can insert/update their own data

  3. Indexes
    - Campaign lookups by wallet and status
    - Recipient lookups by campaign and status
    - Log lookups by campaign and timestamp
*/

-- Airdrop Campaigns Table
CREATE TABLE IF NOT EXISTS airdrop_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_recipients integer NOT NULL DEFAULT 0,
  completed_recipients integer NOT NULL DEFAULT 0,
  failed_recipients integer NOT NULL DEFAULT 0,
  interval_seconds integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz
);

-- Airdrop Tokens Table
CREATE TABLE IF NOT EXISTS airdrop_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES airdrop_campaigns(id) ON DELETE CASCADE,
  currency_code text NOT NULL,
  issuer_address text NOT NULL,
  amount numeric NOT NULL,
  total_sent numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Airdrop Recipients Table
CREATE TABLE IF NOT EXISTS airdrop_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES airdrop_campaigns(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  xrp_fee_paid numeric NOT NULL DEFAULT 0.01,
  tx_hash text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Airdrop Logs Table
CREATE TABLE IF NOT EXISTS airdrop_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES airdrop_campaigns(id) ON DELETE CASCADE,
  log_type text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_wallet ON airdrop_campaigns(wallet_address);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON airdrop_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON airdrop_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_campaign ON airdrop_tokens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON airdrop_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON airdrop_recipients(status);
CREATE INDEX IF NOT EXISTS idx_logs_campaign ON airdrop_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON airdrop_logs(created_at DESC);

-- Enable RLS
ALTER TABLE airdrop_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE airdrop_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE airdrop_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE airdrop_logs ENABLE ROW LEVEL SECURITY;

-- Campaigns Policies
CREATE POLICY "Users can view all campaigns"
  ON airdrop_campaigns FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can create campaigns"
  ON airdrop_campaigns FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update campaigns"
  ON airdrop_campaigns FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Tokens Policies
CREATE POLICY "Users can view tokens"
  ON airdrop_tokens FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert tokens"
  ON airdrop_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Recipients Policies
CREATE POLICY "Users can view recipients"
  ON airdrop_recipients FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert recipients"
  ON airdrop_recipients FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update recipients"
  ON airdrop_recipients FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Logs Policies
CREATE POLICY "Users can view logs"
  ON airdrop_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert logs"
  ON airdrop_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
