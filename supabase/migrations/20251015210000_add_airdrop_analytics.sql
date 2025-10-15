/*
  # Add Enhanced Airdrop Analytics

  1. New Tables
    - `airdrop_transactions`
      - Individual transaction records for each token sent
      - Links to recipient and campaign
      - Detailed fee and amount tracking

  2. Changes to Existing Tables
    - Add total transaction count to campaigns
    - Add fee per token to track multi-token fees
    - Add detailed timing metrics

  3. Purpose
    - Track every individual token transaction
    - Calculate accurate fees (0.01 XRP per token per recipient)
    - Provide granular analytics per campaign
*/

-- Airdrop Transactions Table (individual token transactions)
CREATE TABLE IF NOT EXISTS airdrop_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES airdrop_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES airdrop_recipients(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES airdrop_tokens(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  fee_xrp numeric NOT NULL DEFAULT 0.01,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Add new fields to campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'airdrop_campaigns' AND column_name = 'total_transactions'
  ) THEN
    ALTER TABLE airdrop_campaigns ADD COLUMN total_transactions integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'airdrop_campaigns' AND column_name = 'completed_transactions'
  ) THEN
    ALTER TABLE airdrop_campaigns ADD COLUMN completed_transactions integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'airdrop_campaigns' AND column_name = 'failed_transactions'
  ) THEN
    ALTER TABLE airdrop_campaigns ADD COLUMN failed_transactions integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'airdrop_campaigns' AND column_name = 'total_fees_paid'
  ) THEN
    ALTER TABLE airdrop_campaigns ADD COLUMN total_fees_paid numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'airdrop_campaigns' AND column_name = 'average_tx_time'
  ) THEN
    ALTER TABLE airdrop_campaigns ADD COLUMN average_tx_time numeric;
  END IF;
END $$;

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_campaign ON airdrop_transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient ON airdrop_transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_token ON airdrop_transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON airdrop_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON airdrop_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE airdrop_transactions ENABLE ROW LEVEL SECURITY;

-- Transactions Policies
CREATE POLICY "Users can view transactions"
  ON airdrop_transactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert transactions"
  ON airdrop_transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update transactions"
  ON airdrop_transactions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
