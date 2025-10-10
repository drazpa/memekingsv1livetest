import TokenIcon from './TokenIcon';
import { CategoryBadge, calculateDaysOnMarket } from '../utils/categoryUtils';

export default function TokenGridCard({ token, poolData, isFavorited, onToggleFavorite, onClick, showStats = true, showMemeKingBadge = true }) {
  const price = poolData?.price || 0;
  const marketCap = poolData?.marketCap || 0;
  const xrpLocked = poolData?.xrpAmount || 0;
  const tokenLocked = poolData?.tokenAmount || 0;

  const formatPrice = (val) => {
    if (val === 0) return '0.00';
    if (val < 0.000001) return val.toExponential(2);
    if (val < 0.01) return val.toFixed(6);
    return val.toFixed(4);
  };

  const formatMarketCap = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
  };

  const isMemeKingToken = token.issuer_address === 'rKxBBMmY969Ph1y63ddVfYyN7xmxwDfVq6';

  return (
    <div
      className="glass rounded-lg p-4 sm:p-6 hover:bg-purple-500/10 transition-all cursor-pointer space-y-3 sm:space-y-4"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <TokenIcon token={token} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="text-base sm:text-xl font-bold text-purple-200 truncate">{token.token_name}</h3>
              {onToggleFavorite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(token.id, e);
                  }}
                  className="text-base sm:text-lg hover:scale-110 transition-transform flex-shrink-0"
                >
                  {isFavorited ? '⭐' : '☆'}
                </button>
              )}
            </div>
            <div className="text-purple-400 text-xs sm:text-sm truncate">{token.currency_code}</div>
          </div>
        </div>

        {token.amm_pool_created ? (
          <span className="px-2 py-0.5 sm:py-1 bg-green-500/20 text-green-300 text-xs rounded-full whitespace-nowrap flex-shrink-0">
            ✓ Active
          </span>
        ) : (
          <span className="px-2 py-0.5 sm:py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full whitespace-nowrap flex-shrink-0">
            ⏳ Pending
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {token.category && <CategoryBadge category={token.category} size="sm" />}
        {showMemeKingBadge && isMemeKingToken && (
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full font-medium whitespace-nowrap">
            👑 MemeKing
          </span>
        )}
        {!isMemeKingToken && (
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full font-medium whitespace-nowrap">
            👤 Community
          </span>
        )}
        <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium whitespace-nowrap">
          📅 {calculateDaysOnMarket(token.created_at)}d
        </span>
      </div>

      {/* Stats Grid */}
      {showStats && poolData && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="glass rounded-lg p-2 sm:p-3">
              <div className="text-purple-400 text-xs mb-0.5 sm:mb-1">Price</div>
              <div className="text-purple-200 font-bold text-sm sm:text-lg truncate">{formatPrice(price)} XRP</div>
            </div>
            <div className="glass rounded-lg p-2 sm:p-3">
              <div className="text-purple-400 text-xs mb-0.5 sm:mb-1">Market Cap</div>
              <div className="text-purple-200 font-bold text-sm sm:text-lg truncate">{formatMarketCap(marketCap)} XRP</div>
            </div>
            <div className="glass rounded-lg p-2 sm:p-3">
              <div className="text-purple-400 text-xs mb-0.5 sm:mb-1">XRP Locked</div>
              <div className="text-purple-200 font-bold text-sm sm:text-lg truncate">{formatMarketCap(xrpLocked)} XRP</div>
            </div>
            <div className="glass rounded-lg p-2 sm:p-3">
              <div className="text-purple-400 text-xs mb-0.5 sm:mb-1">Supply</div>
              <div className="text-purple-200 font-bold text-sm sm:text-lg truncate">{(token.supply / 1000000).toFixed(2)}M</div>
            </div>
          </div>

          {/* % Change Indicators */}
          <div className="flex justify-around items-center py-1.5 sm:py-2 glass rounded-lg">
            <div className="text-center">
              <div className="text-purple-400 text-xs mb-0.5 sm:mb-1">1H %</div>
              <div className="text-gray-400 text-xs sm:text-sm">-</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 text-xs mb-0.5 sm:mb-1">24H %</div>
              <div className="text-gray-400 text-xs sm:text-sm">-</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 text-xs mb-0.5 sm:mb-1">7D %</div>
              <div className="text-gray-400 text-xs sm:text-sm">-</div>
            </div>
          </div>
        </>
      )}

      {/* No Pool Data Message */}
      {!poolData && token.amm_pool_created && (
        <div className="text-purple-400 text-sm text-center py-2">
          Loading pool data...
        </div>
      )}
    </div>
  );
}
