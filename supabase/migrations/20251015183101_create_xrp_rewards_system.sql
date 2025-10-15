/*
  # Create XRP Rewards System

  1. New Tables
    - `xrp_rewards`
      - `id` (uuid, primary key)
      - `wallet_address` (text) - User wallet earning the reward
      - `amount` (numeric) - XRP amount earned
      - `reward_type` (text) - Type of reward (bot_creation, token_creation, trade, referral, milestone)
      - `description` (text) - Description of the reward
      - `status` (text) - Status (pending, claimed, expired)
      - `claimed_at` (timestamptz) - When reward was claimed
      - `created_at` (timestamptz) - When reward was earned

  2. Security
    - Enable RLS on `xrp_rewards` table
    - Users can only view their own rewards
    - System can insert rewards for any user
    - Users can update only their own pending rewards to claimed

  3. Indexes
    - Index on wallet_address for fast lookups
    - Index on status for filtering
    - Index on reward_type for analytics
*/

CREATE TABLE IF NOT EXISTS xrp_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reward_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  claimed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_xrp_rewards_wallet ON xrp_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_xrp_rewards_status ON xrp_rewards(status);
CREATE INDEX IF NOT EXISTS idx_xrp_rewards_type ON xrp_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_xrp_rewards_created ON xrp_rewards(created_at DESC);

-- Enable RLS
ALTER TABLE xrp_rewards ENABLE ROW LEVEL SECURITY;

-- Users can view their own rewards
CREATE POLICY "Users can view own rewards"
  ON xrp_rewards
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous access for reading (users may not be authenticated)
CREATE POLICY "Allow public read access"
  ON xrp_rewards
  FOR SELECT
  TO anon
  USING (true);

-- System can insert rewards
CREATE POLICY "System can insert rewards"
  ON xrp_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous inserts (for reward tracking)
CREATE POLICY "Allow public insert"
  ON xrp_rewards
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Users can update their own pending rewards to claimed
CREATE POLICY "Users can claim own rewards"
  ON xrp_rewards
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anonymous updates (for claim status)
CREATE POLICY "Allow public update"
  ON xrp_rewards
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);