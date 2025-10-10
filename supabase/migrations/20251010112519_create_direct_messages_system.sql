/*
  # Create Direct Messages System

  1. New Tables
    - `direct_messages`
      - `id` (uuid, primary key)
      - `from_wallet` (text) - Sender wallet address
      - `to_wallet` (text) - Recipient wallet address
      - `from_nickname` (text) - Sender nickname
      - `to_nickname` (text) - Recipient nickname
      - `message_type` (text) - 'text', 'image', 'tip'
      - `content` (text) - Message content
      - `image_url` (text, nullable)
      - `tip_data` (jsonb, nullable)
      - `is_read` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `dm_conversations`
      - `id` (uuid, primary key)
      - `participant_1` (text) - First participant wallet
      - `participant_2` (text) - Second participant wallet
      - `last_message` (text)
      - `last_message_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only see their own DMs
    - Users can send DMs to any wallet

  3. Indexes
    - Index on from_wallet and to_wallet for fast queries
    - Index on conversation participants
*/

-- Direct Messages Table
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  from_nickname text NOT NULL,
  to_nickname text NOT NULL,
  message_type text DEFAULT 'text',
  content text NOT NULL,
  image_url text,
  tip_data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_from_wallet ON direct_messages(from_wallet);
CREATE INDEX IF NOT EXISTS idx_dm_to_wallet ON direct_messages(to_wallet);
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(from_wallet, to_wallet);
CREATE INDEX IF NOT EXISTS idx_dm_created_at ON direct_messages(created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their DMs"
  ON direct_messages FOR SELECT
  USING (
    from_wallet = current_setting('app.wallet_address', true) OR
    to_wallet = current_setting('app.wallet_address', true)
  );

CREATE POLICY "Users can send DMs"
  ON direct_messages FOR INSERT
  WITH CHECK (from_wallet IS NOT NULL AND to_wallet IS NOT NULL);

CREATE POLICY "Users can update their received DMs"
  ON direct_messages FOR UPDATE
  USING (to_wallet = current_setting('app.wallet_address', true))
  WITH CHECK (to_wallet = current_setting('app.wallet_address', true));

-- DM Conversations Table
CREATE TABLE IF NOT EXISTS dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 text NOT NULL,
  participant_2 text NOT NULL,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(participant_1, participant_2)
);

CREATE INDEX IF NOT EXISTS idx_dm_conv_p1 ON dm_conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_dm_conv_p2 ON dm_conversations(participant_2);

ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations"
  ON dm_conversations FOR SELECT
  USING (true);

CREATE POLICY "Users can create conversations"
  ON dm_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update conversations"
  ON dm_conversations FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Remove extra chat rooms (keep only General)
DELETE FROM chat_rooms WHERE type != 'general';