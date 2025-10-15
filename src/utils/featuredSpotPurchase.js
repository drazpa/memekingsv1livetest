import { supabase } from './supabase';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import { getClient } from './xrplClient';

const FEATURED_SPOT_WALLET = 'rKxBBMmY969Ph1y63ddVfYyN7xmxwDfVq6';
const XRP_PER_HOUR = 1;

export const getActiveFeaturedSpots = async () => {
  try {
    const { data, error } = await supabase.rpc('get_active_featured_spots');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active featured spots:', error);
    return [];
  }
};

export const checkSpotAvailability = async (spotPosition) => {
  try {
    const { data, error } = await supabase.rpc('is_featured_spot_available', {
      spot_pos: spotPosition
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error checking spot availability:', error);
    return false;
  }
};

export const purchaseFeaturedSpot = async ({
  tokenId,
  spotPosition,
  hours,
  walletSeed,
  walletAddress,
  xrpAmount
}) => {
  try {
    const finalXrpAmount = xrpAmount || (hours * XRP_PER_HOUR);

    const client = await getClient();
    const wallet = xrpl.Wallet.fromSeed(walletSeed);

    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: xrpl.xrpToDrops(finalXrpAmount),
      Destination: FEATURED_SPOT_WALLET,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('featured_spot', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              tokenId,
              spotPosition,
              hours,
              deal: xrpAmount ? 'day_buyout' : 'standard'
            }), 'utf8').toString('hex').toUpperCase()
          }
        }
      ]
    };

    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + hours * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('featured_spot_purchases')
      .insert({
        token_id: tokenId,
        wallet_address: walletAddress,
        spot_position: spotPosition,
        hours_purchased: hours,
        xrp_amount: finalXrpAmount,
        tx_hash: result.result.hash,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      purchase: data,
      txHash: result.result.hash
    };
  } catch (error) {
    console.error('Error purchasing featured spot:', error);
    throw error;
  }
};

export const getPurchaseHistory = async (walletAddress) => {
  try {
    const { data, error } = await supabase
      .from('featured_spot_purchases')
      .select(`
        *,
        meme_tokens (
          token_name,
          currency_code,
          image_url
        )
      `)
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    return [];
  }
};

export const deactivateExpiredPurchases = async () => {
  try {
    const { error } = await supabase.rpc('deactivate_expired_featured_purchases');
    if (error) throw error;
  } catch (error) {
    console.error('Error deactivating expired purchases:', error);
  }
};
