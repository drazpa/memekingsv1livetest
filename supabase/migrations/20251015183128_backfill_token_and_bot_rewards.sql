/*
  # Backfill Token and Bot Creation Rewards

  1. Purpose
    - Create XRP rewards for all existing tokens (31 tokens)
    - Create XRP rewards for all existing bots (24 bots)
    - Each token creation = 0.10 XRP reward
    - Each bot creation = 0.10 XRP reward

  2. Changes
    - Insert rewards for all tokens in meme_tokens table
    - Insert rewards for all bots in trading_bots table
    - All rewards start as 'pending' status
    - Rewards are tied to the receiver_address (for tokens) and wallet_address (for bots)

  3. Notes
    - This is a one-time backfill for existing data
    - Future tokens and bots will automatically create rewards via application code
*/

-- Backfill rewards for all existing token creations
INSERT INTO xrp_rewards (wallet_address, amount, reward_type, description, status, created_at)
SELECT 
  receiver_address,
  0.10,
  'token_creation',
  'Created token: ' || token_name || ' (' || currency_code || ')',
  'pending',
  created_at
FROM meme_tokens
WHERE receiver_address IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill rewards for all existing bot creations
INSERT INTO xrp_rewards (wallet_address, amount, reward_type, description, status, created_at)
SELECT 
  wallet_address,
  0.10,
  'bot_creation',
  'Created trading bot: ' || name,
  'pending',
  created_at
FROM trading_bots
WHERE wallet_address IS NOT NULL
ON CONFLICT DO NOTHING;