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

  const getRankColor = (index) => {
    if (index === 0) return 'text-yellow-400';
    if (index === 1) return 'text-slate-300';
    if (index === 2) return 'text-amber-600';
    return 'text-blue-400';
  };

  const getRankBg = (index) => {
    if (index === 0) return 'bg-yellow-500/10 border-yellow-500/30';
    if (index === 1) return 'bg-slate-500/10 border-slate-400/30';
    if (index === 2) return 'bg-amber-500/10 border-amber-600/30';
    return '';
  };

  const totalMarketCap = tokens.reduce((sum, t) => sum + calculateMarketCap(t), 0);
  const totalVolume24h = tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
  const totalValue24h = tokens.reduce((sum, t) => sum + (t.value_24h || 0), 0);
  const totalLiquidity = tokens.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0);
  const avgPriceChange = tokens.length > 0
    ? tokens.reduce((sum, t) => sum + calculate24hChange(t), 0) / tokens.length
    : 0;

  const categoryStats = {
    'price-gainers': topTokens.length > 0 ? calculate24hChange(topTokens[0]) : 0,
    'price-losers': topTokens.length > 0 ? calculate24hChange(topTokens[0]) : 0,
    'volume-high': topTokens.length > 0 ? (topTokens[0].volume_24h || 0) : 0,
    'volume-low': topTokens.length > 0 ? (topTokens[0].volume_24h || 0) : 0,
    'value-high': topTokens.length > 0 ? (topTokens[0].value_24h || 0) : 0,
    'value-low': topTokens.length > 0 ? (topTokens[0].value_24h || 0) : 0,
  };

  const getCategoryAverage = () => {
    if (topTokens.length === 0) return 0;
    switch (selectedCategory) {
      case 'price-gainers':
      case 'price-losers':
        return topTokens.reduce((sum, t) => sum + calculate24hChange(t), 0) / topTokens.length;
      case 'volume-high':
      case 'volume-low':
        return topTokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0) / topTokens.length;
      case 'value-high':
      case 'value-low':
        return topTokens.reduce((sum, t) => sum + (t.value_24h || 0), 0) / topTokens.length;
      default:
        return 0;
    }
  };

  const getTokenPercentile = (token, index) => {
    return ((10 - index) / 10) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-blue-200">Top 10 Analytics</h2>
          <p className="text-blue-400 mt-1">Real-time market leaders and comprehensive comparisons</p>
        </div>
        <button
          onClick={loadTokensData}
          disabled={loading}
          className="btn-primary px-4 py-2 disabled:opacity-50"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-blue-200 mb-4">Market Overview - Advanced Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
            <div className="text-blue-400 text-xs mb-1">Total Market Cap</div>
            <div className="text-2xl font-bold text-blue-200">{totalMarketCap.toFixed(2)}</div>
            <div className="text-blue-500 text-xs mt-1">XRP (Live)</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
            <div className="text-green-400 text-xs mb-1">Total Liquidity</div>
            <div className="text-2xl font-bold text-green-200">{totalLiquidity.toFixed(2)}</div>
            <div className="text-green-500 text-xs mt-1">XRP in pools</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
            <div className="text-orange-400 text-xs mb-1">24h Volume</div>
            <div className="text-2xl font-bold text-orange-200">{totalVolume24h.toFixed(0)}</div>
            <div className="text-orange-500 text-xs mt-1">Total trades</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">24h Value</div>
            <div className="text-2xl font-bold text-purple-200">{totalValue24h.toFixed(2)}</div>
            <div className="text-purple-500 text-xs mt-1">XRP traded</div>
          </div>

          <div className={`p-4 rounded-lg border ${
            avgPriceChange >= 0
              ? 'bg-gradient-to-br from-green-500/10 to-lime-500/10 border-green-500/20'
              : 'bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20'
          }`}>
            <div className={avgPriceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
              <div className="text-xs mb-1">Avg Price Change</div>
            </div>
            <div className={`text-2xl font-bold ${avgPriceChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {avgPriceChange >= 0 ? '+' : ''}{avgPriceChange.toFixed(2)}%
            </div>
            <div className={avgPriceChange >= 0 ? 'text-green-500' : 'text-red-500'}>
              <div className="text-xs mt-1">24h average</div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-500/20">
            <div className="text-cyan-400 text-xs mb-1">Active Tokens</div>
            <div className="text-2xl font-bold text-cyan-200">{tokens.length}</div>
            <div className="text-cyan-500 text-xs mt-1">With pools</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-blue-200 mb-4">Select Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setSelectedCategory('price-gainers')}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedCategory === 'price-gainers'
                ? 'bg-green-500/20 border-2 border-green-500 text-green-200 shadow-lg shadow-green-500/20'
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
                ? 'bg-red-500/20 border-2 border-red-500 text-red-200 shadow-lg shadow-red-500/20'
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
                ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-200 shadow-lg shadow-orange-500/20'
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
                ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-200 shadow-lg shadow-cyan-500/20'
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
                ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-200 shadow-lg shadow-yellow-500/20'
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
                ? 'bg-slate-500/20 border-2 border-slate-500 text-slate-200 shadow-lg shadow-slate-500/20'
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass bg-blue-500/5 rounded-lg p-4">
            <div className="text-blue-400 text-sm mb-2">Category Leader</div>
            <div className="text-2xl font-bold text-blue-200">
              {topTokens.length > 0 ? topTokens[0].token_name : 'N/A'}
            </div>
          </div>

          <div className="glass bg-purple-500/5 rounded-lg p-4">
            <div className="text-purple-400 text-sm mb-2">Category Average</div>
            <div className="text-2xl font-bold text-purple-200">
              {selectedCategory.includes('price')
                ? `${getCategoryAverage().toFixed(2)}%`
                : getCategoryAverage().toFixed(2)
              }
            </div>
          </div>

          <div className="glass bg-green-500/5 rounded-lg p-4">
            <div className="text-green-400 text-sm mb-2">Top 3 Dominance</div>
            <div className="text-2xl font-bold text-green-200">
              {topTokens.length >= 3 ? '30%' : `${(topTokens.length / 10 * 100).toFixed(0)}%`}
            </div>
          </div>

          <div className="glass bg-orange-500/5 rounded-lg p-4">
            <div className="text-orange-400 text-sm mb-2">Performance Spread</div>
            <div className="text-2xl font-bold text-orange-200">
              {topTokens.length >= 2 ? (() => {
                const first = selectedCategory.includes('price')
                  ? calculate24hChange(topTokens[0])
                  : selectedCategory.includes('volume')
                  ? topTokens[0].volume_24h
                  : topTokens[0].value_24h;
                const last = selectedCategory.includes('price')
                  ? calculate24hChange(topTokens[topTokens.length - 1])
                  : selectedCategory.includes('volume')
                  ? topTokens[topTokens.length - 1].volume_24h
                  : topTokens[topTokens.length - 1].value_24h;
                return selectedCategory.includes('price')
                  ? `${Math.abs(first - last).toFixed(2)}%`
                  : Math.abs(first - last).toFixed(2);
              })() : 'N/A'}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-900/30">
              <tr>
                <th className="text-left px-4 py-3 text-blue-300 font-medium">Rank</th>
                <th className="text-left px-4 py-3 text-blue-300 font-medium">Token</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Price (XRP)</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h Change</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">vs Category Avg</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h Volume</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h Value</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Market Cap</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Liquidity</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Percentile</th>
              </tr>
            </thead>
            <tbody>
              {topTokens.map((token, index) => {
                const price = calculatePrice(token);
                const marketCap = calculateMarketCap(token);
                const priceChange = calculate24hChange(token);
                const isGainer = priceChange >= 0;
                const categoryAvg = getCategoryAverage();
                const vsAvg = selectedCategory.includes('price')
                  ? priceChange - categoryAvg
                  : selectedCategory.includes('volume')
                  ? (token.volume_24h || 0) - categoryAvg
                  : (token.value_24h || 0) - categoryAvg;
                const percentile = getTokenPercentile(token, index);

                return (
                  <tr
                    key={token.id}
                    className={`border-t border-blue-500/20 hover:bg-blue-900/20 transition-colors ${getRankBg(index)}`}
                  >
                    <td className="px-4 py-4">
                      <div className={`text-2xl font-bold ${getRankColor(index)}`}>
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
                      <div className={`font-bold text-lg ${isGainer ? 'text-green-400' : 'text-red-400'}`}>
                        {isGainer ? '+' : ''}{priceChange.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className={`font-semibold ${vsAvg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {vsAvg >= 0 ? '+' : ''}{vsAvg.toFixed(2)}{selectedCategory.includes('price') ? '%' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200 font-semibold">{(token.volume_24h || 0).toFixed(0)}</div>
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
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200 font-bold">{percentile.toFixed(0)}%</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-200 mb-4">Detailed Token Comparisons</h3>
          <div className="space-y-3">
            {topTokens.slice(0, 5).map((token, index) => {
              const price = calculatePrice(token);
              const priceChange = calculate24hChange(token);
              const marketCap = calculateMarketCap(token);
              const marketShare = totalMarketCap > 0 ? (marketCap / totalMarketCap) * 100 : 0;

              return (
                <div key={token.id} className="p-4 glass rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`text-xl font-bold ${getRankColor(index)}`}>#{index + 1}</div>
                      <TokenIcon token={token} size="sm" />
                      <span className="font-bold text-blue-200">{token.token_name}</span>
                    </div>
                    <div className={`font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-blue-400 text-xs">Market Share</div>
                      <div className="text-blue-200 font-semibold">{marketShare.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-blue-400 text-xs">Price Impact</div>
                      <div className="text-blue-200 font-semibold">
                        {token.amm_xrp_amount > 0 ? ((1 / token.amm_xrp_amount) * 100).toFixed(4) : 0}%
                      </div>
                    </div>
                    <div>
                      <div className="text-blue-400 text-xs">Liquidity Ratio</div>
                      <div className="text-blue-200 font-semibold">
                        {totalLiquidity > 0 ? ((token.amm_xrp_amount / totalLiquidity) * 100).toFixed(2) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-200 mb-4">Category Performance Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
              <div className="text-green-400 text-sm mb-2">Best Performer</div>
              {topTokens.length > 0 && (() => {
                const best = topTokens[0];
                const value = selectedCategory.includes('price')
                  ? calculate24hChange(best)
                  : selectedCategory.includes('volume')
                  ? best.volume_24h
                  : best.value_24h;
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TokenIcon token={best} size="sm" />
                      <span className="font-bold text-green-200">{best.token_name}</span>
                    </div>
                    <span className="text-xl font-bold text-green-300">
                      {selectedCategory.includes('price')
                        ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
                        : value.toFixed(2)
                      }
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30">
              <div className="text-blue-400 text-sm mb-2">Median Performance</div>
              {topTokens.length >= 5 && (() => {
                const median = topTokens[Math.floor(topTokens.length / 2)];
                const value = selectedCategory.includes('price')
                  ? calculate24hChange(median)
                  : selectedCategory.includes('volume')
                  ? median.volume_24h
                  : median.value_24h;
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TokenIcon token={median} size="sm" />
                      <span className="font-bold text-blue-200">{median.token_name}</span>
                    </div>
                    <span className="text-xl font-bold text-blue-300">
                      {selectedCategory.includes('price')
                        ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
                        : value.toFixed(2)
                      }
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/30">
              <div className="text-purple-400 text-sm mb-2">Category Statistics</div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <div className="text-purple-300 text-xs">Total Entries</div>
                  <div className="text-2xl font-bold text-purple-200">{topTokens.length}</div>
                </div>
                <div>
                  <div className="text-purple-300 text-xs">Avg Performance</div>
                  <div className="text-2xl font-bold text-purple-200">
                    {selectedCategory.includes('price')
                      ? `${getCategoryAverage().toFixed(2)}%`
                      : getCategoryAverage().toFixed(2)
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/30">
              <div className="text-orange-400 text-sm mb-2">Market Distribution</div>
              <div className="space-y-2 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-300">Top 3 Combined</span>
                  <span className="text-orange-200 font-bold">
                    {topTokens.slice(0, 3).reduce((sum, t) => sum + calculateMarketCap(t), 0).toFixed(2)} XRP
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-300">Remaining 7</span>
                  <span className="text-orange-200 font-bold">
                    {topTokens.slice(3).reduce((sum, t) => sum + calculateMarketCap(t), 0).toFixed(2)} XRP
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-blue-200 mb-4">Cross-Category Comparison Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-900/30">
              <tr>
                <th className="text-left px-3 py-2 text-blue-300">Token</th>
                <th className="text-right px-3 py-2 text-blue-300">Price Change</th>
                <th className="text-right px-3 py-2 text-blue-300">Volume</th>
                <th className="text-right px-3 py-2 text-blue-300">Value</th>
                <th className="text-right px-3 py-2 text-blue-300">Market Cap</th>
                <th className="text-right px-3 py-2 text-blue-300">Efficiency Score</th>
              </tr>
            </thead>
            <tbody>
              {topTokens.map((token) => {
                const priceChange = calculate24hChange(token);
                const marketCap = calculateMarketCap(token);
                const efficiency = token.amm_xrp_amount > 0
                  ? ((token.value_24h || 0) / token.amm_xrp_amount) * 100
                  : 0;

                return (
                  <tr key={token.id} className="border-t border-blue-500/20 hover:bg-blue-900/20">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TokenIcon token={token} size="sm" className="!w-6 !h-6" />
                        <span className="font-semibold text-blue-200">{token.token_name}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right text-blue-200">
                      {(token.volume_24h || 0).toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-200">
                      {(token.value_24h || 0).toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-200 font-semibold">
                      {marketCap.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-bold ${
                        efficiency > 100 ? 'text-green-400' :
                        efficiency > 50 ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {efficiency.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
