import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  purchaseFeaturedSpot,
  getActiveFeaturedSpots,
  checkSpotAvailability
} from '../utils/featuredSpotPurchase';
import TokenIcon from './TokenIcon';

export default function FeaturedSpotModal({ isOpen, onClose, token, walletSeed, walletAddress }) {
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [hours, setHours] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [activeSpots, setActiveSpots] = useState([]);
  const [spotAvailability, setSpotAvailability] = useState({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  const XRP_PER_HOUR = 1;
  const totalCost = hours * XRP_PER_HOUR;

  useEffect(() => {
    if (isOpen) {
      loadSpotData();
    }
  }, [isOpen]);

  const loadSpotData = async () => {
    setLoadingAvailability(true);
    try {
      const spots = await getActiveFeaturedSpots();
      setActiveSpots(spots);

      const availability = {};
      for (let i = 1; i <= 3; i++) {
        availability[i] = await checkSpotAvailability(i);
      }
      setSpotAvailability(availability);
    } catch (error) {
      console.error('Error loading spot data:', error);
      toast.error('Failed to load spot availability');
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedSpot) {
      toast.error('Please select a spot');
      return;
    }

    if (!walletSeed || !walletAddress) {
      toast.error('Wallet not connected');
      return;
    }

    if (!spotAvailability[selectedSpot]) {
      toast.error('This spot is currently occupied');
      return;
    }

    setIsPurchasing(true);
    const loadingToast = toast.loading('Processing payment...');

    try {
      const result = await purchaseFeaturedSpot({
        tokenId: token.id,
        spotPosition: selectedSpot,
        hours,
        walletSeed,
        walletAddress
      });

      toast.dismiss(loadingToast);
      toast.success(
        <div>
          <div className="font-bold">Featured spot purchased!</div>
          <div className="text-sm">
            {token.token_name} is now in spot #{selectedSpot} for {hours} hour{hours > 1 ? 's' : ''}
          </div>
        </div>,
        { duration: 5000 }
      );

      onClose();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to purchase featured spot');
    } finally {
      setIsPurchasing(false);
    }
  };

  const getSpotOccupant = (spotPos) => {
    return activeSpots.find(s => s.spot_position === spotPos);
  };

  const formatTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-purple-200">Purchase Featured Spot</h2>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {token && (
          <div className="glass rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <TokenIcon token={token} size="2xl" />
              <div>
                <h3 className="text-xl font-bold text-purple-200">{token.token_name}</h3>
                <p className="text-purple-400">{token.currency_code}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-purple-300 mb-3 font-semibold">Select Spot Position</label>
            {loadingAvailability ? (
              <div className="text-center text-purple-400 py-8">Loading availability...</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((spotNum) => {
                  const occupant = getSpotOccupant(spotNum);
                  const isAvailable = spotAvailability[spotNum];

                  return (
                    <button
                      key={spotNum}
                      type="button"
                      onClick={() => isAvailable && setSelectedSpot(spotNum)}
                      disabled={!isAvailable || isPurchasing}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedSpot === spotNum
                          ? 'border-green-500 bg-green-500/20'
                          : isAvailable
                          ? 'border-purple-500/30 bg-purple-500/10 hover:border-purple-500/50'
                          : 'border-red-500/30 bg-red-500/10 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-200 mb-2">
                          Spot #{spotNum}
                        </div>
                        {isAvailable ? (
                          <div className="text-green-400 text-sm font-medium">✓ Available</div>
                        ) : occupant ? (
                          <div className="text-red-400 text-xs">
                            <div>Occupied</div>
                            <div className="mt-1">{formatTimeRemaining(occupant.expires_at)}</div>
                          </div>
                        ) : (
                          <div className="text-red-400 text-sm">Occupied</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-purple-300 mb-2 font-semibold">Hours to Feature</label>
            <input
              type="number"
              min="1"
              max="168"
              value={hours}
              onChange={(e) => setHours(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-purple-900/30 border border-purple-500/30 rounded-lg px-4 py-3 text-purple-200 focus:outline-none focus:border-purple-500"
              disabled={isPurchasing}
            />
            <p className="text-purple-400 text-sm mt-2">
              1 XRP per hour. Maximum 168 hours (7 days).
            </p>
          </div>

          <div className="glass rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-purple-300">
              <span>Rate:</span>
              <span>{XRP_PER_HOUR} XRP/hour</span>
            </div>
            <div className="flex justify-between text-purple-300">
              <span>Duration:</span>
              <span>{hours} hour{hours > 1 ? 's' : ''}</span>
            </div>
            <div className="border-t border-purple-500/30 pt-2 mt-2">
              <div className="flex justify-between text-xl font-bold text-purple-200">
                <span>Total Cost:</span>
                <span>{totalCost} XRP</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-blue-400 text-xl">ℹ️</div>
              <div className="text-blue-200 text-sm space-y-1">
                <p><strong>How it works:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Your token will appear in the selected top spot</li>
                  <li>Featured tokens get premium visibility on the dashboard</li>
                  <li>The spot is reserved for the duration you purchase</li>
                  <li>After expiration, the spot becomes available again</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isPurchasing}
              className="flex-1 glass hover:bg-purple-500/20 text-purple-300 py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={!selectedSpot || isPurchasing || loadingAvailability}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPurchasing ? 'Processing...' : `Pay ${totalCost} XRP`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
