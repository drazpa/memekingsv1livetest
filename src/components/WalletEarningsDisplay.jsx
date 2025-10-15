import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const WalletEarningsDisplay = ({ walletAddress }) => {
  const [earnings, setEarnings] = useState({
    total: 0,
    unclaimed: 0
  });

  useEffect(() => {
    if (walletAddress) {
      loadEarnings();
    }
  }, [walletAddress]);

  const loadEarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('mint_earnings')
        .select('amount, claimed')
        .eq('wallet_address', walletAddress);

      if (error) throw error;

      const total = data.reduce((sum, record) => sum + parseFloat(record.amount), 0);
      const unclaimed = data.filter(r => !r.claimed).reduce((sum, record) => sum + parseFloat(record.amount), 0);

      setEarnings({ total, unclaimed });
    } catch (error) {
      console.error('Error loading earnings:', error);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="text-purple-200 font-medium">
        {earnings.total.toFixed(4)} XRP
      </div>
      {earnings.unclaimed > 0 && (
        <div className="text-xs text-yellow-400">
          {earnings.unclaimed.toFixed(4)} unclaimed
        </div>
      )}
    </div>
  );
};

export default WalletEarningsDisplay;
