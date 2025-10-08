/*
  # Add Runtime State to Trading Bots

  1. Changes
    - Add `next_trade_time` (timestamptz, nullable) - Timestamp of next scheduled trade
    - Add `next_action` (text, nullable) - Next trade action (BUY/SELL)
    - Add `next_token_amount` (numeric, nullable) - Amount of tokens for next trade
    - Add `next_xrp_amount` (numeric, nullable) - Amount of XRP for next trade
    - Add `next_price` (text, nullable) - Estimated price for next trade

  2. Purpose
    - Persist bot countdown and next action data in database
    - Survive page refreshes and navigation
    - Maintain bot state across sessions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'next_trade_time'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN next_trade_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'next_action'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN next_action text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'next_token_amount'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN next_token_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'next_xrp_amount'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN next_xrp_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_bots' AND column_name = 'next_price'
  ) THEN
    ALTER TABLE trading_bots ADD COLUMN next_price text;
  END IF;
END $$;
