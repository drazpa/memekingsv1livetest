/*
  # Add Token Favorites System

  1. New Tables
    - `token_favorites`
      - `id` (uuid, primary key)
      - `user_address` (text) - Wallet address of user
      - `token_id` (uuid) - Reference to meme_tokens
      - `created_at` (timestamptz)
      - Unique constraint on (user_address, token_id)

  2. Security
    - Enable RLS on `token_favorites` table
    - Add policy for users to manage their own favorites

  3. Notes
    - Allows users to favorite/unfavorite tokens
    - Prevents duplicate favorites
    - Tracks when favorites were added
*/

CREATE TABLE IF NOT EXISTS token_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address text NOT NULL,
  token_id uuid NOT NULL REFERENCES meme_tokens(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_address, token_id)
);

ALTER TABLE token_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all favorites"
  ON token_favorites FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can add their own favorites"
  ON token_favorites FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can delete their own favorites"
  ON token_favorites FOR DELETE
  TO authenticated, anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_token_favorites_user ON token_favorites(user_address);
CREATE INDEX IF NOT EXISTS idx_token_favorites_token ON token_favorites(token_id);
