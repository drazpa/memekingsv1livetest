import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import TokenIcon from '../components/TokenIcon';

export default function Analytics() {
  const [tokens, setTokens] = useState([]);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletHoldings, setWalletHoldings] = useState([]);
  const [walletStats, setWalletStats] = useState({
    totalValue: 0,
    totalTokens: 0,
    topHolding: null,
    diversificationScore: 0,
    portfolioGrowth: 0,
    profitLoss: 0
  });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalSupply: 0,
    totalXRPLocked: 0,
    totalMarketCap: 0,
    avgTokensPerPool: 0,
    successRate: 0,
    avgMarketCap: 0,
    tokensByDay: [],
    tokensByHour: [],
    topTokens: [],
    priceDistribution: [],
    volumeMetrics: {},
    growthRate: 0,
    avgPoolDepth: 0,
    totalLiquidity: 0,
    avgPriceXRP: 0,
    medianMarketCap: 0,
    tokenVelocity: 0,
    concentrationIndex: 0,
    avgAge: 0
  });

  useEffect(() => {
    loadAnalytics();
    loadConnectedWallet();
  }, []);

  useEffect(() => {
    if (connectedWallet) {
      loadWalletAnalytics();
    }
  }, [connectedWallet?.address, tokens.length]);

  const loadConnectedWallet = async () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      const wallet = JSON.parse(stored);

      if (!wallet.seed && wallet.id) {
        try {
          const { data } = await supabase
            .from('wallets')
            .select('*')
            .eq('id', wallet.id)
            .maybeSingle();

          if (data) {
            const updatedWallet = {
              ...data,
              seed: data.encrypted_seed || data.seed
            };
            localStorage.setItem('connectedWallet', JSON.stringify(updatedWallet));
            setConnectedWallet(updatedWallet);
            return;
          }
        } catch (error) {
          console.error('Error refreshing wallet:', error);
        }
      }

      setConnectedWallet(wallet);
    }

    const handleWalletChange = () => {
      const updated = localStorage.getItem('connectedWallet');
      if (updated) {
        setConnectedWallet(JSON.parse(updated));
      } else {
        setConnectedWallet(null);
        setWalletHoldings([]);
      }
    };

    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);

    return () => {
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  };

  const loadWalletAnalytics = async () => {
    if (!connectedWallet || tokens.length === 0) {
      console.log('Skipping wallet analytics:', { connectedWallet: !!connectedWallet, tokensCount: tokens.length });
      return;
    }

    setLoading(true);
    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      console.log('XRPL account_lines response:', response.result.lines.length, 'lines');

      const holdings = [];
      let totalValue = 0;

      for (const line of response.result.lines) {
        const balance = parseFloat(line.balance);
        if (balance <= 0) continue;

        const currencyCode = line.currency.length === 40
          ? Buffer.from(line.currency, 'hex').toString('utf8').replace(/\0/g, '')
          : line.currency;

        const token = tokens.find(
          t => t.issuer_address === line.account && t.currency_code === currencyCode
        );

        if (token) {
          const price = calculatePrice(token);
          const value = balance * price;
          totalValue += value;

          holdings.push({
            token,
            balance,
            price,
            value,
            percentage: 0,
            isPlatformToken: true
          });
        } else {
          holdings.push({
            token: {
              currency_code: currencyCode,
              issuer_address: line.account,
              token_name: currencyCode,
              image_url: null
            },
            balance,
            price: 0,
            value: 0,
            percentage: 0,
            isPlatformToken: false
          });
        }
      }

      console.log('Total holdings found:', holdings.length);

      holdings.forEach(h => {
        h.percentage = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
      });

      holdings.sort((a, b) => b.value - a.value);

      const diversificationScore = holdings.length > 0
        ? (1 - (holdings[0]?.percentage || 0) / 100) * 100
        : 0;

      setWalletHoldings(holdings);
      setWalletStats({
        totalValue: totalValue.toFixed(4),
        totalTokens: holdings.length,
        topHolding: holdings[0] || null,
        diversificationScore: diversificationScore.toFixed(1),
        portfolioGrowth: 0,
        profitLoss: 0
      });

      await client.disconnect();
    } catch (error) {
      console.error('Error loading wallet analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMarketCap = (token) => {
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    const priceInXRP = token.amm_xrp_amount / token.amm_asset_amount;
    return token.supply * priceInXRP;
  };

  const calculatePrice = (token) => {
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return token.amm_xrp_amount / token.amm_asset_amount;
  };

  const loadAnalytics = async () => {
    setLoading(true);
    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .order('created_at', { ascending: false});

      if (error) throw error;

      const tokensData = data || [];

      await client.connect();

      for (const token of tokensData.filter(t => t.amm_pool_created)) {
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
            token.amm_xrp_amount = parseFloat(amm.amount) / 1000000;
            token.amm_asset_amount = parseFloat(amm.amount2.value);
          }
        } catch (error) {
          console.error(`Failed to fetch AMM data for ${token.token_name}:`, error.message);
        }
      }

      await client.disconnect();
      setTokens(tokensData);

      const totalSupply = tokensData.reduce((sum, t) => sum + t.supply, 0);
      const totalXRP = tokensData.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0);
      const totalMC = tokensData.reduce((sum, t) => sum + calculateMarketCap(t), 0);
      const activeTokens = tokensData.filter(t => t.amm_pool_created);
      const avgTokens = activeTokens.length > 0
        ? activeTokens.reduce((sum, t) => sum + t.amm_asset_amount, 0) / activeTokens.length
        : 0;
      const avgMC = tokensData.length > 0 ? totalMC / tokensData.length : 0;

      const tokensByDay = {};
      const tokensByHour = {};
      tokensData.forEach(token => {
        const date = new Date(token.created_at).toLocaleDateString();
        const hour = new Date(token.created_at).getHours();
        tokensByDay[date] = (tokensByDay[date] || 0) + 1;
        tokensByHour[hour] = (tokensByHour[hour] || 0) + 1;
      });

      const topTokens = [...tokensData]
        .filter(t => t.amm_pool_created)
        .sort((a, b) => calculateMarketCap(b) - calculateMarketCap(a))
        .slice(0, 10);

      const priceRanges = {
        'micro': 0,
        'low': 0,
        'medium': 0,
        'high': 0
      };

      tokensData.forEach(token => {
        const price = calculatePrice(token);
        if (price === 0) priceRanges.micro++;
        else if (price < 0.00001) priceRanges.micro++;
        else if (price < 0.0001) priceRanges.low++;
        else if (price < 0.001) priceRanges.medium++;
        else priceRanges.high++;
      });

      const now = Date.now();
      const last24h = tokensData.filter(t => now - new Date(t.created_at).getTime() < 86400000);
      const last7d = tokensData.filter(t => now - new Date(t.created_at).getTime() < 604800000);

      const growthRate = tokensData.length > 1
        ? ((last24h.length / tokensData.length) * 100)
        : 0;

      const avgPoolDepth = activeTokens.length > 0
        ? activeTokens.reduce((sum, t) => sum + (t.amm_xrp_amount || 0), 0) / activeTokens.length
        : 0;

      const totalLiquidity = activeTokens.reduce((sum, t) => {
        return sum + (t.amm_xrp_amount || 0) + (t.amm_asset_amount || 0) * calculatePrice(t);
      }, 0);

      const prices = tokensData.map(t => calculatePrice(t)).filter(p => p > 0);
      const avgPriceXRP = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

      const marketCaps = tokensData.map(t => calculateMarketCap(t)).filter(mc => mc > 0).sort((a, b) => a - b);
      const medianMarketCap = marketCaps.length > 0
        ? marketCaps[Math.floor(marketCaps.length / 2)]
        : 0;

      const avgAge = tokensData.length > 0
        ? tokensData.reduce((sum, t) => sum + (Date.now() - new Date(t.created_at).getTime()), 0) / tokensData.length / (1000 * 60 * 60)
        : 0;

      const tokenVelocity = tokensData.length > 0 ? last24h.length / 24 : 0;

      const top10MC = marketCaps.slice(-10).reduce((a, b) => a + b, 0);
      const concentrationIndex = totalMC > 0 ? (top10MC / totalMC) * 100 : 0;

      setStats({
        totalSupply,
        totalXRPLocked: totalXRP,
        totalMarketCap: totalMC,
        avgTokensPerPool: avgTokens,
        successRate: tokensData.length > 0 ? (activeTokens.length / tokensData.length) * 100 : 0,
        avgMarketCap: avgMC,
        tokensByDay: Object.entries(tokensByDay).map(([date, count]) => ({ date, count })),
        tokensByHour: Object.entries(tokensByHour).map(([hour, count]) => ({ hour: parseInt(hour), count })),
        topTokens,
        priceDistribution: [
          { range: 'Micro (<0.00001)', count: priceRanges.micro },
          { range: 'Low (0.00001-0.0001)', count: priceRanges.low },
          { range: 'Medium (0.0001-0.001)', count: priceRanges.medium },
          { range: 'High (>0.001)', count: priceRanges.high }
        ],
        volumeMetrics: {
          last24h: last24h.length,
          last7d: last7d.length,
          allTime: tokensData.length
        },
        growthRate,
        avgPoolDepth,
        totalLiquidity,
        avgPriceXRP,
        medianMarketCap,
        tokenVelocity,
        concentrationIndex,
        avgAge
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Advanced Analytics</h2>
          <p className="text-purple-400 mt-1">Live XRPL data - Comprehensive metrics and performance</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="btn-secondary px-4 py-2 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
          {connectedWallet && (
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-purple-300 text-sm font-medium">
                {connectedWallet.name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Supply Minted</div>
          <div className="text-3xl font-bold text-purple-200">
            {(stats.totalSupply / 1000000).toFixed(1)}M
          </div>
          <div className="text-purple-500 text-xs mt-2">Across all tokens</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total XRP Locked</div>
          <div className="text-3xl font-bold text-purple-200">{stats.totalXRPLocked.toFixed(2)}</div>
          <div className="text-purple-500 text-xs mt-2">In AMM pools (Live)</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Market Cap</div>
          <div className="text-3xl font-bold text-purple-200">{stats.totalMarketCap.toFixed(2)}</div>
          <div className="text-purple-500 text-xs mt-2">XRP value (Live)</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Avg Market Cap</div>
          <div className="text-3xl font-bold text-purple-200">{stats.avgMarketCap.toFixed(4)}</div>
          <div className="text-purple-500 text-xs mt-2">Per token</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">24h Growth</div>
          <div className="text-3xl font-bold text-purple-200">{stats.growthRate.toFixed(1)}%</div>
          <div className="text-purple-500 text-xs mt-2">Token creation rate</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Avg Pool Size</div>
          <div className="text-3xl font-bold text-purple-200">
            {(stats.avgTokensPerPool / 1000).toFixed(0)}K
          </div>
          <div className="text-purple-500 text-xs mt-2">Tokens per AMM</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Success Rate</div>
          <div className="text-3xl font-bold text-purple-200">{stats.successRate.toFixed(0)}%</div>
          <div className="text-purple-500 text-xs mt-2">AMM creation</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Active Pools</div>
          <div className="text-3xl font-bold text-purple-200">
            {tokens.filter(t => t.amm_pool_created).length}
          </div>
          <div className="text-purple-500 text-xs mt-2">Live trading</div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-2xl font-bold text-purple-200 mb-6">🔬 Advanced Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Avg Pool Depth</div>
            <div className="text-2xl font-bold text-purple-200">{stats.avgPoolDepth.toFixed(4)} XRP</div>
            <div className="text-purple-500 text-xs mt-1">Per active pool (Live)</div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Total Liquidity</div>
            <div className="text-2xl font-bold text-purple-200">{stats.totalLiquidity.toFixed(2)} XRP</div>
            <div className="text-purple-500 text-xs mt-1">Combined value (Live)</div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Avg Price</div>
            <div className="text-2xl font-bold text-purple-200">{stats.avgPriceXRP.toFixed(8)}</div>
            <div className="text-purple-500 text-xs mt-1">XRP per token (Live)</div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Median Market Cap</div>
            <div className="text-2xl font-bold text-purple-200">{stats.medianMarketCap.toFixed(4)}</div>
            <div className="text-purple-500 text-xs mt-1">XRP value</div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Token Velocity</div>
            <div className="text-2xl font-bold text-purple-200">{stats.tokenVelocity.toFixed(2)}/hr</div>
            <div className="text-purple-500 text-xs mt-1">Creation rate</div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Market Concentration</div>
            <div className="text-2xl font-bold text-purple-200">{stats.concentrationIndex.toFixed(1)}%</div>
            <div className="text-purple-500 text-xs mt-1">Top 10 dominance</div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Avg Token Age</div>
            <div className="text-2xl font-bold text-purple-200">{stats.avgAge.toFixed(1)}h</div>
            <div className="text-purple-500 text-xs mt-1">Since creation</div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg">
            <div className="text-purple-400 text-sm mb-2">Market Efficiency</div>
            <div className="text-2xl font-bold text-purple-200">
              {stats.avgPoolDepth > 0 ? ((stats.totalXRPLocked / stats.avgPoolDepth) * 10).toFixed(1) : 0}
            </div>
            <div className="text-purple-500 text-xs mt-1">Liquidity score</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Top 10 by Market Cap (Live XRPL Data)</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {stats.topTokens.map((token, index) => {
              const marketCap = calculateMarketCap(token);
              const price = calculatePrice(token);
              return (
                <div key={token.id} className="flex items-center gap-4 p-4 bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-500">#{index + 1}</div>
                  <TokenIcon token={token} size="sm" />
                  <div className="flex-1">
                    <div className="font-bold text-purple-200">{token.token_name}</div>
                    <div className="text-sm text-purple-400">
                      Price: {price.toFixed(8)} XRP (Live)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-purple-200">{marketCap.toFixed(4)} XRP</div>
                    <div className="text-xs text-purple-400">Market Cap</div>
                  </div>
                </div>
              );
            })}
            {stats.topTokens.length === 0 && (
              <div className="text-center py-8 text-purple-400">
                No tokens with AMM pools yet
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Volume Metrics</h3>
          <div className="space-y-4">
            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-purple-300">Last 24 Hours</span>
                <span className="text-2xl font-bold text-purple-200">{stats.volumeMetrics.last24h}</span>
              </div>
              <div className="text-sm text-purple-400">Tokens created</div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-purple-300">Last 7 Days</span>
                <span className="text-2xl font-bold text-purple-200">{stats.volumeMetrics.last7d}</span>
              </div>
              <div className="text-sm text-purple-400">Tokens created</div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-purple-300">All Time</span>
                <span className="text-2xl font-bold text-purple-200">{stats.volumeMetrics.allTime}</span>
              </div>
              <div className="text-sm text-purple-400">Total tokens</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <h4 className="text-purple-200 font-bold mb-2">Growth Insights</h4>
            <div className="text-purple-300 text-sm">
              {stats.volumeMetrics.last24h > 0
                ? `${stats.volumeMetrics.last24h} token${stats.volumeMetrics.last24h !== 1 ? 's' : ''} created in the last 24 hours`
                : 'No tokens created in the last 24 hours'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Creation Timeline (Last 7 Days)</h3>
          <div className="space-y-3">
            {stats.tokensByDay.slice(0, 7).map((day, index) => {
              const maxCount = Math.max(...stats.tokensByDay.map(d => d.count), 1);
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="text-sm text-purple-400 w-28">{day.date}</div>
                  <div className="flex-1">
                    <div className="bg-purple-900/30 rounded-full h-8 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-purple-500 h-full flex items-center px-3 text-white text-sm font-medium"
                        style={{ width: `${(day.count / maxCount) * 100}%`, minWidth: '60px' }}
                      >
                        {day.count} token{day.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {stats.tokensByDay.length === 0 && (
              <div className="text-center py-8 text-purple-400">
                No data available yet
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Hourly Heatmap</h3>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 24 }, (_, i) => {
              const hourData = stats.tokensByHour.find(h => h.hour === i);
              const count = hourData ? hourData.count : 0;
              const maxCount = Math.max(...stats.tokensByHour.map(h => h.count), 1);
              const intensity = count > 0 ? (count / maxCount) : 0;
              return (
                <div
                  key={i}
                  className="p-2 rounded text-center text-xs"
                  style={{
                    backgroundColor: `rgba(139, 92, 246, ${0.1 + intensity * 0.6})`,
                    border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}
                  title={`${i}:00 - ${count} tokens`}
                >
                  <div className="text-purple-300 font-bold">{i}</div>
                  <div className="text-purple-400">{count}</div>
                </div>
              );
            })}
          </div>
          <div className="text-purple-400 text-xs mt-3 text-center">
            Hour of day (0-23) - Click to see counts
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Price Distribution</h3>
          <div className="space-y-3">
            {stats.priceDistribution.map((range, index) => {
              const total = tokens.length || 1;
              const percentage = (range.count / total) * 100;
              return (
                <div key={index} className="p-3 bg-purple-900/20 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-purple-300 text-sm">{range.range}</span>
                    <span className="text-lg font-bold text-purple-200">{range.count}</span>
                  </div>
                  <div className="bg-purple-900/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-purple-500 h-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-purple-400 mt-1">{percentage.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-lg p-6 lg:col-span-2">
          <h3 className="text-xl font-bold text-purple-200 mb-4">Status Distribution</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-6 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="text-4xl mb-2">✓</div>
              <div className="text-3xl font-bold text-green-400">
                {tokens.filter(t => t.amm_pool_created).length}
              </div>
              <div className="text-green-300 text-sm mt-2">AMM Created</div>
              <div className="text-green-400/60 text-xs mt-1">
                {tokens.length > 0 ? ((tokens.filter(t => t.amm_pool_created).length / tokens.length) * 100).toFixed(1) : 0}%
              </div>
            </div>

            <div className="text-center p-6 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <div className="text-4xl mb-2">⏳</div>
              <div className="text-3xl font-bold text-yellow-400">
                {tokens.filter(t => !t.amm_pool_created && t.status !== 'manual').length}
              </div>
              <div className="text-yellow-300 text-sm mt-2">Pending</div>
              <div className="text-yellow-400/60 text-xs mt-1">Awaiting AMM</div>
            </div>

            <div className="text-center p-6 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-3xl font-bold text-blue-400">
                {tokens.filter(t => t.status === 'manual').length}
              </div>
              <div className="text-blue-300 text-sm mt-2">Manual</div>
              <div className="text-blue-400/60 text-xs mt-1">Added manually</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-xl font-bold text-purple-200 mb-4">Complete Token Analytics Table (Live XRPL Data)</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-900/30">
              <tr>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">#</th>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">Token</th>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">Supply</th>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">Price (XRP)</th>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">Market Cap</th>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">Liquidity</th>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">Ratio</th>
                <th className="text-left px-4 py-3 text-purple-300 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token, index) => {
                const age = Math.floor((Date.now() - new Date(token.created_at)) / (1000 * 60 * 60));
                const price = calculatePrice(token);
                const marketCap = calculateMarketCap(token);
                const ratio = token.amm_pool_created && token.amm_xrp_amount
                  ? (token.amm_asset_amount / token.amm_xrp_amount).toFixed(0)
                  : 'N/A';

                return (
                  <tr key={token.id} className="border-t border-purple-500/20 hover:bg-purple-900/20">
                    <td className="px-4 py-3 text-purple-400 font-bold">#{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TokenIcon token={token} size="sm" className="!w-6 !h-6 !text-xs" />
                        <span className="font-bold text-purple-200">{token.token_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-purple-300">{token.supply.toLocaleString()}</td>
                    <td className="px-4 py-3 text-purple-200 font-mono text-sm">{price.toFixed(8)}</td>
                    <td className="px-4 py-3 text-purple-200 font-bold">{marketCap.toFixed(4)}</td>
                    <td className="px-4 py-3 text-purple-300">
                      {token.amm_pool_created ? `${token.amm_xrp_amount?.toFixed(2) || '0.00'} XRP` : '-'}
                    </td>
                    <td className="px-4 py-3 text-purple-400">{ratio}</td>
                    <td className="px-4 py-3 text-purple-400 text-sm">{age}h ago</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <h3 className="text-2xl font-bold text-purple-200 mb-6">AMM Pool Comparisons (Live XRPL Data)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-lg p-4">
            <div className="text-purple-400 text-sm mb-1">Active AMM Pools</div>
            <div className="text-2xl font-bold text-purple-200">
              {tokens.filter(t => t.amm_pool_created).length}
            </div>
          </div>
          <div className="glass rounded-lg p-4">
            <div className="text-purple-400 text-sm mb-1">Total Liquidity</div>
            <div className="text-2xl font-bold text-purple-200">
              {stats.totalLiquidity.toFixed(2)} XRP
            </div>
          </div>
          <div className="glass rounded-lg p-4">
            <div className="text-purple-400 text-sm mb-1">Avg Pool Depth</div>
            <div className="text-2xl font-bold text-purple-200">
              {stats.avgPoolDepth.toFixed(2)} XRP
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-900/30">
              <tr>
                <th className="text-left px-4 py-3 text-purple-300">Token</th>
                <th className="text-right px-4 py-3 text-purple-300">XRP Locked</th>
                <th className="text-right px-4 py-3 text-purple-300">Token Amount</th>
                <th className="text-right px-4 py-3 text-purple-300">Price Impact</th>
                <th className="text-right px-4 py-3 text-purple-300">Pool Share</th>
              </tr>
            </thead>
            <tbody>
              {tokens.filter(t => t.amm_pool_created).map((token, index) => {
                const poolShare = stats.totalXRPLocked > 0 ? (token.amm_xrp_amount / stats.totalXRPLocked * 100).toFixed(2) : 0;
                const priceImpact = token.amm_xrp_amount > 0 ? ((1 / token.amm_xrp_amount) * 100).toFixed(4) : 0;

                return (
                  <tr key={token.id} className="border-t border-purple-500/20 hover:bg-purple-900/20">
                    <td className="px-4 py-3 text-purple-200 font-bold">{token.token_name}</td>
                    <td className="px-4 py-3 text-right text-purple-200">{token.amm_xrp_amount?.toFixed(2) || '0.00'} XRP</td>
                    <td className="px-4 py-3 text-right text-purple-300">{token.amm_asset_amount?.toLocaleString() || '0'}</td>
                    <td className="px-4 py-3 text-right text-purple-400">{priceImpact}% per XRP</td>
                    <td className="px-4 py-3 text-right text-purple-200 font-bold">{poolShare}%</td>
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
