import { useState, useEffect } from 'react';
import { getWalletRewards, claimRewards } from '../utils/rewardsUtils';
import toast from 'react-hot-toast';

export default function DashboardRewardsWidget({ wallet, xrpPrice = 2.50 }) {
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (wallet?.address) {
      loadRewards();
    }
  }, [wallet]);

  const loadRewards = async () => {
    if (!wallet?.address) return;

    try {
      setLoading(true);
      const rewardsData = await getWalletRewards(wallet.address);
      setRewards(rewardsData);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!wallet?.seed) {
      toast.error('Wallet seed not available');
      return;
    }

    if (rewards.totalUnclaimed === 0) {
      toast.error('No rewards to claim');
      return;
    }

    try {
      setClaiming(true);
      const result = await claimRewards(wallet.address, wallet.seed);

      toast.success(
        `Successfully claimed ${result.amount.toFixed(2)} XRP!`,
        { duration: 5000 }
      );

      await loadRewards();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error(error.message || 'Failed to claim rewards');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-lg p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-purple-500/20 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-purple-500/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!rewards || rewards.totalRewards === 0) {
    return null;
  }

  return (
    <div className="glass rounded-lg p-4 sm:p-6 relative overflow-hidden">
      {rewards.totalUnclaimed > 0 && (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
            animation: 'glow-pulse 3s ease-in-out infinite'
          }}
        />
      )}

      <div className="relative">
        <div className="text-purple-400 text-xs sm:text-sm mb-2">💰 Token Creation Rewards</div>
        <div className="flex items-baseline gap-2 flex-wrap mb-2">
          <div className={`text-2xl sm:text-3xl font-bold ${
            rewards.totalUnclaimed > 0 ? 'text-green-400' : 'text-purple-300'
          }`}>
            {rewards.totalUnclaimed.toFixed(2)} XRP
          </div>
          {rewards.totalUnclaimed > 0 && (
            <div className="text-green-300 text-sm sm:text-base font-medium">
              Available to Claim
            </div>
          )}
        </div>

        {rewards.totalUnclaimed > 0 ? (
          <>
            <div className="text-green-300 text-xs sm:text-sm mb-3">
              ${(rewards.totalUnclaimed * xrpPrice).toFixed(2)} USD | {rewards.unclaimedRewards.length} tokens created
            </div>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)',
                animation: 'glow-pulse 2s ease-in-out infinite'
              }}
            >
              {claiming ? '⏳ Claiming...' : `💰 Claim ${rewards.totalUnclaimed.toFixed(2)} XRP`}
            </button>
          </>
        ) : (
          <>
            <div className="text-purple-300 text-xs sm:text-sm mb-1">
              Total Earned: {rewards.totalRewards.toFixed(2)} XRP
            </div>
            <div className="text-purple-400 text-xs">
              {rewards.tokenCount} tokens created | All claimed!
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
