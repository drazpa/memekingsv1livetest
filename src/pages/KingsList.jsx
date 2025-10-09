import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import { XRPScanLink } from '../components/XRPScanLink';
import TokenIcon from '../components/TokenIcon';

const XRPL_CLIENT_URL = 'wss://s.altnet.rippletest.net:51233';

export default function KingsList() {
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [richList, setRichList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [stats, setStats] = useState({
    totalHolders: 0,
    totalSupplyHeld: 0,
    topHolderPercentage: 0,
    avgHolding: 0,
    medianHolding: 0,
    giniCoefficient: 0,
    concentrationRatio: 0
  });
  const [network] = useState('testnet');

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    if (selectedToken) {
      loadRichList();
    }
  }, [selectedToken]);

  const loadTokens = async () => {
    setLoadingTokens(true);
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setTokens(data || []);
      console.log('Loaded tokens:', data?.length || 0, data);
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setLoadingTokens(false);
    }
  };

  const loadRichList = async () => {
    if (!selectedToken) return;

    setLoading(true);
    try {
      const client = new xrpl.Client(XRPL_CLIENT_URL);
      await client.connect();

      const accountLines = await client.request({
        command: 'account_lines',
        account: selectedToken.issuer_address,
        ledger_index: 'validated'
      });

      const holders = accountLines.result.lines
        .filter(line => line.currency === selectedToken.currency_code)
        .map(line => ({
          address: line.account,
          balance: parseFloat(line.balance) || 0,
          limit: parseFloat(line.limit) || 0
        }))
        .filter(holder => holder.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      setRichList(holders);
      calculateStats(holders);

      await client.disconnect();
    } catch (error) {
      console.error('Error loading rich list:', error);
      setRichList([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (holders) => {
    if (holders.length === 0) {
      setStats({
        totalHolders: 0,
        totalSupplyHeld: 0,
        topHolderPercentage: 0,
        avgHolding: 0,
        medianHolding: 0,
        giniCoefficient: 0,
        concentrationRatio: 0
      });
      return;
    }

    const totalSupplyHeld = holders.reduce((sum, h) => sum + h.balance, 0);
    const avgHolding = totalSupplyHeld / holders.length;

    const sortedBalances = holders.map(h => h.balance).sort((a, b) => a - b);
    const medianHolding = sortedBalances.length % 2 === 0
      ? (sortedBalances[sortedBalances.length / 2 - 1] + sortedBalances[sortedBalances.length / 2]) / 2
      : sortedBalances[Math.floor(sortedBalances.length / 2)];

    const topHolderPercentage = holders.length > 0
      ? (holders[0].balance / totalSupplyHeld) * 100
      : 0;

    const top10Supply = holders.slice(0, Math.min(10, holders.length))
      .reduce((sum, h) => sum + h.balance, 0);
    const concentrationRatio = (top10Supply / totalSupplyHeld) * 100;

    const giniCoefficient = calculateGiniCoefficient(sortedBalances);

    setStats({
      totalHolders: holders.length,
      totalSupplyHeld,
      topHolderPercentage,
      avgHolding,
      medianHolding,
      giniCoefficient,
      concentrationRatio
    });
  };

  const calculateGiniCoefficient = (sortedBalances) => {
    if (sortedBalances.length === 0) return 0;

    const n = sortedBalances.length;
    let numerator = 0;
    let denominator = 0;

    sortedBalances.forEach((balance, i) => {
      numerator += (i + 1) * balance;
      denominator += balance;
    });

    if (denominator === 0) return 0;

    return ((2 * numerator) / (n * denominator)) - ((n + 1) / n);
  };

  const getConcentrationLevel = (ratio) => {
    if (ratio >= 90) return { label: 'Very High', color: 'text-red-400' };
    if (ratio >= 70) return { label: 'High', color: 'text-orange-400' };
    if (ratio >= 50) return { label: 'Moderate', color: 'text-yellow-400' };
    if (ratio >= 30) return { label: 'Low', color: 'text-green-400' };
    return { label: 'Very Low', color: 'text-blue-400' };
  };

  const getGiniLevel = (gini) => {
    if (gini >= 0.6) return { label: 'Very Unequal', color: 'text-red-400' };
    if (gini >= 0.5) return { label: 'Unequal', color: 'text-orange-400' };
    if (gini >= 0.4) return { label: 'Moderate', color: 'text-yellow-400' };
    if (gini >= 0.3) return { label: 'Equal', color: 'text-green-400' };
    return { label: 'Very Equal', color: 'text-blue-400' };
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const concentration = getConcentrationLevel(stats.concentrationRatio);
  const giniLevel = getGiniLevel(stats.giniCoefficient);

  return (
    <div className="min-h-screen p-4 md:p-6" style={{
      background: 'linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 100%)'
    }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 bg-clip-text text-transparent mb-2">
            👑 Kings List
          </h1>
          <p className="text-purple-300/80">
            Rich list rankings and distribution analytics for XRPL tokens
          </p>
        </div>

        <div className="mb-6 rounded-xl overflow-hidden border border-yellow-500/30"
          style={{
            background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.95), rgba(59, 7, 100, 0.95))',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-purple-200">
                Select Token
              </label>
              {tokens.length > 0 && (
                <span className="text-xs text-purple-400">
                  {tokens.length} tokens available
                </span>
              )}
            </div>
            {loadingTokens ? (
              <div className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-4 py-3 text-purple-400">
                Loading tokens...
              </div>
            ) : (
              <select
                value={selectedToken?.id || ''}
                onChange={(e) => {
                  const token = tokens.find(t => t.id === e.target.value);
                  console.log('Selected token:', token);
                  setSelectedToken(token);
                }}
                className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
                disabled={tokens.length === 0}
              >
                <option value="" className="bg-purple-950 text-purple-400">
                  {tokens.length === 0 ? 'No tokens available' : 'Choose a token...'}
                </option>
                {tokens.map(token => (
                  <option key={token.id} value={token.id} className="bg-purple-950 text-white">
                    {token.name} ({token.currency_code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {selectedToken && (
          <div className="mb-6 rounded-xl overflow-hidden border border-yellow-500/30"
            style={{
              background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.95), rgba(59, 7, 100, 0.95))',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="p-6 border-b border-purple-500/30">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-4 flex-1">
                  <TokenIcon
                    name={selectedToken.name}
                    imageUrl={selectedToken.image_url}
                    size="lg"
                  />
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedToken.name}</h2>
                    <p className="text-purple-300/80">{selectedToken.currency_code}</p>
                  </div>
                </div>
                {richList.length > 0 && (
                  <div className="relative rounded-xl overflow-hidden border-2 border-yellow-500/60"
                    style={{
                      background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.3), rgba(251, 191, 36, 0.3))',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 0 30px rgba(251, 191, 36, 0.4)'
                    }}
                  >
                    <div className="absolute top-2 right-2 text-3xl">
                      👑
                    </div>
                    <div className="p-6 pr-14">
                      <div className="text-yellow-400/80 text-xs font-medium mb-1">MemeKing</div>
                      <div className="text-yellow-200 font-bold text-lg mb-2">#{1} Holder</div>
                      <div className="font-mono text-yellow-300 text-sm mb-2">
                        {richList[0].address.slice(0, 8)}...{richList[0].address.slice(-6)}
                      </div>
                      <div className="text-2xl font-bold text-yellow-100 mb-1">
                        {formatNumber(richList[0].balance)}
                      </div>
                      <div className="text-xs text-yellow-400/80 mb-3">
                        {selectedToken.currency_code}
                      </div>
                      <div className="text-yellow-300 font-bold text-sm mb-3">
                        {((richList[0].balance / stats.totalSupplyHeld) * 100).toFixed(2)}% of supply
                      </div>
                      <a
                        href={`https://${network === 'mainnet' ? '' : 'test.'}xrpscan.com/account/${richList[0].address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-3 py-1.5 bg-yellow-600/40 hover:bg-yellow-600/60 text-yellow-100 rounded text-xs font-medium transition-all duration-200 border border-yellow-500/50"
                      >
                        View Wallet
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/20">
                <div className="text-purple-400/80 text-sm mb-1">Total Holders</div>
                <div className="text-2xl font-bold text-white">{stats.totalHolders}</div>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/20">
                <div className="text-purple-400/80 text-sm mb-1">Total Supply Held</div>
                <div className="text-2xl font-bold text-white">{formatNumber(stats.totalSupplyHeld)}</div>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/20">
                <div className="text-purple-400/80 text-sm mb-1">Average Holding</div>
                <div className="text-2xl font-bold text-white">{formatNumber(stats.avgHolding)}</div>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/20">
                <div className="text-purple-400/80 text-sm mb-1">Median Holding</div>
                <div className="text-2xl font-bold text-white">{formatNumber(stats.medianHolding)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 pt-0">
              <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-lg p-4 border border-yellow-500/30">
                <div className="text-yellow-400/80 text-sm mb-1">Top Holder Share</div>
                <div className="text-3xl font-bold text-yellow-300">
                  {stats.topHolderPercentage.toFixed(2)}%
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/30">
                <div className="text-purple-400/80 text-sm mb-1">Top 10 Concentration</div>
                <div className="text-2xl font-bold text-white mb-1">
                  {stats.concentrationRatio.toFixed(2)}%
                </div>
                <div className={`text-sm font-medium ${concentration.color}`}>
                  {concentration.label}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-4 border border-purple-500/30">
                <div className="text-purple-400/80 text-sm mb-1">Gini Coefficient</div>
                <div className="text-2xl font-bold text-white mb-1">
                  {stats.giniCoefficient.toFixed(3)}
                </div>
                <div className={`text-sm font-medium ${giniLevel.color}`}>
                  {giniLevel.label}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl overflow-hidden border border-yellow-500/30"
          style={{
            background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.95), rgba(59, 7, 100, 0.95))',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="p-6 border-b border-purple-500/30">
            <h3 className="text-xl font-bold text-white">
              {richList.length > 0 ? 'All Holders' : 'Rich List Rankings'}
            </h3>
            {richList.length > 0 && (
              <p className="text-purple-300/60 text-sm mt-1">
                Showing all {richList.length} token holders
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-purple-300">Loading rich list...</p>
              </div>
            </div>
          ) : richList.length === 0 ? (
            <div className="text-center py-20 text-purple-300/60">
              {selectedToken ? 'No holders found for this token' : 'Please select a token to view the rich list'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-500/30 bg-purple-900/40">
                    <th className="text-left p-4 text-purple-200 font-medium">Rank</th>
                    <th className="text-left p-4 text-purple-200 font-medium">Wallet Address</th>
                    <th className="text-right p-4 text-purple-200 font-medium">Balance</th>
                    <th className="text-right p-4 text-purple-200 font-medium">% of Supply</th>
                    <th className="text-center p-4 text-purple-200 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {richList.map((holder, index) => {
                    const percentage = (holder.balance / stats.totalSupplyHeld) * 100;
                    const isTopHolder = index === 0;
                    const isTopTen = index < 10 && index > 0;

                    return (
                      <tr
                        key={holder.address}
                        className={`border-b border-purple-500/10 hover:bg-purple-900/20 transition-colors ${
                          isTopHolder ? 'bg-yellow-900/20' : isTopTen ? 'bg-purple-900/10' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {isTopHolder && <span className="text-2xl">👑</span>}
                            {!isTopHolder && isTopTen && <span className="text-xl">🥇</span>}
                            <span className={`font-bold ${isTopHolder ? 'text-yellow-400 text-lg' : 'text-white'}`}>
                              #{index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-purple-200">
                            {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="font-bold text-white">
                            {formatNumber(holder.balance)}
                          </div>
                          <div className="text-xs text-purple-400/60">
                            {selectedToken.currency_code}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className={`font-medium ${
                            percentage >= 10 ? 'text-yellow-400' :
                            percentage >= 5 ? 'text-orange-400' :
                            percentage >= 1 ? 'text-purple-300' :
                            'text-purple-400/80'
                          }`}>
                            {percentage.toFixed(2)}%
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={`https://${network === 'mainnet' ? '' : 'test.'}xrpscan.com/account/${holder.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 rounded text-xs font-medium transition-all duration-200 border border-blue-500/30"
                            >
                              View Wallet
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-purple-900/30 border border-purple-500/20">
          <h4 className="text-sm font-medium text-purple-200 mb-2">Distribution Metrics Explained</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-purple-300/80">
            <div>
              <strong className="text-purple-200">Gini Coefficient:</strong> Measures wealth inequality. 0 = perfect equality, 1 = perfect inequality. Lower is better for distribution.
            </div>
            <div>
              <strong className="text-purple-200">Top 10 Concentration:</strong> Percentage of total supply held by top 10 holders. Lower percentages indicate better distribution.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
