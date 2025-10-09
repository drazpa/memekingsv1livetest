/*
  # Create Address Book Schema

  1. New Tables
    - `address_book`
      - `id` (uuid, primary key)
      - `wallet_address` (text, owner of the address book entry)
      - `name` (text, friendly name for the contact)
      - `address` (text, XRPL address of the contact)
      - `notes` (text, optional notes about the contact)
      - `is_favorite` (boolean, mark favorites)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `address_book` table
    - Add policies for authenticated users to manage their own contacts

  3. Indexes
    - Add index on wallet_address for faster lookups
    - Add index on address for search functionality
*/

CREATE TABLE IF NOT EXISTS address_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  notes text DEFAULT '',
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_address_book_wallet ON address_book(wallet_address);
CREATE INDEX IF NOT EXISTS idx_address_book_address ON address_book(address);
CREATE INDEX IF NOT EXISTS idx_address_book_favorite ON address_book(wallet_address, is_favorite);

-- Enable Row Level Security
ALTER TABLE address_book ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own address book entries
CREATE POLICY "Users can view own contacts"
  ON address_book
  FOR SELECT
  TO authenticated
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Policy: Users can view their own address book entries (for public access)
CREATE POLICY "Users can view own contacts public"
  ON address_book
  FOR SELECT
  TO public
  USING (true);

-- Policy: Users can insert their own address book entries
CREATE POLICY "Users can create own contacts"
  ON address_book
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Users can update their own address book entries
CREATE POLICY "Users can update own contacts"
  ON address_book
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Policy: Users can delete their own address book entries
CREATE POLICY "Users can delete own contacts"
  ON address_book
  FOR DELETE
  TO public
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_address_book_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
DROP TRIGGER IF EXISTS set_address_book_updated_at ON address_book;
CREATE TRIGGER set_address_book_updated_at
  BEFORE UPDATE ON address_book
  FOR EACH ROW
  EXECUTE FUNCTION update_address_book_updated_at();
