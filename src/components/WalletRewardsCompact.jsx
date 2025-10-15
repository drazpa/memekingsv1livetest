import { useState, useEffect } from 'react';
import { getWalletRewards, claimRewards } from '../utils/rewardsUtils';
import toast from 'react-hot-toast';

export default function WalletRewardsCompact({ wallet, xrpPrice = 2.50 }) {
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

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

  const handleClaimClick = () => {
    setShowClaimModal(true);
  };

  const handleClaim = async () => {
    if (!wallet?.seed && !wallet?.encrypted_seed) {
      toast.error('Wallet seed not available');
      setShowClaimModal(false);
      return;
    }

    if (rewards.totalUnclaimed === 0) {
      toast.error('No rewards to claim');
      setShowClaimModal(false);
      return;
    }

    try {
      setClaiming(true);
      const seed = wallet.seed || wallet.encrypted_seed;
      const result = await claimRewards(wallet.address, seed);

      toast.success(
        `Successfully claimed ${result.amount.toFixed(2)} XRP from ${result.rewardsCount} token creation${result.rewardsCount > 1 ? 's' : ''}!`,
        { duration: 5000 }
      );

      setShowClaimModal(false);
      await loadRewards();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error(error.message || 'Failed to claim rewards');
      setShowClaimModal(false);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-purple-900/20 rounded-lg p-3">
        <div className="animate-pulse">
          <div className="h-3 bg-purple-500/20 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-purple-500/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!rewards) return null;

  return (
    <>
      <div className={`bg-purple-900/20 border rounded-lg p-3 ${
        rewards.totalUnclaimed > 0 ? 'border-green-500/40' : 'border-purple-500/30'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-purple-400 text-xs">XRP Rewards</div>
          <div className={`text-lg font-bold ${
            rewards.totalUnclaimed > 0 ? 'text-green-400' : 'text-purple-300'
          }`}>
            {rewards.totalUnclaimed.toFixed(2)} XRP
          </div>
        </div>

        <button
          onClick={handleClaimClick}
          className={`w-full text-xs font-medium px-3 py-2 rounded transition-all ${
            rewards.totalUnclaimed > 0
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
          style={{
            boxShadow: rewards.totalUnclaimed > 0 ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none',
            animation: rewards.totalUnclaimed > 0 ? 'glow-pulse 2s ease-in-out infinite' : 'none'
          }}
        >
          Claim {rewards.totalUnclaimed.toFixed(2)} XRP
        </button>

        {rewards.totalRewards > 0 && (
          <div className="text-purple-400 text-xs mt-2">
            Total Earned: {rewards.totalRewards.toFixed(2)} XRP ({rewards.tokenCount} tokens)
          </div>
        )}
      </div>

      {showClaimModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowClaimModal(false)}>
          <div className="glass rounded-lg max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-purple-200 mb-4">Claim Rewards</h3>

            <div className="space-y-4 mb-6">
              <div className="glass-inner rounded-lg p-4">
                <div className="text-purple-400 text-sm mb-2">Wallet</div>
                <div className="text-sm font-mono text-purple-200 break-all">{wallet.address}</div>
              </div>

              <div className="glass-inner rounded-lg p-4">
                <div className="text-purple-400 text-sm mb-2">Amount to Claim</div>
                <div className="text-3xl font-bold text-green-400">{rewards.totalUnclaimed.toFixed(2)} XRP</div>
                <div className="text-green-300 text-sm mt-1">${(rewards.totalUnclaimed * xrpPrice).toFixed(2)} USD</div>
              </div>

              {rewards.totalUnclaimed === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-300 text-sm">No rewards available to claim. Create tokens on the Memes page to earn 0.10 XRP per token!</p>
                </div>
              )}

              {rewards.totalUnclaimed > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    <strong>Claiming Process:</strong><br/>
                    - From {rewards.unclaimedRewards.length} token creation{rewards.unclaimedRewards.length > 1 ? 's' : ''}<br/>
                    - No fees - completely free!<br/>
                    - Takes a few seconds to process
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {rewards.totalUnclaimed > 0 ? (
                <>
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {claiming ? '⏳ Claiming...' : `💰 Claim ${rewards.totalUnclaimed.toFixed(2)} XRP`}
                  </button>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    disabled={claiming}
                    className="btn text-purple-300 px-6 py-3 rounded-lg font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-lg"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}
