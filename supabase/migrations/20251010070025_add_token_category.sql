/*
  # Add Token Category System

  1. Changes
    - Add `category` column to meme_tokens table for categorizing tokens
    - Add index on category for efficient filtering
    - Categories: Meme, Gaming, DeFi, Utility, Community, NFT, Other

  2. Security
    - No RLS changes needed - inherits existing policies
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meme_tokens' AND column_name = 'category'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN category text DEFAULT 'Other';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meme_tokens_category ON meme_tokens(category);

COMMENT ON COLUMN meme_tokens.category IS 'Token category: Meme, Gaming, DeFi, Utility, Community, NFT, Other';