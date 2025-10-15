import { useState, useEffect } from 'react';
import { getWalletRewards, claimRewards } from '../utils/rewardsUtils';
import toast from 'react-hot-toast';

export default function WalletRewards({ wallet, xrpPrice = 2.50 }) {
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
        `Successfully claimed ${result.amount.toFixed(2)} XRP from ${result.rewardsCount} token creation${result.rewardsCount > 1 ? 's' : ''}!`,
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
      <div className="glass rounded-lg p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-purple-500/20 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-purple-500/20 rounded"></div>
              <div className="h-4 bg-purple-500/20 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!rewards) return null;

  const unclaimedPercent = rewards.totalRewards > 0
    ? (rewards.totalUnclaimed / rewards.totalRewards) * 100
    : 0;
  const claimedPercent = rewards.totalRewards > 0
    ? (rewards.totalClaimed / rewards.totalRewards) * 100
    : 0;

  return (
    <div className="glass rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-purple-200">Token Creation Rewards</h3>
          <p className="text-purple-400 text-sm mt-1">Earn 0.10 XRP for every token you create</p>
        </div>
        {rewards.totalUnclaimed > 0 && (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="relative px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow"
            style={{
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)',
              animation: 'glow 2s ease-in-out infinite'
            }}
          >
            {claiming ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Claiming...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                💰 Claim {rewards.totalUnclaimed.toFixed(2)} XRP
              </span>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-inner rounded-lg p-4">
          <div className="text-purple-400 text-xs mb-1">Total Earned</div>
          <div className="text-2xl font-bold text-purple-200">{rewards.totalRewards.toFixed(2)} XRP</div>
          <div className="text-green-400 text-xs mt-1">${(rewards.totalRewards * xrpPrice).toFixed(2)} USD</div>
        </div>

        <div className="glass-inner rounded-lg p-4">
          <div className="text-purple-400 text-xs mb-1">Available to Claim</div>
          <div className="text-2xl font-bold text-green-400">{rewards.totalUnclaimed.toFixed(2)} XRP</div>
          <div className="text-green-400 text-xs mt-1">${(rewards.totalUnclaimed * xrpPrice).toFixed(2)} USD</div>
        </div>

        <div className="glass-inner rounded-lg p-4">
          <div className="text-purple-400 text-xs mb-1">Already Claimed</div>
          <div className="text-2xl font-bold text-purple-300">{rewards.totalClaimed.toFixed(2)} XRP</div>
          <div className="text-purple-400 text-xs mt-1">${(rewards.totalClaimed * xrpPrice).toFixed(2)} USD</div>
        </div>

        <div className="glass-inner rounded-lg p-4">
          <div className="text-purple-400 text-xs mb-1">Tokens Created</div>
          <div className="text-2xl font-bold text-purple-200">{rewards.tokenCount}</div>
          <div className="text-purple-400 text-xs mt-1">{rewards.unclaimedRewards.length} pending</div>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-purple-300">Rewards Distribution</span>
          <span className="text-purple-400">
            {unclaimedPercent.toFixed(1)}% Unclaimed | {claimedPercent.toFixed(1)}% Claimed
          </span>
        </div>
        <div className="h-4 bg-purple-900/30 rounded-full overflow-hidden flex">
          {rewards.totalRewards > 0 && (
            <>
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500"
                style={{ width: `${unclaimedPercent}%` }}
                title={`${rewards.totalUnclaimed.toFixed(2)} XRP Unclaimed`}
              />
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-700 transition-all duration-500"
                style={{ width: `${claimedPercent}%` }}
                title={`${rewards.totalClaimed.toFixed(2)} XRP Claimed`}
              />
            </>
          )}
        </div>
        <div className="flex justify-between text-xs mt-2">
          <span className="text-green-400">💰 Unclaimed</span>
          <span className="text-purple-400">✅ Claimed</span>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-300 text-sm font-medium mb-2">ℹ️ How Token Creation Rewards Work:</p>
        <ul className="text-blue-300/80 text-xs space-y-1 list-disc list-inside">
          <li>Earn 0.10 XRP instantly for each token you create</li>
          <li>Rewards accumulate in your account automatically</li>
          <li>Claim anytime with no fees - completely free</li>
          <li>XRP is sent directly from the platform wallet to your connected wallet</li>
          <li>Create more tokens to earn more rewards!</li>
        </ul>
      </div>

      <style>{`
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.7), 0 0 60px rgba(16, 185, 129, 0.5);
          }
        }
      `}</style>
    </div>
  );
}
