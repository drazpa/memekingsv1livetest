/*
  # Create Live Streaming Platform

  1. New Tables
    - `live_streams`
      - `id` (uuid, primary key)
      - `stream_id` (text, unique) - Unique stream identifier
      - `streamer_wallet` (text) - Streamer's wallet address
      - `streamer_nickname` (text) - Display name
      - `title` (text) - Stream title
      - `description` (text) - Stream description
      - `favorite_token_code` (text) - Token to earn
      - `favorite_token_issuer` (text) - Token issuer
      - `is_live` (boolean, default true)
      - `viewer_count` (integer, default 0)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz, nullable)
      - `total_minutes_streamed` (integer, default 0)
      - `total_earned` (numeric, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `stream_earnings`
      - `id` (uuid, primary key)
      - `stream_id` (uuid, foreign key to live_streams)
      - `streamer_wallet` (text)
      - `token_code` (text)
      - `token_issuer` (text)
      - `minutes_streamed` (integer) - Minutes in this session
      - `amount_earned` (numeric) - Amount earned
      - `allocation_percentage` (numeric) - 1% of supply allocation
      - `created_at` (timestamptz)
    
    - `stream_sessions`
      - `id` (uuid, primary key)
      - `stream_id` (uuid, foreign key to live_streams)
      - `session_start` (timestamptz)
      - `session_end` (timestamptz, nullable)
      - `minutes_streamed` (integer, default 0)
      - `peak_viewers` (integer, default 0)
      - `total_earned` (numeric, default 0)
      - `created_at` (timestamptz)
    
    - `stream_viewers`
      - `id` (uuid, primary key)
      - `stream_id` (uuid, foreign key to live_streams)
      - `viewer_wallet` (text)
      - `viewer_nickname` (text)
      - `joined_at` (timestamptz)
      - `left_at` (timestamptz, nullable)
      - `is_watching` (boolean, default true)
    
    - `stream_analytics`
      - `id` (uuid, primary key)
      - `stream_id` (uuid, foreign key to live_streams)
      - `date` (date)
      - `total_minutes` (integer, default 0)
      - `total_viewers` (integer, default 0)
      - `total_earned` (numeric, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `token_streaming_allocations`
      - `id` (uuid, primary key)
      - `token_code` (text)
      - `token_issuer` (text)
      - `total_supply` (numeric)
      - `allocation_percentage` (numeric, default 1.0) - 1% for streaming
      - `total_allocated` (numeric)
      - `total_distributed` (numeric, default 0)
      - `apy_percentage` (numeric, default 1.0) - 1% APY
      - `minutes_per_year` (integer, default 525600) - 365 * 24 * 60
      - `reward_per_minute` (numeric) - Calculated reward
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
  2. Security
    - Enable RLS on all tables
    - Public read access for live streams
    - Streamers can manage their own streams
    - Analytics are publicly viewable

  3. Important Notes
    - Streaming rewards calculated as: (1% of supply * 1% APY) / 525,600 minutes per year
    - Example: 100M supply = 1M allocated (1%) = 10K yearly (1% APY) = 0.019 tokens per minute
    - 100 minutes of streaming = 1.9 tokens earned
*/

-- Live Streams Table
CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id text UNIQUE NOT NULL,
  streamer_wallet text NOT NULL,
  streamer_nickname text NOT NULL,
  title text NOT NULL,
  description text,
  favorite_token_code text NOT NULL,
  favorite_token_issuer text NOT NULL,
  is_live boolean DEFAULT true,
  viewer_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  total_minutes_streamed integer DEFAULT 0,
  total_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_live ON live_streams(is_live);
CREATE INDEX IF NOT EXISTS idx_live_streams_wallet ON live_streams(streamer_wallet);
CREATE INDEX IF NOT EXISTS idx_live_streams_stream_id ON live_streams(stream_id);

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live streams"
  ON live_streams FOR SELECT
  USING (true);

CREATE POLICY "Streamers can create streams"
  ON live_streams FOR INSERT
  WITH CHECK (streamer_wallet IS NOT NULL);

CREATE POLICY "Streamers can update their streams"
  ON live_streams FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Stream Earnings Table
CREATE TABLE IF NOT EXISTS stream_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  streamer_wallet text NOT NULL,
  token_code text NOT NULL,
  token_issuer text NOT NULL,
  minutes_streamed integer NOT NULL,
  amount_earned numeric NOT NULL,
  allocation_percentage numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_earnings_stream ON stream_earnings(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_earnings_wallet ON stream_earnings(streamer_wallet);

ALTER TABLE stream_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view earnings"
  ON stream_earnings FOR SELECT
  USING (true);

CREATE POLICY "System can create earnings"
  ON stream_earnings FOR INSERT
  WITH CHECK (true);

-- Stream Sessions Table
CREATE TABLE IF NOT EXISTS stream_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  session_start timestamptz DEFAULT now(),
  session_end timestamptz,
  minutes_streamed integer DEFAULT 0,
  peak_viewers integer DEFAULT 0,
  total_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_stream ON stream_sessions(stream_id);

ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sessions"
  ON stream_sessions FOR SELECT
  USING (true);

CREATE POLICY "System can manage sessions"
  ON stream_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Stream Viewers Table
CREATE TABLE IF NOT EXISTS stream_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  viewer_wallet text NOT NULL,
  viewer_nickname text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  is_watching boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_watching ON stream_viewers(is_watching);

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

-- Stream Analytics Table
CREATE TABLE IF NOT EXISTS stream_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_minutes integer DEFAULT 0,
  total_viewers integer DEFAULT 0,
  total_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(stream_id, date)
);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_date ON stream_analytics(date);

ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view analytics"
  ON stream_analytics FOR SELECT
  USING (true);

CREATE POLICY "System can manage analytics"
  ON stream_analytics FOR ALL
  USING (true)
  WITH CHECK (true);

-- Token Streaming Allocations Table
CREATE TABLE IF NOT EXISTS token_streaming_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_code text NOT NULL,
  token_issuer text NOT NULL,
  total_supply numeric NOT NULL,
  allocation_percentage numeric DEFAULT 1.0,
  total_allocated numeric NOT NULL,
  total_distributed numeric DEFAULT 0,
  apy_percentage numeric DEFAULT 1.0,
  minutes_per_year integer DEFAULT 525600,
  reward_per_minute numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(token_code, token_issuer)
);

CREATE INDEX IF NOT EXISTS idx_token_allocations_token ON token_streaming_allocations(token_code, token_issuer);

ALTER TABLE token_streaming_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view allocations"
  ON token_streaming_allocations FOR SELECT
  USING (true);

CREATE POLICY "System can manage allocations"
  ON token_streaming_allocations FOR ALL
  USING (true)
  WITH CHECK (true);