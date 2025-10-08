/*
  # Add updated_at field to meme_tokens table

  1. Changes
    - Add `updated_at` column to `meme_tokens` table with default of now()
    - Add trigger to automatically update `updated_at` when row is modified
  
  2. Purpose
    - Track when token data is last modified
    - Enable cache-busting for token images by using updated_at timestamp
    - Improve data tracking and debugging
*/

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_meme_tokens_updated_at ON meme_tokens;
CREATE TRIGGER update_meme_tokens_updated_at
  BEFORE UPDATE ON meme_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
