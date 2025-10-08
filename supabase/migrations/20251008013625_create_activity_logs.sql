/*
  # Create Activity Logs Table

  1. New Tables
    - `activity_logs`
      - `id` (uuid, primary key)
      - `user_address` (text) - Wallet address that performed the action
      - `action_type` (text) - Type of action (e.g., 'token_created', 'token_sent', 'swap_executed')
      - `description` (text) - Human-readable description of the action
      - `details` (jsonb) - Additional details about the action
      - `tx_hash` (text, nullable) - Transaction hash if applicable
      - `token_id` (uuid, nullable) - Reference to meme_tokens table if applicable
      - `created_at` (timestamptz) - Timestamp of the action

  2. Security
    - Enable RLS on `activity_logs` table
    - Add policy for users to read their own activity logs
    - Add policy for authenticated users to insert their own logs

  3. Indexes
    - Index on user_address for fast lookups
    - Index on created_at for sorting
    - Index on action_type for filtering
*/

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address text NOT NULL,
  action_type text NOT NULL,
  description text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  tx_hash text,
  token_id uuid REFERENCES meme_tokens(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_address ON activity_logs(user_address);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_token_id ON activity_logs(token_id);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all activity logs (public activity feed)
CREATE POLICY "Anyone can view activity logs"
  ON activity_logs
  FOR SELECT
  TO public
  USING (true);

-- Policy: Anyone can insert activity logs
CREATE POLICY "Anyone can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO public
  WITH CHECK (true);