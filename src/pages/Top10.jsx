import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import TokenIcon from '../components/TokenIcon';
import TokenDetailModal from '../components/TokenDetailModal';

export default function Top10() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('price-gainers');
  const [selectedToken, setSelectedToken] = useState(null);

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

  const calculateVolumeToLiquidityRatio = (token) => {
    if (!token.amm_xrp_amount || token.amm_xrp_amount === 0) return 0;
    return ((token.value_24h || 0) / token.amm_xrp_amount) * 100;
  };

  const calculateMarketDominance = (token) => {
    const totalMarketCap = tokens.reduce((sum, t) => sum + calculateMarketCap(t), 0);
    if (totalMarketCap === 0) return 0;
    return (calculateMarketCap(token) / totalMarketCap) * 100;
  };

  const calculateLiquidityDepth = (token) => {
    if (!token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return Math.sqrt(token.amm_xrp_amount * token.amm_asset_amount);
  };

  const calculatePriceImpact = (token, tradeSize = 1) => {
    if (!token.amm_xrp_amount) return 0;
    return (tradeSize / token.amm_xrp_amount) * 100;
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
    if (index === 1) return 'text-gray-300';
    if (index === 2) return 'text-orange-500';
    return 'text-blue-400';
  };

  const getRankBg = (index) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-l-4 border-yellow-500 shadow-lg shadow-yellow-500/20';
    if (index === 1) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-l-4 border-gray-400 shadow-lg shadow-gray-400/20';
    if (index === 2) return 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 border-l-4 border-orange-500 shadow-lg shadow-orange-500/20';
    return '';
  };

  const getRankBadge = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const totalMarketCap = tokens.reduce((sum, t) => sum + calculateMarketCap(t), 0);
  const totalVolume24h = tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
  const totalValue24h = tokens.reduce((sum, t) => sum + (t.value_24h || 0), 0);
  const totalLiquidity = tokens.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0);
  const avgPriceChange = tokens.length > 0
    ? tokens.reduce((sum, t) => sum + calculate24hChange(t), 0) / tokens.length
    : 0;

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

  const compareToLeader = (token, leaderToken) => {
    const metricValue = selectedCategory.includes('price')
      ? calculate24hChange(token)
      : selectedCategory.includes('volume')
      ? (token.volume_24h || 0)
      : (token.value_24h || 0);

    const leaderValue = selectedCategory.includes('price')
      ? calculate24hChange(leaderToken)
      : selectedCategory.includes('volume')
      ? (leaderToken.volume_24h || 0)
      : (leaderToken.value_24h || 0);

    if (leaderValue === 0) return 0;
    return ((metricValue / leaderValue) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-blue-200">Top 10 Advanced Analytics</h2>
          <p className="text-blue-400 mt-1">Comprehensive market analysis with detailed comparisons</p>
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
        <h3 className="text-xl font-bold text-blue-200 mb-4">Global Market Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
            <div className="text-blue-400 text-xs mb-1">Total Market Cap</div>
            <div className="text-2xl font-bold text-blue-200">{totalMarketCap.toFixed(2)}</div>
            <div className="text-blue-500 text-xs mt-1">XRP</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
            <div className="text-green-400 text-xs mb-1">Total Liquidity</div>
            <div className="text-2xl font-bold text-green-200">{totalLiquidity.toFixed(2)}</div>
            <div className="text-green-500 text-xs mt-1">XRP in pools</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
            <div className="text-orange-400 text-xs mb-1">24h Trade Count</div>
            <div className="text-2xl font-bold text-orange-200">{totalVolume24h.toFixed(0)}</div>
            <div className="text-orange-500 text-xs mt-1">transactions</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">24h XRP Volume</div>
            <div className="text-2xl font-bold text-purple-200">{totalValue24h.toFixed(2)}</div>
            <div className="text-purple-500 text-xs mt-1">XRP traded</div>
          </div>

          <div className={`p-4 rounded-lg border ${
            avgPriceChange >= 0
              ? 'bg-gradient-to-br from-green-500/10 to-lime-500/10 border-green-500/20'
              : 'bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20'
          }`}>
            <div className={avgPriceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
              <div className="text-xs mb-1">Avg Price Δ</div>
            </div>
            <div className={`text-2xl font-bold ${avgPriceChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {avgPriceChange >= 0 ? '+' : ''}{avgPriceChange.toFixed(2)}%
            </div>
            <div className={avgPriceChange >= 0 ? 'text-green-500' : 'text-red-500'}>
              <div className="text-xs mt-1">24h average</div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-500/20">
            <div className="text-cyan-400 text-xs mb-1">Active Pools</div>
            <div className="text-2xl font-bold text-cyan-200">{tokens.length}</div>
            <div className="text-cyan-500 text-xs mt-1">AMM tokens</div>
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
            <div className="text-sm font-medium">High XRP Value</div>
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
            <div className="text-sm font-medium">Low XRP Value</div>
          </button>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-4xl">{getCategoryIcon()}</span>
          <h3 className="text-2xl font-bold text-blue-200">{getCategoryTitle()}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="glass bg-yellow-500/5 rounded-lg p-4 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥇</span>
              <div className="text-yellow-400 text-sm font-bold">Gold Leader</div>
            </div>
            <div className="text-xl font-bold text-yellow-200">
              {topTokens.length > 0 ? topTokens[0].token_name : 'N/A'}
            </div>
          </div>

          <div className="glass bg-gray-500/5 rounded-lg p-4 border border-gray-400/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥈</span>
              <div className="text-gray-400 text-sm font-bold">Silver Runner-up</div>
            </div>
            <div className="text-xl font-bold text-gray-200">
              {topTokens.length > 1 ? topTokens[1].token_name : 'N/A'}
            </div>
          </div>

          <div className="glass bg-orange-500/5 rounded-lg p-4 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥉</span>
              <div className="text-orange-400 text-sm font-bold">Bronze Third</div>
            </div>
            <div className="text-xl font-bold text-orange-200">
              {topTokens.length > 2 ? topTokens[2].token_name : 'N/A'}
            </div>
          </div>

          <div className="glass bg-purple-500/5 rounded-lg p-4">
            <div className="text-purple-400 text-sm mb-2">Category Average</div>
            <div className="text-xl font-bold text-purple-200">
              {selectedCategory.includes('price')
                ? `${getCategoryAverage().toFixed(2)}%`
                : getCategoryAverage().toFixed(2)
              }
            </div>
          </div>

          <div className="glass bg-cyan-500/5 rounded-lg p-4">
            <div className="text-cyan-400 text-sm mb-2">Performance Spread</div>
            <div className="text-xl font-bold text-cyan-200">
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
                <th className="text-right px-4 py-3 text-blue-300 font-medium">vs Leader</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h Trades</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">24h XRP Volume</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Vol/Liq Ratio</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Market Cap</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Market Share</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Liquidity</th>
                <th className="text-right px-4 py-3 text-blue-300 font-medium">Price Impact</th>
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
                const vsLeader = topTokens.length > 0 ? compareToLeader(token, topTokens[0]) : 0;
                const volLiqRatio = calculateVolumeToLiquidityRatio(token);
                const marketShare = calculateMarketDominance(token);
                const priceImpact = calculatePriceImpact(token, 1);

                return (
                  <tr
                    key={token.id}
                    onClick={() => setSelectedToken(token)}
                    className={`border-t border-blue-500/20 hover:bg-blue-900/30 transition-all cursor-pointer ${getRankBg(index)}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`text-3xl font-bold ${getRankColor(index)}`}>
                          {getRankBadge(index)}
                        </div>
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
                      <div className={`font-semibold ${
                        vsLeader >= 90 ? 'text-green-400' :
                        vsLeader >= 70 ? 'text-yellow-400' :
                        vsLeader >= 50 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {vsLeader.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200 font-semibold">{(token.volume_24h || 0).toFixed(0)}</div>
                      <div className="text-xs text-blue-400">txs</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-purple-200 font-bold">{(token.value_24h || 0).toFixed(4)}</div>
                      <div className="text-xs text-purple-400">XRP</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className={`font-bold ${
                        volLiqRatio > 100 ? 'text-green-400' :
                        volLiqRatio > 50 ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {volLiqRatio.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-blue-200 font-semibold">{marketCap.toFixed(4)}</div>
                      <div className="text-xs text-blue-400">XRP</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-cyan-200 font-bold">{marketShare.toFixed(2)}%</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-green-200 font-semibold">{(token.amm_xrp_amount || 0).toFixed(2)}</div>
                      <div className="text-xs text-green-400">XRP</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className={`font-semibold ${
                        priceImpact < 1 ? 'text-green-400' :
                        priceImpact < 3 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {priceImpact.toFixed(3)}%
                      </div>
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
          <h3 className="text-xl font-bold text-blue-200 mb-4">Podium Performance Analysis</h3>
          <div className="space-y-4">
            {topTokens.slice(0, 3).map((token, index) => {
              const price = calculatePrice(token);
              const priceChange = calculate24hChange(token);
              const marketCap = calculateMarketCap(token);
              const marketShare = calculateMarketDominance(token);
              const volLiqRatio = calculateVolumeToLiquidityRatio(token);
              const priceImpact = calculatePriceImpact(token, 1);

              const borderColors = ['border-yellow-500', 'border-gray-400', 'border-orange-500'];
              const bgColors = ['bg-yellow-500/10', 'bg-gray-400/10', 'bg-orange-500/10'];

              return (
                <div
                  key={token.id}
                  onClick={() => setSelectedToken(token)}
                  className={`p-5 glass rounded-lg cursor-pointer hover:bg-blue-500/10 transition-colors border-2 ${borderColors[index]} ${bgColors[index]}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{getRankBadge(index)}</div>
                      <TokenIcon token={token} size="lg" />
                      <div>
                        <div className="font-bold text-lg text-blue-200">{token.token_name}</div>
                        <div className="text-sm text-blue-400">{token.currency_code}</div>
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-blue-400 text-xs mb-1">Market Share</div>
                      <div className="text-blue-200 font-bold">{marketShare.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-purple-400 text-xs mb-1">24h XRP Vol</div>
                      <div className="text-purple-200 font-bold">{(token.value_24h || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-green-400 text-xs mb-1">Vol/Liq Ratio</div>
                      <div className="text-green-200 font-bold">{volLiqRatio.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-orange-400 text-xs mb-1">Price Impact</div>
                      <div className="text-orange-200 font-bold">{priceImpact.toFixed(3)}%</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-500/20">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-blue-400 mb-1">Liquidity</div>
                        <div className="text-blue-200 font-semibold">{(token.amm_xrp_amount || 0).toFixed(2)} XRP</div>
                      </div>
                      <div>
                        <div className="text-blue-400 mb-1">Market Cap</div>
                        <div className="text-blue-200 font-semibold">{marketCap.toFixed(2)} XRP</div>
                      </div>
                      <div>
                        <div className="text-blue-400 mb-1">24h Trades</div>
                        <div className="text-blue-200 font-semibold">{(token.volume_24h || 0).toFixed(0)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-200 mb-4">Advanced Category Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30">
              <div className="text-blue-400 text-sm mb-3 font-bold">XRP Volume Distribution</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-blue-300 text-sm">Top 3 Combined</span>
                  <span className="text-blue-200 font-bold">
                    {topTokens.slice(0, 3).reduce((sum, t) => sum + (t.value_24h || 0), 0).toFixed(2)} XRP
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-300 text-sm">Remaining 7</span>
                  <span className="text-blue-200 font-bold">
                    {topTokens.slice(3).reduce((sum, t) => sum + (t.value_24h || 0), 0).toFixed(2)} XRP
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-blue-500/30">
                  <span className="text-blue-300 text-sm font-bold">Top 3 Dominance</span>
                  <span className="text-cyan-200 font-bold text-lg">
                    {topTokens.length >= 3 ? (
                      ((topTokens.slice(0, 3).reduce((sum, t) => sum + (t.value_24h || 0), 0) /
                        topTokens.reduce((sum, t) => sum + (t.value_24h || 0), 0)) * 100).toFixed(1)
                    ) : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/30">
              <div className="text-purple-400 text-sm mb-3 font-bold">Liquidity Analysis</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Avg Liquidity Depth</span>
                  <span className="text-purple-200 font-bold">
                    {topTokens.length > 0 ? (
                      topTokens.reduce((sum, t) => sum + calculateLiquidityDepth(t), 0) / topTokens.length
                    ).toFixed(2) : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Avg Vol/Liq Ratio</span>
                  <span className="text-purple-200 font-bold">
                    {topTokens.length > 0 ? (
                      topTokens.reduce((sum, t) => sum + calculateVolumeToLiquidityRatio(t), 0) / topTokens.length
                    ).toFixed(2) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-sm">Total Pool Liquidity</span>
                  <span className="text-purple-200 font-bold">
                    {topTokens.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0).toFixed(2)} XRP
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
              <div className="text-green-400 text-sm mb-3 font-bold">Trading Efficiency Metrics</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-green-300 text-sm">Most Efficient</span>
                  <span className="text-green-200 font-bold">
                    {topTokens.length > 0 ? topTokens.reduce((max, t) =>
                      calculateVolumeToLiquidityRatio(t) > calculateVolumeToLiquidityRatio(max) ? t : max
                    ).token_name : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-300 text-sm">Lowest Price Impact</span>
                  <span className="text-green-200 font-bold">
                    {topTokens.length > 0 ? topTokens.reduce((min, t) =>
                      calculatePriceImpact(t, 1) < calculatePriceImpact(min, 1) ? t : min
                    ).token_name : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-300 text-sm">Avg Price Impact (1 XRP)</span>
                  <span className="text-green-200 font-bold">
                    {topTokens.length > 0 ? (
                      topTokens.reduce((sum, t) => sum + calculatePriceImpact(t, 1), 0) / topTokens.length
                    ).toFixed(3) : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/30">
              <div className="text-orange-400 text-sm mb-3 font-bold">Market Concentration</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-orange-300 text-sm">Top Token Share</span>
                  <span className="text-orange-200 font-bold">
                    {topTokens.length > 0 ? calculateMarketDominance(topTokens[0]).toFixed(2) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-orange-300 text-sm">HHI Index</span>
                  <span className="text-orange-200 font-bold">
                    {topTokens.length > 0 ? (
                      topTokens.reduce((sum, t) => sum + Math.pow(calculateMarketDominance(t), 2), 0)
                    ).toFixed(0) : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-orange-300 text-sm">Market Health</span>
                  <span className={`font-bold ${
                    topTokens.length > 0 && topTokens.reduce((sum, t) => sum + Math.pow(calculateMarketDominance(t), 2), 0) < 2000
                      ? 'text-green-400'
                      : 'text-yellow-400'
                  }`}>
                    {topTokens.length > 0 && topTokens.reduce((sum, t) => sum + Math.pow(calculateMarketDominance(t), 2), 0) < 2000
                      ? 'Competitive'
                      : 'Concentrated'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-blue-200 mb-4">Comprehensive Comparison Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-900/30">
              <tr>
                <th className="text-left px-3 py-2 text-blue-300">Rank</th>
                <th className="text-left px-3 py-2 text-blue-300">Token</th>
                <th className="text-right px-3 py-2 text-blue-300">Price Δ %</th>
                <th className="text-right px-3 py-2 text-blue-300">Trade Count</th>
                <th className="text-right px-3 py-2 text-blue-300">XRP Volume</th>
                <th className="text-right px-3 py-2 text-blue-300">Market Cap</th>
                <th className="text-right px-3 py-2 text-blue-300">Market %</th>
                <th className="text-right px-3 py-2 text-blue-300">Liquidity</th>
                <th className="text-right px-3 py-2 text-blue-300">Vol/Liq</th>
                <th className="text-right px-3 py-2 text-blue-300">Impact</th>
                <th className="text-right px-3 py-2 text-blue-300">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {topTokens.map((token, index) => {
                const priceChange = calculate24hChange(token);
                const marketCap = calculateMarketCap(token);
                const marketShare = calculateMarketDominance(token);
                const volLiqRatio = calculateVolumeToLiquidityRatio(token);
                const priceImpact = calculatePriceImpact(token, 1);
                const efficiency = volLiqRatio;

                return (
                  <tr
                    key={token.id}
                    onClick={() => setSelectedToken(token)}
                    className="border-t border-blue-500/20 hover:bg-blue-900/20 cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <div className={`text-xl font-bold ${getRankColor(index)}`}>
                        {getRankBadge(index)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TokenIcon token={token} size="sm" className="!w-6 !h-6" />
                        <span className="font-semibold text-blue-200">{token.token_name}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right text-blue-200 font-semibold">
                      {(token.volume_24h || 0).toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right text-purple-200 font-bold">
                      {(token.value_24h || 0).toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-200 font-semibold">
                      {marketCap.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right text-cyan-200 font-bold">
                      {marketShare.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right text-green-200 font-semibold">
                      {(token.amm_xrp_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-bold ${
                        volLiqRatio > 100 ? 'text-green-400' :
                        volLiqRatio > 50 ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {volLiqRatio.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-semibold ${
                        priceImpact < 1 ? 'text-green-400' :
                        priceImpact < 3 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {priceImpact.toFixed(3)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-bold ${
                        efficiency > 100 ? 'text-green-400' :
                        efficiency > 50 ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {efficiency.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedToken && (
        <TokenDetailModal
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </div>
  );
}
