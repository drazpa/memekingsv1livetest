import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import toast from 'react-hot-toast';

const MintEarningsButton = ({ connectedWallet }) => {
  const [unclaimedAmount, setUnclaimedAmount] = useState(0);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (connectedWallet) {
      loadUnclaimedEarnings();
      const interval = setInterval(loadUnclaimedEarnings, 10000);
      return () => clearInterval(interval);
    }
  }, [connectedWallet]);

  const loadUnclaimedEarnings = async () => {
    if (!connectedWallet) return;

    try {
      const { data, error } = await supabase
        .from('mint_earnings')
        .select('amount')
        .eq('wallet_address', connectedWallet.address)
        .eq('claimed', false);

      if (error) throw error;

      const total = data.reduce((sum, record) => sum + parseFloat(record.amount), 0);
      setUnclaimedAmount(total);
    } catch (error) {
      console.error('Error loading unclaimed earnings:', error);
    }
  };

  const claimEarnings = async () => {
    if (!connectedWallet || unclaimedAmount === 0) return;

    setIsClaiming(true);

    try {
      const { getClient } = await import('../utils/xrplClient');
      const client = await getClient();

      const { data: unclaimedRecords, error: fetchError } = await supabase
        .from('mint_earnings')
        .select('id')
        .eq('wallet_address', connectedWallet.address)
        .eq('claimed', false);

      if (fetchError) throw fetchError;

      if (unclaimedRecords.length === 0) {
        toast.error('No unclaimed earnings available');
        setIsClaiming(false);
        return;
      }

      const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);

      const payment = {
        TransactionType: 'Payment',
        Account: connectedWallet.address,
        Destination: connectedWallet.address,
        Amount: xrpl.xrpToDrops(unclaimedAmount.toFixed(6)),
        Memos: [{
          Memo: {
            MemoData: Buffer.from('Mint Earnings Claim', 'utf8').toString('hex').toUpperCase()
          }
        }]
      };

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Claim transaction failed: ${result.result.meta.TransactionResult}`);
      }

      const recordIds = unclaimedRecords.map(r => r.id);
      const { error: updateError } = await supabase
        .from('mint_earnings')
        .update({
          claimed: true,
          claimed_at: new Date().toISOString(),
          tx_hash: result.result.hash
        })
        .in('id', recordIds);

      if (updateError) throw updateError;

      toast.success(`Successfully claimed ${unclaimedAmount.toFixed(6)} XRP!`);
      setUnclaimedAmount(0);
    } catch (error) {
      console.error('Error claiming earnings:', error);
      toast.error(`Failed to claim earnings: ${error.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!connectedWallet) {
    return null;
  }

  return (
    <button
      onClick={claimEarnings}
      disabled={isClaiming || unclaimedAmount === 0}
      className="relative px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        animation: unclaimedAmount > 0 ? 'pulse-blue 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
      }}
    >
      <style>
        {`
          @keyframes pulse-blue {
            0%, 100% {
              box-shadow: 0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3);
            }
            50% {
              box-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 60px rgba(59, 130, 246, 0.5);
            }
          }
        `}
      </style>
      <div className="flex items-center space-x-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
        <span>
          {isClaiming ? 'Claiming...' : `Claim ${unclaimedAmount.toFixed(6)} XRP`}
        </span>
      </div>
    </button>
  );
};

export default MintEarningsButton;
