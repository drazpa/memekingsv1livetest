/*
  # Scheduled Streams

  1. New Tables
    - `scheduled_streams`
      - `id` (uuid, primary key)
      - `wallet_address` (text) - streamer's wallet
      - `nickname` (text) - streamer's name
      - `title` (text) - stream title
      - `description` (text) - stream description
      - `category` (text) - stream category
      - `scheduled_at` (timestamptz) - when stream starts
      - `duration_minutes` (integer) - expected duration
      - `is_active` (boolean) - whether scheduled
      - `is_cancelled` (boolean) - if cancelled
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on scheduled_streams table
    - Public can view scheduled streams
    - Users can create/update own schedules
*/

CREATE TABLE IF NOT EXISTS scheduled_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nickname text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'Just Chatting',
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  is_active boolean DEFAULT true,
  is_cancelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_streams_wallet ON scheduled_streams(wallet_address);
CREATE INDEX IF NOT EXISTS idx_scheduled_streams_scheduled_at ON scheduled_streams(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_streams_active ON scheduled_streams(is_active, is_cancelled);

ALTER TABLE scheduled_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled streams"
  ON scheduled_streams FOR SELECT
  USING (true);

CREATE POLICY "Users can create own schedules"
  ON scheduled_streams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own schedules"
  ON scheduled_streams FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own schedules"
  ON scheduled_streams FOR DELETE
  USING (true);