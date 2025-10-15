import { supabase } from './supabase';
import * as xrpl from 'xrpl';

const RECEIVER_ADDRESS = 'rpnatRpwXcAo7CVmXoHU7fVTd4wJr8eQCJw';
const RECEIVER_SEED = 'sEd7W72aANTbLTG98XDhU1yfotPJdhu';

export async function getWalletRewards(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('token_creation_rewards')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const unclaimedRewards = data.filter(r => !r.claimed);
    const claimedRewards = data.filter(r => r.claimed);

    const totalUnclaimed = unclaimedRewards.reduce((sum, r) => sum + parseFloat(r.reward_amount), 0);
    const totalClaimed = claimedRewards.reduce((sum, r) => sum + parseFloat(r.reward_amount), 0);
    const totalRewards = totalUnclaimed + totalClaimed;

    return {
      allRewards: data,
      unclaimedRewards,
      claimedRewards,
      totalUnclaimed,
      totalClaimed,
      totalRewards,
      tokenCount: data.length
    };
  } catch (error) {
    console.error('Error fetching rewards:', error);
    throw error;
  }
}

export async function claimRewards(walletAddress, walletSeed) {
  try {
    // Get unclaimed rewards
    const { unclaimedRewards, totalUnclaimed } = await getWalletRewards(walletAddress);

    if (totalUnclaimed === 0) {
      throw new Error('No rewards to claim');
    }

    // Connect to XRPL
    const { getClient } = await import('./xrplClient');
    const client = await getClient();

    // Create wallets
    const receiverWallet = xrpl.Wallet.fromSeed(RECEIVER_SEED);
    const userWallet = xrpl.Wallet.fromSeed(walletSeed);

    // Send XRP from receiver wallet to user wallet
    const payment = {
      TransactionType: 'Payment',
      Account: receiverWallet.address,
      Destination: userWallet.address,
      Amount: xrpl.xrpToDrops(totalUnclaimed.toFixed(6)),
      Memos: [{
        Memo: {
          MemoData: Buffer.from(`Token Creation Rewards Claim`, 'utf8').toString('hex').toUpperCase()
        }
      }]
    };

    const prepared = await client.autofill(payment);
    const signed = receiverWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Payment failed: ${result.result.meta.TransactionResult}`);
    }

    // Mark all unclaimed rewards as claimed
    const rewardIds = unclaimedRewards.map(r => r.id);
    const { error: updateError } = await supabase
      .from('token_creation_rewards')
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
        claim_tx_hash: result.result.hash
      })
      .in('id', rewardIds);

    if (updateError) throw updateError;

    return {
      success: true,
      amount: totalUnclaimed,
      txHash: result.result.hash,
      rewardsCount: unclaimedRewards.length
    };
  } catch (error) {
    console.error('Error claiming rewards:', error);
    throw error;
  }
}
