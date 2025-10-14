import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { XRPScanLink } from './XRPScanLink';

export default function TradeHistory({ tokenId, connectedWallet }) {
  const [myTrades, setMyTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [xrpUsdPrice, setXrpUsdPrice] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(3);

  useEffect(() => {
    fetchXrpPrice();
    fetchTradeHistory();

    const subscription = supabase
      .channel('trade_history_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_history',
        filter: `token_id=eq.${tokenId}`
      }, () => {
        fetchTradeHistory();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tokenId, connectedWallet]);

  const fetchXrpPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      setXrpUsdPrice(data.ripple?.usd || 0);
    } catch (error) {
      console.error('Error fetching XRP/USD price:', error);
    }
  };

  const fetchTradeHistory = async () => {
    try {
      setLoading(true);

      if (connectedWallet?.address) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: myTradesData, error: myError } = await supabase
          .from('trade_history')
          .select('*')
          .eq('token_id', tokenId)
          .eq('trader_address', connectedWallet.address)
          .gte('created_at', twentyFourHoursAgo)
          .order('created_at', { ascending: false })
          .limit(100);

        if (myError) throw myError;
        setMyTrades(myTradesData || []);
      } else {
        setMyTrades([]);
      }
    } catch (error) {
      console.error('Error fetching trade history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleString();
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderTradeTable = (trades) => {
    if (trades.length === 0) {
      return (
        <div className="text-center py-8 text-purple-400">
          <div className="text-4xl mb-2">📊</div>
          <div>No recent trades</div>
        </div>
      );
    }

    const tradesToDisplay = trades.slice(0, displayLimit);

    return (
      <div className="space-y-3">
        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
          {tradesToDisplay.map((trade) => (
            <div key={trade.id} className="glass rounded-lg p-3 hover:bg-purple-900/20 transition-all border border-purple-500/10">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  trade.trade_type === 'buy'
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {trade.trade_type === 'buy' ? '🟢 BUY' : '🔴 SELL'}
                </span>
                <span className="text-xs text-purple-400 font-medium">{formatTime(trade.created_at)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-purple-400 text-xs mb-1">Token Amount</div>
                  <div className="text-purple-200 font-bold">
                    {parseFloat(trade.token_amount).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 4
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-purple-400 text-xs mb-1">XRP Amount</div>
                  <div className="text-purple-200 font-bold">{parseFloat(trade.xrp_amount).toFixed(4)} XRP</div>
                  {xrpUsdPrice > 0 && (
                    <div className="text-green-400 text-xs">${(parseFloat(trade.xrp_amount) * xrpUsdPrice).toFixed(2)}</div>
                  )}
                </div>
                <div>
                  <div className="text-purple-400 text-xs mb-1">Price</div>
                  <div className="text-purple-300 text-xs font-mono">{parseFloat(trade.price).toFixed(8)} XRP</div>
                </div>
                <div className="text-right">
                  <div className="text-purple-400 text-xs mb-1">Transaction</div>
                  {trade.tx_hash ? (
                    <XRPScanLink type="tx" value={trade.tx_hash} network="mainnet" className="text-xs" />
                  ) : (
                    <span className="text-purple-500 text-xs">Pending</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {trades.length > displayLimit && (
          <button
            onClick={() => setDisplayLimit(prev => prev + 5)}
            className="w-full py-2 rounded-lg glass hover:bg-purple-500/20 text-purple-300 text-sm font-medium transition-all"
          >
            Load More ({trades.length - displayLimit} remaining)
          </button>
        )}
        {displayLimit > 3 && (
          <button
            onClick={() => setDisplayLimit(3)}
            className="w-full py-2 rounded-lg glass hover:bg-purple-500/20 text-purple-400 text-xs transition-all"
          >
            Show Less
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="glass rounded-lg p-4">
        <h3 className="text-lg font-bold text-purple-200 mb-4">Trade History</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-200">My Trades</h3>
        {myTrades.length > 0 && (
          <span className="text-sm text-purple-400">{myTrades.length} in 24h</span>
        )}
      </div>

      {!connectedWallet ? (
        <div className="text-center py-8 text-purple-400">
          <div className="text-4xl mb-2">🔒</div>
          <div>Connect wallet to view your trades</div>
        </div>
      ) : (
        renderTradeTable(myTrades)
      )}
    </div>
  );
}
