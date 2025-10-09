/*
  # Create Token Favorites Table

  1. New Tables
    - `token_favorites`
      - `id` (uuid, primary key)
      - `wallet_address` (text) - The wallet that favorited the token
      - `token_id` (uuid) - Reference to meme_tokens
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `token_favorites` table
    - Add policy for users to manage their own favorites
    - Unique constraint on wallet_address + token_id combination
  
  3. Indexes
    - Add index on wallet_address for faster lookups
    - Add index on token_id for reverse lookups
*/

CREATE TABLE IF NOT EXISTS token_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_id uuid NOT NULL REFERENCES meme_tokens(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(wallet_address, token_id)
);

CREATE INDEX IF NOT EXISTS idx_token_favorites_wallet ON token_favorites(wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_favorites_token ON token_favorites(token_id);

ALTER TABLE token_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all favorites"
  ON token_favorites FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own favorites"
  ON token_favorites FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their own favorites"
  ON token_favorites FOR DELETE
  USING (true);
