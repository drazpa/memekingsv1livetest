/*
  # Add token image URL support

  1. Changes
    - Add `image_url` column to `meme_tokens` table to store Pinata IPFS image URLs
    - Set default to NULL to allow existing tokens without images
    - Create index on image_url for faster lookups

  2. Purpose
    - Enable token creators to upload custom images for their tokens
    - Store IPFS URLs from Pinata for decentralized image hosting
    - Display token icons across the application
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN image_url text DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meme_tokens_image_url ON meme_tokens(image_url);