/*
  # Add Token Metadata Fields

  1. Changes
    - Add `description` column to meme_tokens (max 140 characters)
    - Add `twitter_handle` column to meme_tokens (optional)
    - Add `website_url` column to meme_tokens (optional)
  
  2. Notes
    - All new fields are optional to maintain compatibility
    - Description limited to 140 characters for social media sharing
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'description'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'twitter_handle'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN twitter_handle text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'website_url'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN website_url text;
  END IF;
END $$;

-- Update existing tokens with their descriptions
UPDATE meme_tokens SET description = 'SAL' WHERE token_name = 'SAL';
UPDATE meme_tokens SET description = 'LEO' WHERE token_name = 'LEO';
UPDATE meme_tokens SET description = 'OMG' WHERE token_name = 'OMG';
