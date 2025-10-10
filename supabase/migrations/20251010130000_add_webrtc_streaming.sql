/*
  # Add WebRTC Streaming Support

  1. Schema Changes
    - Add `stream_signal` column to live_streams table
      - Stores WebRTC offer signal for peer connections
      - JSON type to store signal data

  2. Purpose
    - Enable real-time video streaming from broadcaster to viewers
    - Store WebRTC signaling data for peer-to-peer connections
    - Viewers use this signal to connect to streamer's video feed

  3. Security
    - Only streamers can update their own stream signals
    - All users can read signals to connect as viewers
*/

-- Add stream_signal column to store WebRTC offer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_streams' AND column_name = 'stream_signal'
  ) THEN
    ALTER TABLE live_streams ADD COLUMN stream_signal jsonb;
  END IF;
END $$;

-- Update RLS policies to allow streamers to update their signals
CREATE POLICY "Streamers can update own stream signal"
  ON live_streams FOR UPDATE
  TO authenticated
  USING (wallet_address = current_setting('app.current_wallet', true))
  WITH CHECK (wallet_address = current_setting('app.current_wallet', true));
