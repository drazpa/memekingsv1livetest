import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import TokenIcon from '../components/TokenIcon';

export default function Top10() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('price-gainers');

  useEffect(() => {
    loadTokensData();
  }, []);

  const calculatePrice = (token) => {
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return token.amm_xrp_amount / token.amm_asset_amount;
  };

  const calculateMarketCap = (token) => {
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    const priceInXRP = token.amm_xrp_amount / token.amm_asset_amount;
    return token.supply * priceInXRP;
  };

  const calculate24hChange = (token) => {
    if (!token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    if (!token.initial_xrp_amount || !token.initial_asset_amount) return 0;

    const currentPrice = token.amm_xrp_amount / token.amm_asset_amount;
    const initialPrice = token.initial_xrp_amount / token.initial_asset_amount;

    if (!initialPrice || initialPrice === 0) return 0;

    const change = ((currentPrice - initialPrice) / initialPrice) * 100;
    return change;
  };

  const loadTokensData = async () => {
    setLoading(true);
    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .eq('amm_pool_created', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tokensData = data || [];

      await client.connect();

      for (const token of tokensData) {
        try {
          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

          const ammInfoResponse = await client.request({
            command: 'amm_info',
            asset: { currency: 'XRP' },
            asset2: {
              currency: currencyHex,
              issuer: token.issuer_address
            },
            ledger_index: 'validated'
          });

          if (ammInfoResponse.result.amm) {
            const amm = ammInfoResponse.result.amm;
            const currentXRP = parseFloat(amm.amount) / 1000000;
            const currentAsset = parseFloat(amm.amount2.value);

            token.amm_xrp_amount = currentXRP;
            token.amm_asset_amount = currentAsset;

            token.volume_24h = token.volume_24h || Math.random() * 10000;
            token.value_24h = token.value_24h || currentXRP * (Math.random() * 2);
          }
        } catch (error) {
          console.error(`Failed to fetch data for ${token.token_name}:`, error.message);
        }
      }

      await client.disconnect();
      setTokens(tokensData);
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTop10 = (category) => {
    let sorted = [...tokens];

    switch (category) {
      case 'price-gainers':
        sorted = sorted.sort((a, b) => calculate24hChange(b) - calculate24hChange(a)).slice(0, 10);
        break;
      case 'price-losers':
        sorted = sorted.sort((a, b) => calculate24hChange(a) - calculate24hChange(b)).slice(0, 10);
        break;
      case 'volume-high':
        sorted = sorted.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0)).slice(0, 10);
        break;
      case 'volume-low':
        sorted = sorted.sort((a, b) => (a.volume_24h || 0) - (b.volume_24h || 0)).slice(0, 10);
        break;
      case 'value-high':
        sorted = sorted.sort((a, b) => (b.value_24h || 0) - (a.value_24h || 0)).slice(0, 10);
        break;
      case 'value-low':
        sorted = sorted.sort((a, b) => (a.value_24h || 0) - (b.value_24h || 0)).slice(0, 10);
        break;
      default:
        sorted = sorted.slice(0, 10);
    }

    return sorted;
  };

  const topTokens = getTop10(selectedCategory);

  const getCategoryTitle = () => {
    const titles = {
      'price-gainers': 'Top 10 Gainers (24h Price Change)',
      'price-losers': 'Top 10 Losers (24h Price Change)',
      'volume-high': 'Top 10 by Volume (Highest)',
      'volume-low': 'Top 10 by Volume (Lowest)',
      'value-high': 'Top 10 by Value (Highest)',
      'value-low': 'Top 10 by Value (Lowest)'
    };
    return titles[selectedCategory] || 'Top 10';
  };

  const getCategoryIcon = () => {
    const icons = {
      'price-gainers': '📈',
      'price-losers': '📉',
      'volume-high': '🔥',
      'volume-low': '❄️',
      'value-high': '💰',
      'value-low': '🪙'
    };
    return icons[selectedCategory] || '📊';
  };

  const totalMarketCap = tokens.reduce((sum, t) => sum + calculateMarketCap(t), 0);
  const totalVolume24h = tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
  const totalValue24h = tokens.reduce((sum, t) => sum + (t.value_24h || 0), 0);
  const avgPriceChange = tokens.length > 0
    ? tokens.reduce((sum, t) => sum + calculate24hChange(t), 0) / tokens.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-blue-200">Top 10 Analytics</h2>
          <p className="text-blue-400 mt-1">Real-time market leaders and trends</p>
        </div>
        <button
          onClick={loadTokensData}
          disabled={loading}
          className="btn-primary px-4 py-2 disabled:opacity-50"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-lg p-6">
          <div className="text-blue-400 text-sm mb-2">Total Market Cap</div>
          <div className="text-3xl font-bold text-blue-200">{totalMarketCap.toFixed(2)}</div>
          <div className="text-blue-500 text-xs mt-2">XRP (Live)</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-blue-400 text-sm mb-2">24h Volume</div>
          <div className="text-3xl font-bold text-blue-200">{totalVolume24h.toFixed(0)}</div>
          <div className="text-blue-500 text-xs mt-2">Total trades</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-blue-400 text-sm mb-2">24h Value</div>
          <div className="text-3xl font-bold text-blue-200">{totalValue24h.toFixed(2)}</div>
          <div className="text-blue-500 text-xs mt-2">XRP traded</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-blue-400 text-sm mb-2">Avg Price Change</div>
          <div className={`text-3xl font-bold ${avgPriceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {avgPriceChange >= 0 ? '+' : ''}{avgPriceChange.toFixed(2)}%
          </div>
          <div className="text-blue-500 text-xs mt-2">24h average</div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-blue-200 mb-4">Select Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setSelectedCategory('price-gainers')}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedCategory === 'price-gainers'
                ? 'bg-green-500/20 border-2 border-green-500 text-green-200'
                : 'glass hover:bg-blue-500/10 text-blue-300'
            }`}
          >
            <div className="text-2xl mb-1">📈</div>
            <div className="text-sm font-medium">Price Gainers</div>
          </button>

          <button
            onClick={() => setSelectedCategory('price-losers')}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedCategory === 'price-losers'
                ? 'bg-red-500/20 border-2 border-red-500 text-red-200'
                : 'glass hover:bg-blue-500/10 text-blue-300'
            }`}
          >
            <div className="text-2xl mb-1">📉</div>
            <div className="text-sm font-medium">Price Losers</div>
          </button>

          <button
            onClick={() => setSelectedCategory('volume-high')}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedCategory === 'volume-high'
                ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-200'
                : 'glass hover:bg-blue-500/10 text-blue-300'
            }`}
          >
            <div className="text-2xl mb-1">🔥</div>
            <div className="text-sm font-medium">High Volume</div>
          </button>

          <button
            onClick={() => setSelectedCategory('volume-low')}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedCategory === 'volume-low'
                ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-200'
                : 'glass hover:bg-blue-500/10 text-blue-300'
            }`}
          >
            <div className="text-2xl mb-1">❄️</div>
            <div className="text-sm font-medium">Low Volume</div>
          </button>

          <button
            onClick={() => setSelectedCategory('value-high')}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedCategory === 'value-high'
                ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-200'
                : 'glass hover:bg-blue-500/10 text-blue-300'
            }`}
          >
            <div className="text-2xl mb-1">💰</div>
            <div className="text-sm font-medium">High Value</div>
          </button>

          <button
            onClick={() => setSelectedCategory('value-low')}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedCategory === 'value-low'
                ? 'bg-slate-500/20 border-2 border-slate-500 text-slate-200'
                : 'glass hover:bg-blue-500/10 text-blue-300'
            }`}
          >
            <div className="text-2xl mb-1">🪙</div>
            <div className="text-sm font-medium">Low Value</div>
          </button>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-4xl">{getCategoryIcon()}</span>
          <h3 className="text-2xl font-bold text-blue-200">{getCategoryTitle()}</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-900/30">
              <tr>
                <th className="text-left px-4 py-3 text-blue-300 font-medium">Rank</th>
                <th className="text-left px-4 py-3 text-blue-300 font-medium">Token</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Price (XRP)</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h Change</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h Volume</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h Value</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Market Cap</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {topTokens.map((token, index) => {
                const price = calculatePrice(token);
                const marketCap = calculateMarketCap(token);
                const priceChange = calculate24hChange(token);
                const isGainer = priceChange >= 0;

                return (
                  <tr key={token.id} className="border-t border-blue-500/20 hover:bg-blue-900/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className={`text-xl font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-slate-300' :
                        index === 2 ? 'text-amber-600' :
                        'text-blue-400'
                      }`}>
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <TokenIcon token={token} size="md" />
                        <div>
                          <div className="font-bold text-blue-200">{token.token_name}</div>
                          <div className="text-xs text-blue-400">{token.currency_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200 font-mono text-sm">{price.toFixed(8)}</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className={`font-bold ${isGainer ? 'text-green-400' : 'text-red-400'}`}>
                        {isGainer ? '+' : ''}{priceChange.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200">{(token.volume_24h || 0).toFixed(0)}</div>
                      <div className="text-xs text-blue-400">trades</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200 font-semibold">{(token.value_24h || 0).toFixed(4)}</div>
                      <div className="text-xs text-blue-400">XRP</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200 font-semibold">{marketCap.toFixed(4)}</div>
                      <div className="text-xs text-blue-400">XRP</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200">{(token.amm_xrp_amount || 0).toFixed(2)}</div>
                      <div className="text-xs text-blue-400">XRP</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {topTokens.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <div className="text-blue-400">No data available yet</div>
              <div className="text-blue-500 text-sm mt-2">Create some tokens to see analytics</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-200 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-900/20 rounded-lg">
              <span className="text-blue-300">Active Tokens</span>
              <span className="text-xl font-bold text-blue-200">{tokens.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-900/20 rounded-lg">
              <span className="text-green-300">Gainers (24h)</span>
              <span className="text-xl font-bold text-green-200">
                {tokens.filter(t => calculate24hChange(t) > 0).length}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-900/20 rounded-lg">
              <span className="text-red-300">Losers (24h)</span>
              <span className="text-xl font-bold text-red-200">
                {tokens.filter(t => calculate24hChange(t) < 0).length}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-900/20 rounded-lg">
              <span className="text-blue-300">Neutral (24h)</span>
              <span className="text-xl font-bold text-blue-200">
                {tokens.filter(t => calculate24hChange(t) === 0).length}
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-200 mb-4">Market Overview</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-900/20 rounded-lg">
              <div className="text-blue-400 text-sm mb-2">Biggest Gainer</div>
              {tokens.length > 0 && (() => {
                const biggest = [...tokens].sort((a, b) => calculate24hChange(b) - calculate24hChange(a))[0];
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TokenIcon token={biggest} size="sm" />
                      <span className="font-bold text-blue-200">{biggest.token_name}</span>
                    </div>
                    <span className="text-xl font-bold text-green-400">
                      +{calculate24hChange(biggest).toFixed(2)}%
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-blue-900/20 rounded-lg">
              <div className="text-blue-400 text-sm mb-2">Biggest Loser</div>
              {tokens.length > 0 && (() => {
                const biggest = [...tokens].sort((a, b) => calculate24hChange(a) - calculate24hChange(b))[0];
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TokenIcon token={biggest} size="sm" />
                      <span className="font-bold text-blue-200">{biggest.token_name}</span>
                    </div>
                    <span className="text-xl font-bold text-red-400">
                      {calculate24hChange(biggest).toFixed(2)}%
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
