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
      className="glass rounded-lg p-6 hover:bg-purple-500/10 transition-all cursor-pointer space-y-4"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <TokenIcon token={token} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-purple-200">{token.token_name}</h3>
              {onToggleFavorite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(token.id, e);
                  }}
                  className="text-lg hover:scale-110 transition-transform"
                >
                  {isFavorited ? '⭐' : '☆'}
                </button>
              )}
            </div>
            <div className="text-purple-400 text-sm">{token.currency_code}</div>
          </div>
        </div>

        {token.amm_pool_created ? (
          <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
            ✓ Active
          </span>
        ) : (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
            ⏳ Pending
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {token.category && <CategoryBadge category={token.category} size="sm" />}
        {showMemeKingBadge && isMemeKingToken && (
          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full font-medium">
            👑 MemeKing
          </span>
        )}
        {!isMemeKingToken && (
          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full font-medium">
            👤 Community
          </span>
        )}
        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium">
          📅 {calculateDaysOnMarket(token.created_at)}d
        </span>
      </div>

      {/* Stats Grid */}
      {showStats && poolData && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-lg p-3">
              <div className="text-purple-400 text-xs mb-1">Price</div>
              <div className="text-purple-200 font-bold text-lg">{formatPrice(price)} XRP</div>
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-purple-400 text-xs mb-1">Market Cap</div>
              <div className="text-purple-200 font-bold text-lg">{formatMarketCap(marketCap)} XRP</div>
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-purple-400 text-xs mb-1">XRP Locked</div>
              <div className="text-purple-200 font-bold text-lg">{formatMarketCap(xrpLocked)} XRP</div>
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-purple-400 text-xs mb-1">Supply</div>
              <div className="text-purple-200 font-bold text-lg">{(token.supply / 1000000).toFixed(2)}M</div>
            </div>
          </div>

          {/* % Change Indicators */}
          <div className="flex justify-around items-center py-2 glass rounded-lg">
            <div className="text-center">
              <div className="text-purple-400 text-xs mb-1">1H %</div>
              <div className="text-gray-400 text-sm">-</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 text-xs mb-1">24H %</div>
              <div className="text-gray-400 text-sm">-</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 text-xs mb-1">7D %</div>
              <div className="text-gray-400 text-sm">-</div>
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
