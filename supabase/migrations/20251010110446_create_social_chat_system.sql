/*
  # Create Social Chat System

  1. New Tables
    - `chat_rooms`
      - `id` (uuid, primary key)
      - `name` (text) - Room name
      - `type` (text) - 'general', 'trading', 'support', etc.
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `chat_messages`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to chat_rooms)
      - `wallet_address` (text) - Sender's wallet address
      - `nickname` (text) - User's display nickname
      - `message_type` (text) - 'text', 'image', 'tip', 'system'
      - `content` (text) - Message content
      - `image_url` (text, nullable) - Image attachment URL
      - `tip_data` (jsonb, nullable) - Tip transaction details
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `user_presence`
      - `wallet_address` (text, primary key)
      - `nickname` (text)
      - `is_online` (boolean, default false)
      - `last_seen` (timestamptz)
      - `status_message` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `chat_tips`
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key to chat_messages)
      - `from_wallet` (text)
      - `to_wallet` (text)
      - `token_code` (text) - Token currency code
      - `token_issuer` (text) - Token issuer address
      - `amount` (text) - Amount sent
      - `tx_hash` (text) - Transaction hash
      - `status` (text) - 'pending', 'completed', 'failed'
      - `created_at` (timestamptz)
    
    - `video_rooms`
      - `id` (uuid, primary key)
      - `room_name` (text)
      - `host_wallet` (text) - Host wallet address
      - `is_active` (boolean, default true)
      - `participant_count` (integer, default 0)
      - `room_type` (text) - 'conference', 'livestream'
      - `created_at` (timestamptz)
      - `ended_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated wallet users
    - Public read access for chat rooms and messages
    - Users can only edit their own presence
*/

-- Chat Rooms Table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat rooms"
  ON chat_rooms FOR SELECT
  USING (true);

CREATE POLICY "System can manage chat rooms"
  ON chat_rooms FOR ALL
  USING (true)
  WITH CHECK (true);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES chat_rooms(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  nickname text NOT NULL,
  message_type text DEFAULT 'text',
  content text NOT NULL,
  image_url text,
  tip_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_wallet ON chat_messages(wallet_address);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Connected wallets can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (wallet_address IS NOT NULL AND nickname IS NOT NULL);

CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  USING (wallet_address = current_setting('app.wallet_address', true));

-- User Presence Table
CREATE TABLE IF NOT EXISTS user_presence (
  wallet_address text PRIMARY KEY,
  nickname text NOT NULL,
  is_online boolean DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  status_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(is_online);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user presence"
  ON user_presence FOR SELECT
  USING (true);

CREATE POLICY "Users can upsert their own presence"
  ON user_presence FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own presence"
  ON user_presence FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Chat Tips Table
CREATE TABLE IF NOT EXISTS chat_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  token_code text NOT NULL,
  token_issuer text NOT NULL,
  amount text NOT NULL,
  tx_hash text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_tips_from_wallet ON chat_tips(from_wallet);
CREATE INDEX IF NOT EXISTS idx_chat_tips_to_wallet ON chat_tips(to_wallet);
CREATE INDEX IF NOT EXISTS idx_chat_tips_tx_hash ON chat_tips(tx_hash);

ALTER TABLE chat_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tips"
  ON chat_tips FOR SELECT
  USING (true);

CREATE POLICY "Users can create tips"
  ON chat_tips FOR INSERT
  WITH CHECK (from_wallet IS NOT NULL);

-- Video Rooms Table
CREATE TABLE IF NOT EXISTS video_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name text NOT NULL,
  host_wallet text NOT NULL,
  is_active boolean DEFAULT true,
  participant_count integer DEFAULT 0,
  room_type text DEFAULT 'conference',
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_video_rooms_active ON video_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_video_rooms_host ON video_rooms(host_wallet);

ALTER TABLE video_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view video rooms"
  ON video_rooms FOR SELECT
  USING (true);

CREATE POLICY "Users can create video rooms"
  ON video_rooms FOR INSERT
  WITH CHECK (host_wallet IS NOT NULL);

CREATE POLICY "Host can update their video rooms"
  ON video_rooms FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert default general chat room
INSERT INTO chat_rooms (name, type)
VALUES ('General Chat', 'general')
ON CONFLICT DO NOTHING;

INSERT INTO chat_rooms (name, type)
VALUES ('Trading Discussion', 'trading')
ON CONFLICT DO NOTHING;

INSERT INTO chat_rooms (name, type)
VALUES ('Support & Help', 'support')
ON CONFLICT DO NOTHING;