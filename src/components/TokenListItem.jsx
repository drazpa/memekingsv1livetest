import TokenIcon from './TokenIcon';

export default function TokenListItem({ token, poolData, isFavorited, onToggleFavorite, onClick, showStats = true, showMemeKingBadge = true }) {
  const price = poolData?.price || 0;
  const marketCap = poolData?.marketCap || 0;
  const xrpLocked = poolData?.xrpAmount || 0;

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
      className="glass rounded-lg p-4 hover:bg-purple-500/10 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Token Icon & Name */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <TokenIcon token={token} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-purple-200">{token.token_name}</h3>
              {showMemeKingBadge && isMemeKingToken && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-full font-medium">
                  👑 MemeKing
                </span>
              )}
              {token.amm_pool_created && (
                <span className="text-green-400 text-xs">✓ Active</span>
              )}
            </div>
            <div className="text-purple-400 text-sm">{token.currency_code}</div>
          </div>
        </div>

        {/* Price & Stats */}
        {showStats && poolData && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-purple-400 text-xs">Price</div>
              <div className="text-purple-200 font-bold">{formatPrice(price)} XRP</div>
            </div>
            <div className="text-right">
              <div className="text-purple-400 text-xs">Market Cap</div>
              <div className="text-purple-200 font-bold">{formatMarketCap(marketCap)} XRP</div>
            </div>
            <div className="text-right">
              <div className="text-purple-400 text-xs">Liquidity</div>
              <div className="text-purple-200 font-bold">{formatMarketCap(xrpLocked)} XRP</div>
            </div>

            {/* Placeholder for % change - will be calculated from historical data */}
            <div className="flex gap-2 text-xs">
              <div className="text-center">
                <div className="text-purple-400">1H</div>
                <div className="text-gray-400">-</div>
              </div>
              <div className="text-center">
                <div className="text-purple-400">24H</div>
                <div className="text-gray-400">-</div>
              </div>
              <div className="text-center">
                <div className="text-purple-400">7D</div>
                <div className="text-gray-400">-</div>
              </div>
            </div>
          </div>
        )}

        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(token.id, e);
            }}
            className="text-xl hover:scale-110 transition-transform flex-shrink-0"
          >
            {isFavorited ? '⭐' : '☆'}
          </button>
        )}
      </div>
    </div>
  );
}
