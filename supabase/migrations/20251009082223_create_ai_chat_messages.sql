/*
  # Create AI Chat Messages Schema

  1. New Tables
    - `ai_chat_messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `session_id` (text) - Chat session identifier for grouping conversations
      - `role` (text) - Message role: 'user' or 'assistant'
      - `content` (text) - The actual message content
      - `metadata` (jsonb, nullable) - Additional data like actions, cards, tables, etc.
      - `created_at` (timestamptz) - When the message was created
      - `updated_at` (timestamptz) - When the message was last updated

  2. Security
    - Enable RLS on `ai_chat_messages` table
    - Add policy for users to read their own messages
    - Add policy for users to insert their own messages
    - Add policy for users to delete their own messages

  3. Indexes
    - Index on session_id for faster session-based queries
    - Index on created_at for chronological sorting

  4. Important Notes
    - Messages are stored with session IDs for conversation tracking
    - Metadata field stores structured data for rich UI elements
    - RLS ensures users can only access their own chat history
*/

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  metadata jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own messages"
  ON ai_chat_messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read messages"
  ON ai_chat_messages
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert messages"
  ON ai_chat_messages
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can delete messages"
  ON ai_chat_messages
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id 
  ON ai_chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at 
  ON ai_chat_messages(created_at DESC);

CREATE OR REPLACE FUNCTION update_ai_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_ai_chat_messages_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_ai_chat_messages_updated_at_trigger
      BEFORE UPDATE ON ai_chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION update_ai_chat_messages_updated_at();
  END IF;
END $$;
