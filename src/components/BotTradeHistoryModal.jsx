import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export default function BotTradeHistoryModal({ bot, onClose }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();
  }, [bot.id]);

  const loadTrades = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bot_trades')
        .select('*')
        .eq('bot_id', bot.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTradeColor = (trade) => {
    if (trade.status === 'failed') return 'text-red-400';
    if (trade.trade_type === 'BUY') return 'text-green-400';
    if (trade.trade_type === 'SELL') return 'text-yellow-400';
    return 'text-gray-400';
  };

  const getTradeIcon = (trade) => {
    if (trade.status === 'failed') return '❌';
    if (trade.trade_type === 'BUY') return '📈';
    if (trade.trade_type === 'SELL') return '📉';
    return '⚠️';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-purple-200">
            Trade History: {bot.name}
          </h3>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-200 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-lg p-4 bg-purple-500/10">
            <div className="text-purple-400 text-xs mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-purple-200">{bot.total_trades || 0}</div>
          </div>
          <div className="glass rounded-lg p-4 bg-green-500/10">
            <div className="text-green-400 text-xs mb-1">Successful</div>
            <div className="text-2xl font-bold text-green-400">{bot.successful_trades || 0}</div>
          </div>
          <div className="glass rounded-lg p-4 bg-red-500/10">
            <div className="text-red-400 text-xs mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-400">{bot.failed_trades || 0}</div>
          </div>
          <div className="glass rounded-lg p-4 bg-blue-500/10">
            <div className="text-blue-400 text-xs mb-1">Success Rate</div>
            <div className="text-2xl font-bold text-blue-400">
              {bot.total_trades > 0
                ? ((bot.successful_trades / bot.total_trades) * 100).toFixed(1)
                : 0}%
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-purple-300">Loading trades...</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-purple-200 mb-2">No Trades Yet</h3>
            <p className="text-purple-400">This bot hasn't executed any trades yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-4 px-4 py-2 text-purple-400 text-sm font-medium border-b border-purple-500/30">
              <div>Type</div>
              <div className="text-right">Amount</div>
              <div className="text-right">XRP Cost</div>
              <div className="text-right">Price</div>
              <div className="text-right">Status</div>
              <div className="text-right">Time</div>
              <div className="text-center">TX</div>
            </div>
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="glass rounded-lg p-4 grid grid-cols-7 gap-4 items-center hover:bg-purple-500/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getTradeIcon(trade)}</span>
                  <span className={`font-bold ${getTradeColor(trade)}`}>
                    {trade.trade_type}
                  </span>
                </div>
                <div className="text-right text-purple-200 font-medium">
                  {parseFloat(trade.amount).toFixed(4)}
                </div>
                <div className="text-right text-purple-200 font-medium">
                  {parseFloat(trade.xrp_cost).toFixed(4)} XRP
                </div>
                <div className="text-right text-purple-300 text-sm">
                  {parseFloat(trade.price).toFixed(8)}
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      trade.status === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {trade.status}
                  </span>
                </div>
                <div className="text-right text-purple-400 text-xs">
                  {new Date(trade.created_at).toLocaleTimeString()}
                </div>
                <div className="text-center">
                  {trade.tx_hash ? (
                    <a
                      href={`https://xrpscan.com/tx/${trade.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-xs underline flex items-center justify-center gap-1"
                      title="View on XRPScan (Mainnet)"
                    >
                      <span>🔍</span>
                      <span>View</span>
                    </a>
                  ) : (
                    <span className="text-gray-500 text-xs">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-purple-500/30">
          <button
            onClick={onClose}
            className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
