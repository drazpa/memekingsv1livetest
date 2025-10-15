/*
  # Token Creation Rewards System

  1. New Tables
    - `token_creation_rewards`
      - `id` (uuid, primary key)
      - `wallet_address` (text, indexed) - User wallet that created the token
      - `token_id` (uuid, references meme_tokens) - Token that was created
      - `reward_amount` (numeric) - Reward in XRP (0.10)
      - `claimed` (boolean) - Whether reward has been claimed
      - `claimed_at` (timestamptz) - When reward was claimed
      - `claim_tx_hash` (text) - Transaction hash of claim
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `token_creation_rewards` table
    - Add policies for users to view their own rewards
    - Add policies for claiming rewards

  3. Indexes
    - Index on wallet_address for fast lookups
    - Index on claimed status for filtering
    - Index on token_id for reference
*/

-- Create token_creation_rewards table
CREATE TABLE IF NOT EXISTS token_creation_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_id uuid REFERENCES meme_tokens(id) ON DELETE CASCADE,
  reward_amount numeric NOT NULL DEFAULT 0.10,
  claimed boolean DEFAULT false,
  claimed_at timestamptz,
  claim_tx_hash text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rewards_wallet ON token_creation_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_rewards_claimed ON token_creation_rewards(claimed);
CREATE INDEX IF NOT EXISTS idx_rewards_token ON token_creation_rewards(token_id);
CREATE INDEX IF NOT EXISTS idx_rewards_created ON token_creation_rewards(created_at);

-- Enable RLS
ALTER TABLE token_creation_rewards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own rewards
CREATE POLICY "Users can view own rewards"
  ON token_creation_rewards
  FOR SELECT
  TO authenticated
  USING (wallet_address = current_setting('request.jwt.claim.sub', true));

-- Policy: Allow anonymous users to view rewards by wallet address
CREATE POLICY "Anyone can view rewards by wallet"
  ON token_creation_rewards
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Users can update their own rewards (for claiming)
CREATE POLICY "Users can claim own rewards"
  ON token_creation_rewards
  FOR UPDATE
  TO authenticated
  USING (wallet_address = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (wallet_address = current_setting('request.jwt.claim.sub', true));

-- Policy: Allow anyone to update rewards (needed for claiming without auth)
CREATE POLICY "Anyone can update rewards"
  ON token_creation_rewards
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy: System can insert rewards
CREATE POLICY "System can insert rewards"
  ON token_creation_rewards
  FOR INSERT
  TO anon
  USING (true)
  WITH CHECK (true);
