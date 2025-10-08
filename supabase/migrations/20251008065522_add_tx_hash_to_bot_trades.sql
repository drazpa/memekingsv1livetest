/*
  # Add Transaction Hash to Bot Trades

  1. Changes
    - Add `tx_hash` column to `bot_trades` table
    - Stores XRPL transaction hash for each trade
    - Nullable for backward compatibility with existing records
  
  2. Benefits
    - Enables XRPScan link generation
    - Provides transaction verification
    - Improves trade transparency
*/

-- Add tx_hash column to bot_trades
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bot_trades' AND column_name = 'tx_hash'
  ) THEN
    ALTER TABLE bot_trades ADD COLUMN tx_hash text;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bot_trades_tx_hash ON bot_trades(tx_hash);