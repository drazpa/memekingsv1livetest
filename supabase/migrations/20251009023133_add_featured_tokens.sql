/*
  # Add Featured Tokens Support

  1. Changes
    - Add `is_featured` boolean column to `meme_tokens` table (default false)
    - Add `featured_order` integer column to control display order (nullable)
    - Add index on is_featured for faster queries
    
  2. Purpose
    - Allow admins to manually feature tokens
    - Automatically feature newly created tokens in top 3 spots
    - Control the order of featured tokens display
*/

-- Add featured columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN is_featured boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'featured_order'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN featured_order integer;
  END IF;
END $$;

-- Create index for faster featured token queries
CREATE INDEX IF NOT EXISTS idx_meme_tokens_featured ON meme_tokens(is_featured, featured_order);

-- Create a function to auto-manage featured tokens
-- When a new token is created, automatically feature it and push others down
CREATE OR REPLACE FUNCTION manage_featured_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark new token as featured
  NEW.is_featured := true;
  
  -- Set it as the top featured token (order 1)
  NEW.featured_order := 1;
  
  -- Push down other featured tokens
  UPDATE meme_tokens
  SET featured_order = featured_order + 1
  WHERE is_featured = true
    AND id != NEW.id
    AND featured_order IS NOT NULL;
  
  -- Unfeature tokens beyond position 3
  UPDATE meme_tokens
  SET is_featured = false, featured_order = NULL
  WHERE is_featured = true
    AND featured_order > 3;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new tokens
DROP TRIGGER IF EXISTS auto_feature_new_tokens ON meme_tokens;
CREATE TRIGGER auto_feature_new_tokens
  BEFORE INSERT ON meme_tokens
  FOR EACH ROW
  EXECUTE FUNCTION manage_featured_tokens();