import { supabase } from './supabase';

export const logActivity = async ({
  userAddress,
  actionType,
  description,
  details = {},
  txHash = null,
  tokenId = null
}) => {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert([{
        user_address: userAddress,
        action_type: actionType,
        description,
        details,
        tx_hash: txHash,
        token_id: tokenId
      }]);

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

export const ACTION_TYPES = {
  TOKEN_CREATED: 'token_created',
  TOKEN_SENT: 'token_sent',
  TOKEN_RECEIVED: 'token_received',
  TRUSTLINE_CREATED: 'trustline_created',
  SWAP_EXECUTED: 'swap_executed',
  AMM_CREATED: 'amm_created',
  WALLET_CONNECTED: 'wallet_connected',
  WALLET_DISCONNECTED: 'wallet_disconnected',
  BOT_CREATED: 'bot_created',
  START_EARNING: 'start_earning',
  STOP_EARNING: 'stop_earning',
  CLAIM_EARNINGS: 'claim_earnings'
};
