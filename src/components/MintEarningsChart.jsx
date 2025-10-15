import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const MintEarningsChart = ({ walletAddress }) => {
  const [earnings, setEarnings] = useState({
    total: 0,
    claimed: 0,
    unclaimed: 0,
    totalMints: 0,
    history: []
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
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const total = data.reduce((sum, record) => sum + parseFloat(record.amount), 0);
      const claimed = data.filter(r => r.claimed).reduce((sum, record) => sum + parseFloat(record.amount), 0);
      const unclaimed = data.filter(r => !r.claimed).reduce((sum, record) => sum + parseFloat(record.amount), 0);

      const last30Days = data.filter(record => {
        const recordDate = new Date(record.created_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return recordDate >= thirtyDaysAgo;
      });

      const dailyEarnings = {};
      last30Days.forEach(record => {
        const date = new Date(record.created_at).toLocaleDateString();
        dailyEarnings[date] = (dailyEarnings[date] || 0) + parseFloat(record.amount);
      });

      const history = Object.entries(dailyEarnings)
        .map(([date, amount]) => ({ date, amount }))
        .slice(0, 7)
        .reverse();

      setEarnings({
        total,
        claimed,
        unclaimed,
        totalMints: data.length,
        history
      });
    } catch (error) {
      console.error('Error loading earnings:', error);
    }
  };

  const maxEarning = Math.max(...earnings.history.map(h => h.amount), 1);

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
        Mint Earnings
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total Earned</div>
          <div className="text-2xl font-bold text-blue-400">{earnings.total.toFixed(6)} XRP</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Claimed</div>
          <div className="text-2xl font-bold text-green-400">{earnings.claimed.toFixed(6)} XRP</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Unclaimed</div>
          <div className="text-2xl font-bold text-yellow-400">{earnings.unclaimed.toFixed(6)} XRP</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total Mints</div>
          <div className="text-2xl font-bold text-purple-400">{earnings.totalMints}</div>
        </div>
      </div>

      {earnings.history.length > 0 && (
        <div>
          <div className="text-gray-400 text-sm mb-3">Last 7 Days</div>
          <div className="flex items-end justify-between gap-2 h-40">
            {earnings.history.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gray-700 rounded-t relative group">
                  <div
                    className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-300 hover:from-blue-500 hover:to-blue-300"
                    style={{
                      height: `${(day.amount / maxEarning) * 140}px`,
                      minHeight: day.amount > 0 ? '8px' : '0px'
                    }}
                  />
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.amount.toFixed(4)} XRP
                  </div>
                </div>
                <div className="text-xs text-gray-500 transform -rotate-45 origin-top-left w-16 mt-2">
                  {day.date.split('/').slice(0, 2).join('/')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {earnings.totalMints === 0 && (
        <div className="text-center text-gray-500 py-8">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p>No mint earnings yet</p>
          <p className="text-sm mt-1">Earn 0.10 XRP for each token minted</p>
        </div>
      )}
    </div>
  );
};

export default MintEarningsChart;
