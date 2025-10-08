/*
  # Add wallet management features

  1. Changes
    - Add `network` column to track mainnet/testnet
    - Add `is_favorite` column for favorites functionality
    - Add index on is_favorite for faster filtering

  2. Purpose
    - Enable users to distinguish between mainnet and testnet wallets
    - Allow users to favorite/bookmark important wallets
    - Improve wallet organization and filtering
*/

-- Add network column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'network'
  ) THEN
    ALTER TABLE wallets ADD COLUMN network text DEFAULT 'testnet';
  END IF;
END $$;

-- Add is_favorite column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE wallets ADD COLUMN is_favorite boolean DEFAULT false;
  END IF;
END $$;

-- Add index on is_favorite for faster filtering
CREATE INDEX IF NOT EXISTS idx_wallets_favorite ON wallets(is_favorite) WHERE is_favorite = true;
