/*
  # Add Stream Categories and Crown Reactions

  1. Changes to live_streams
    - Add `category` field for stream categorization
    - Add `tags` array for filtering
    - Add `crown_count` for reactions
    - Add `thumbnail_url` for stream thumbnails

  2. New Tables
    - `stream_reactions`
      - Tracks crown reactions from viewers
      - `id`, `stream_id`, `from_wallet`, `from_nickname`, `created_at`
    
    - `stream_categories`
      - Predefined categories for streams
      - `id`, `name`, `slug`, `icon`, `created_at`

  3. Security
    - Enable RLS on new tables
    - Public read access for all streaming data
*/

-- Add new columns to live_streams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_streams' AND column_name = 'category'
  ) THEN
    ALTER TABLE live_streams ADD COLUMN category text DEFAULT 'Just Chatting';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_streams' AND column_name = 'tags'
  ) THEN
    ALTER TABLE live_streams ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_streams' AND column_name = 'crown_count'
  ) THEN
    ALTER TABLE live_streams ADD COLUMN crown_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_streams' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE live_streams ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- Stream Reactions Table
CREATE TABLE IF NOT EXISTS stream_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  from_wallet text NOT NULL,
  from_nickname text NOT NULL,
  reaction_type text DEFAULT 'crown',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_reactions_stream ON stream_reactions(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_reactions_created ON stream_reactions(created_at DESC);

ALTER TABLE stream_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON stream_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can send reactions"
  ON stream_reactions FOR INSERT
  WITH CHECK (true);

-- Stream Categories Table
CREATE TABLE IF NOT EXISTS stream_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text DEFAULT '📺',
  stream_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stream_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON stream_categories FOR SELECT
  USING (true);

-- Insert default categories
INSERT INTO stream_categories (name, slug, icon) VALUES
  ('Just Chatting', 'just-chatting', '💬'),
  ('Trading', 'trading', '📈'),
  ('Gaming', 'gaming', '🎮'),
  ('Music', 'music', '🎵'),
  ('Art', 'art', '🎨'),
  ('Crypto Talk', 'crypto-talk', '💰'),
  ('Education', 'education', '📚'),
  ('Entertainment', 'entertainment', '🎭')
ON CONFLICT (slug) DO NOTHING;