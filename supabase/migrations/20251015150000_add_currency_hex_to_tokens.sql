/*
  # Add currency_hex field to meme_tokens

  1. Changes
    - Add `currency_hex` column to `meme_tokens` table
      - Stores hexadecimal representation of currency code for XRPL
      - Required for proper token identification on the ledger

  2. Notes
    - Hex format is used by XRPL for non-standard currency codes
    - Existing tokens may need their hex values populated
*/

-- Add currency_hex column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meme_tokens' AND column_name = 'currency_hex'
  ) THEN
    ALTER TABLE meme_tokens ADD COLUMN currency_hex text;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meme_tokens_currency_hex ON meme_tokens(currency_hex);
