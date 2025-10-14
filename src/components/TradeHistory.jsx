import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { XRPScanLink } from './XRPScanLink';

export default function TradeHistory({ tokenId, connectedWallet }) {
  const [myTrades, setMyTrades] = useState([]);
  const [poolTrades, setPoolTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [xrpUsdPrice, setXrpUsdPrice] = useState(0);
  const [activeTab, setActiveTab] = useState('my');

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
        const { data: myTradesData, error: myError } = await supabase
          .from('trade_history')
          .select('*')
          .eq('token_id', tokenId)
          .eq('trader_address', connectedWallet.address)
          .order('created_at', { ascending: false })
          .limit(3);

        if (myError) throw myError;
        setMyTrades(myTradesData || []);
      } else {
        setMyTrades([]);
      }

      const { data: poolTradesData, error: poolError } = await supabase
        .from('trade_history')
        .select('*')
        .eq('token_id', tokenId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (poolError) throw poolError;
      setPoolTrades(poolTradesData || []);
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

  const renderTradeTable = (trades, showTrader = true) => {
    if (trades.length === 0) {
      return (
        <div className="text-center py-8 text-purple-400">
          <div className="text-4xl mb-2">📊</div>
          <div>No recent trades</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-purple-400 border-b border-purple-500/20">
            <tr>
              <th className="text-left py-2 px-2">Type</th>
              {showTrader && <th className="text-left py-2 px-2">Trader</th>}
              <th className="text-right py-2 px-2">Token Amount</th>
              <th className="text-right py-2 px-2">XRP Amount</th>
              <th className="text-right py-2 px-2">Price</th>
              <th className="text-right py-2 px-2">Time</th>
              <th className="text-right py-2 px-2">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-b border-purple-500/10 hover:bg-purple-900/20">
                <td className="py-3 px-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    trade.trade_type === 'buy'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}>
                    {trade.trade_type === 'buy' ? '🟢 BUY' : '🔴 SELL'}
                  </span>
                </td>
                {showTrader && (
                  <td className="py-3 px-2">
                    <div className="font-mono text-purple-200">{formatAddress(trade.trader_address)}</div>
                  </td>
                )}
                <td className="py-3 px-2 text-right">
                  <div className="text-purple-200 font-medium">
                    {parseFloat(trade.token_amount).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2
                    })}
                  </div>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="text-purple-200 font-medium">{parseFloat(trade.xrp_amount).toFixed(4)} XRP</div>
                  <div className="text-green-400 text-xs">${(parseFloat(trade.xrp_amount) * xrpUsdPrice).toFixed(2)}</div>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="text-purple-200">{parseFloat(trade.price).toFixed(8)}</div>
                  <div className="text-purple-400 text-xs">XRP</div>
                </td>
                <td className="py-3 px-2 text-right text-purple-400">
                  {formatTime(trade.created_at)}
                </td>
                <td className="py-3 px-2 text-right">
                  {trade.tx_hash ? (
                    <XRPScanLink type="tx" value={trade.tx_hash} network="mainnet" className="text-xs" />
                  ) : (
                    <span className="text-purple-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <h3 className="text-lg font-bold text-purple-200 mb-4">Trade History</h3>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'my'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
              : 'glass text-purple-300 hover:text-purple-200'
          }`}
        >
          My Trades ({myTrades.length})
        </button>
        <button
          onClick={() => setActiveTab('pool')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'pool'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
              : 'glass text-purple-300 hover:text-purple-200'
          }`}
        >
          Pool Trades ({poolTrades.length})
        </button>
      </div>

      {activeTab === 'my' ? (
        <>
          {!connectedWallet ? (
            <div className="text-center py-8 text-purple-400">
              <div className="text-4xl mb-2">🔒</div>
              <div>Connect wallet to view your trades</div>
            </div>
          ) : (
            <>
              {renderTradeTable(myTrades, false)}
              {myTrades.length === 3 && (
                <div className="text-center mt-3 text-sm text-purple-400">
                  Showing latest 3 trades
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {renderTradeTable(poolTrades, true)}
          {poolTrades.length === 3 && (
            <div className="text-center mt-3 text-sm text-purple-400">
              Showing latest 3 trades
            </div>
          )}
        </>
      )}
    </div>
  );
}
