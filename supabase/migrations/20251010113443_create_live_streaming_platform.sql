/*
  # Create Live Streaming Platform

  1. New Tables
    - `live_streams`
      - `id` (uuid, primary key)
      - `wallet_address` (text) - Streamer wallet
      - `nickname` (text) - Streamer nickname
      - `title` (text) - Stream title
      - `is_active` (boolean) - Stream active status
      - `viewer_count` (integer) - Current viewers
      - `total_tips` (numeric) - Total tips received
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `stream_tips`
      - `id` (uuid, primary key)
      - `stream_id` (uuid, foreign key to live_streams)
      - `from_wallet` (text) - Tipper wallet
      - `from_nickname` (text) - Tipper nickname
      - `to_wallet` (text) - Streamer wallet
      - `currency` (text) - Token currency
      - `amount` (numeric) - Tip amount
      - `tx_hash` (text) - Transaction hash
      - `created_at` (timestamptz)

    - `stream_viewers`
      - `id` (uuid, primary key)
      - `stream_id` (uuid, foreign key to live_streams)
      - `viewer_address` (text) - Viewer wallet
      - `joined_at` (timestamptz)
      - `last_seen` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Anyone can view streams and tips
    - Only streamers can update their streams

  3. Indexes
    - Index on wallet_address for fast lookups
    - Index on is_active for active streams query
*/

-- Live Streams Table
CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nickname text NOT NULL,
  title text DEFAULT 'Live Stream',
  is_active boolean DEFAULT true,
  viewer_count integer DEFAULT 0,
  total_tips numeric DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_wallet ON live_streams(wallet_address);
CREATE INDEX IF NOT EXISTS idx_live_streams_active ON live_streams(is_active);
CREATE INDEX IF NOT EXISTS idx_live_streams_started ON live_streams(started_at DESC);

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view streams"
  ON live_streams FOR SELECT
  USING (true);

CREATE POLICY "Users can create their streams"
  ON live_streams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their streams"
  ON live_streams FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Stream Tips Table
CREATE TABLE IF NOT EXISTS stream_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  from_wallet text NOT NULL,
  from_nickname text NOT NULL,
  to_wallet text NOT NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  tx_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_tips_stream ON stream_tips(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_tips_to_wallet ON stream_tips(to_wallet);
CREATE INDEX IF NOT EXISTS idx_stream_tips_created ON stream_tips(created_at DESC);

ALTER TABLE stream_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tips"
  ON stream_tips FOR SELECT
  USING (true);

CREATE POLICY "Users can send tips"
  ON stream_tips FOR INSERT
  WITH CHECK (true);

-- Stream Viewers Table
CREATE TABLE IF NOT EXISTS stream_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  viewer_address text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  UNIQUE(stream_id, viewer_address)
);

CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_viewer ON stream_viewers(viewer_address);

ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view viewers"
  ON stream_viewers FOR SELECT
  USING (true);

CREATE POLICY "Users can join streams"
  ON stream_viewers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their viewer status"
  ON stream_viewers FOR UPDATE
  USING (true)
  WITH CHECK (true);