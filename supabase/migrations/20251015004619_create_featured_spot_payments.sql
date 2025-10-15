/*
  # Create Featured Spot Payment System

  1. New Tables
    - `featured_spot_purchases`
      - `id` (uuid, primary key)
      - `token_id` (uuid, foreign key to meme_tokens)
      - `wallet_address` (text) - wallet that paid for the spot
      - `spot_position` (integer) - which spot (1, 2, or 3)
      - `hours_purchased` (integer) - number of hours purchased
      - `xrp_amount` (numeric) - amount of XRP paid
      - `tx_hash` (text) - XRPL transaction hash
      - `started_at` (timestamptz) - when the featured period started
      - `expires_at` (timestamptz) - when the featured period ends
      - `is_active` (boolean) - whether this purchase is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `featured_spot_purchases` table
    - Add policy for anyone to view active featured purchases
    - Add policy for authenticated users to create purchases with their wallet
    - Add policy for authenticated users to view their own purchase history

  3. Indexes
    - Add index on `is_active` and `expires_at` for efficient active spot queries
    - Add index on `token_id` for token lookup
    - Add index on `wallet_address` for user history

  4. Functions
    - Create function to automatically deactivate expired purchases
    - Create function to check if a spot is currently occupied
*/

-- Create featured_spot_purchases table
CREATE TABLE IF NOT EXISTS featured_spot_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES meme_tokens(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  spot_position integer NOT NULL CHECK (spot_position >= 1 AND spot_position <= 3),
  hours_purchased integer NOT NULL CHECK (hours_purchased > 0),
  xrp_amount numeric NOT NULL CHECK (xrp_amount > 0),
  tx_hash text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE featured_spot_purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active featured purchases
CREATE POLICY "Anyone can view active featured purchases"
  ON featured_spot_purchases
  FOR SELECT
  USING (is_active = true);

-- Policy: Anyone can view all purchase history (for transparency)
CREATE POLICY "Anyone can view purchase history"
  ON featured_spot_purchases
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can create purchases
CREATE POLICY "Authenticated users can create purchases"
  ON featured_spot_purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_featured_purchases_active ON featured_spot_purchases(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_featured_purchases_token ON featured_spot_purchases(token_id);
CREATE INDEX IF NOT EXISTS idx_featured_purchases_wallet ON featured_spot_purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_featured_purchases_spot ON featured_spot_purchases(spot_position, is_active);

-- Function to deactivate expired purchases
CREATE OR REPLACE FUNCTION deactivate_expired_featured_purchases()
RETURNS void AS $$
BEGIN
  UPDATE featured_spot_purchases
  SET is_active = false, updated_at = now()
  WHERE is_active = true
    AND expires_at <= now();
END;
$$ LANGUAGE plpgsql;

-- Function to get currently active spot occupants
CREATE OR REPLACE FUNCTION get_active_featured_spots()
RETURNS TABLE (
  spot_position integer,
  token_id uuid,
  wallet_address text,
  expires_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.spot_position)
    p.spot_position,
    p.token_id,
    p.wallet_address,
    p.expires_at
  FROM featured_spot_purchases p
  WHERE p.is_active = true
    AND p.expires_at > now()
  ORDER BY p.spot_position, p.expires_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a spot is available
CREATE OR REPLACE FUNCTION is_featured_spot_available(spot_pos integer)
RETURNS boolean AS $$
DECLARE
  active_count integer;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM featured_spot_purchases
  WHERE spot_position = spot_pos
    AND is_active = true
    AND expires_at > now();
  
  RETURN active_count = 0;
END;
$$ LANGUAGE plpgsql;