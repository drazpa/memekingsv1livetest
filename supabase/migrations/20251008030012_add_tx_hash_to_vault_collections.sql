/*
  # Add tx_hash to vault_collections
  
  1. Changes
    - Add tx_hash column to vault_collections table for tracking transaction hashes
    - Add is_active column to vault_stakes to track start/stop state
    
  2. Notes
    - Allows tracking of reward collection transactions
    - Enables start/stop functionality for vault staking
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_collections' AND column_name = 'tx_hash'
  ) THEN
    ALTER TABLE vault_collections ADD COLUMN tx_hash text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_stakes' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE vault_stakes ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;