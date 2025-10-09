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
    concentrationRatio: 0,
    totalTrustlines: 0,
    developerBalance: 0,
    totalSupplyIssued: 0
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
        .from('meme_tokens')
        .select('id, token_name, currency_code, issuer_address, image_url, supply, initial_supply, status')
        .order('token_name', { ascending: true });

      if (error) throw error;

      const formattedTokens = (data || []).map(token => ({
        id: token.id,
        name: token.token_name,
        currency_code: token.currency_code,
        issuer_address: token.issuer_address,
        image_url: token.image_url,
        supply: token.supply,
        initial_supply: parseFloat(token.initial_supply) || parseFloat(token.supply) || 0,
        status: token.status
      }));

      setTokens(formattedTokens);
      console.log('Loaded tokens:', formattedTokens.length, formattedTokens);
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

      const allLines = accountLines.result.lines.filter(line => line.currency === selectedToken.currency_code);
      const totalTrustlines = allLines.length;

      const holders = allLines
        .map(line => ({
          address: line.account,
          balance: Math.abs(parseFloat(line.balance)) || 0,
          limit: parseFloat(line.limit) || 0
        }))
        .filter(holder => holder.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      const totalHeld = holders.reduce((sum, h) => sum + h.balance, 0);
      const totalSupplyIssued = selectedToken.initial_supply || totalHeld;
      const developerBalance = Math.max(0, totalSupplyIssued - totalHeld);

      console.log('Token:', selectedToken.name);
      console.log('Total Supply:', totalSupplyIssued);
      console.log('Total Held by users:', totalHeld);
      console.log('Developer Balance:', developerBalance);

      setRichList(holders);
      calculateStats(holders, totalTrustlines, developerBalance, totalSupplyIssued);

      await client.disconnect();
    } catch (error) {
      console.error('Error loading rich list:', error);
      setRichList([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (holders, totalTrustlines, developerBalance, totalSupplyIssued) => {
    if (holders.length === 0) {
      setStats({
        totalHolders: 0,
        totalSupplyHeld: 0,
        topHolderPercentage: 0,
        avgHolding: 0,
        medianHolding: 0,
        giniCoefficient: 0,
        concentrationRatio: 0,
        totalTrustlines: totalTrustlines || 0,
        developerBalance: developerBalance || 0,
        totalSupplyIssued: totalSupplyIssued || 0
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
      concentrationRatio,
      totalTrustlines: totalTrustlines || 0,
      developerBalance: developerBalance || 0,
      totalSupplyIssued: totalSupplyIssued || totalSupplyHeld
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
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center gap-3 mb-3">
            <span className="text-5xl">👑</span>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">
              Kings List
            </h1>
            <span className="text-5xl">👑</span>
          </div>
          <p className="text-purple-300 text-lg">
            Rich list rankings and distribution analytics for XRPL tokens
          </p>
        </div>

        <div className="glass rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl">
          <div className="p-6 bg-gradient-to-r from-purple-900/30 to-purple-800/30">
            <div className="flex items-center justify-between mb-3">
              <label className="text-lg font-semibold text-purple-200">
                Select Token
              </label>
              {tokens.length > 0 && (
                <span className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm font-medium border border-purple-500/30">
                  {tokens.length} {tokens.length === 1 ? 'token' : 'tokens'} available
                </span>
              )}
            </div>
            {loadingTokens ? (
              <div className="flex items-center justify-center py-4 px-4 bg-purple-900/50 border border-purple-600/40 rounded-xl">
                <div className="w-5 h-5 border-3 border-purple-400 border-t-transparent rounded-full animate-spin mr-3"></div>
                <span className="text-purple-300">Loading tokens...</span>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedToken?.id || ''}
                  onChange={(e) => {
                    const token = tokens.find(t => t.id === e.target.value);
                    console.log('Selected token:', token);
                    setSelectedToken(token);
                  }}
                  className="w-full bg-purple-900/70 border-2 border-purple-600/50 rounded-xl px-5 py-4 text-white text-lg focus:outline-none focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/20 cursor-pointer transition-all hover:border-purple-500/60"
                  disabled={tokens.length === 0}
                >
                  <option value="" className="bg-purple-900 text-purple-400">
                    {tokens.length === 0 ? 'No tokens available' : '🔍 Choose a token...'}
                  </option>
                  {tokens.map(token => (
                    <option key={token.id} value={token.id} className="bg-purple-900 text-white py-2">
                      {token.name} ({token.currency_code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {selectedToken && (
          <div className="mb-6 glass rounded-2xl overflow-hidden border border-purple-500/40 shadow-2xl">
            <div className="p-6 border-b border-purple-600/50 bg-gradient-to-r from-purple-900/30 to-purple-800/30">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-4 flex-1">
                  <TokenIcon
                    token={{
                      id: selectedToken.id,
                      token_name: selectedToken.name,
                      image_url: selectedToken.image_url
                    }}
                    size="lg"
                  />
                  <div>
                    <h2 className="text-3xl font-bold text-purple-200">{selectedToken.name}</h2>
                    <p className="text-purple-400 text-lg">{selectedToken.currency_code}</p>
                  </div>
                </div>
                {richList.length > 0 && (
                  <div className="relative rounded-2xl overflow-hidden border-3 border-yellow-500/70 shadow-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.4), rgba(251, 191, 36, 0.4))',
                      backdropFilter: 'blur(15px)',
                      boxShadow: '0 0 40px rgba(251, 191, 36, 0.5), inset 0 0 20px rgba(251, 191, 36, 0.2)'
                    }}
                  >
                    <div className="absolute top-3 right-3 text-4xl animate-pulse">
                      👑
                    </div>
                    <div className="p-6 pr-16">
                      <div className="text-yellow-300/90 text-xs font-bold mb-2 uppercase tracking-wider">MemeKing</div>
                      <div className="text-yellow-100 font-extrabold text-xl mb-3">#{1} Top Holder</div>
                      <div className="font-mono text-yellow-200 text-sm mb-3 bg-yellow-900/30 px-3 py-2 rounded-lg border border-yellow-500/40">
                        {richList[0].address.slice(0, 10)}...{richList[0].address.slice(-8)}
                      </div>
                      <div className="text-3xl font-extrabold text-yellow-50 mb-2">
                        {formatNumber(richList[0].balance)}
                      </div>
                      <div className="text-sm text-yellow-300/90 mb-3 font-medium">
                        {selectedToken.currency_code}
                      </div>
                      <div className="text-yellow-200 font-bold text-base mb-4 bg-yellow-900/40 px-3 py-2 rounded-lg border border-yellow-500/40">
                        {((richList[0].balance / stats.totalSupplyHeld) * 100).toFixed(2)}% of supply
                      </div>
                      <a
                        href={`https://${network === 'mainnet' ? '' : 'test.'}xrpscan.com/account/${richList[0].address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-yellow-600/50 hover:bg-yellow-600/70 text-yellow-50 rounded-lg text-sm font-bold transition-all duration-200 border-2 border-yellow-500/60 hover:border-yellow-400 hover:shadow-lg hover:scale-105"
                      >
                        🔍 View Wallet
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-6 bg-purple-900/20">
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 rounded-xl p-5 border border-purple-600/40 hover:border-purple-500/60 transition-all hover:shadow-lg hover:shadow-purple-500/20">
                <div className="text-purple-300 text-sm mb-2 font-medium">Total Holders</div>
                <div className="text-3xl font-bold text-purple-100">{stats.totalHolders}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 rounded-xl p-5 border border-purple-600/40 hover:border-purple-500/60 transition-all hover:shadow-lg hover:shadow-purple-500/20">
                <div className="text-purple-300 text-sm mb-2 font-medium">Total Trustlines</div>
                <div className="text-3xl font-bold text-purple-100">{stats.totalTrustlines}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 rounded-xl p-5 border border-purple-600/40 hover:border-purple-500/60 transition-all hover:shadow-lg hover:shadow-purple-500/20">
                <div className="text-purple-300 text-sm mb-2 font-medium">Total Supply Held</div>
                <div className="text-3xl font-bold text-purple-100">{formatNumber(stats.totalSupplyHeld)}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 rounded-xl p-5 border border-purple-600/40 hover:border-purple-500/60 transition-all hover:shadow-lg hover:shadow-purple-500/20">
                <div className="text-purple-300 text-sm mb-2 font-medium">Average Holding</div>
                <div className="text-3xl font-bold text-purple-100">{formatNumber(stats.avgHolding)}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 rounded-xl p-5 border border-purple-600/40 hover:border-purple-500/60 transition-all hover:shadow-lg hover:shadow-purple-500/20">
                <div className="text-purple-300 text-sm mb-2 font-medium">Median Holding</div>
                <div className="text-3xl font-bold text-purple-100">{formatNumber(stats.medianHolding)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 pt-0 bg-purple-900/20">
              <div className="bg-gradient-to-br from-purple-600/40 to-pink-600/40 rounded-xl p-5 border border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/30 transition-all">
                <div className="text-purple-200 text-sm mb-2 font-medium">Top Holder Share</div>
                <div className="text-4xl font-extrabold text-purple-100">
                  {stats.topHolderPercentage.toFixed(2)}%
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-700/40 to-purple-500/40 rounded-xl p-5 border border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/30 transition-all">
                <div className="text-purple-200 text-sm mb-2 font-medium">Top 10 Concentration</div>
                <div className="text-3xl font-bold text-purple-100 mb-2">
                  {stats.concentrationRatio.toFixed(2)}%
                </div>
                <div className={`text-sm font-semibold ${concentration.color}`}>
                  {concentration.label}
                </div>
              </div>
              <div className="bg-gradient-to-br from-pink-700/40 to-purple-700/40 rounded-xl p-5 border border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/30 transition-all">
                <div className="text-purple-200 text-sm mb-2 font-medium">Gini Coefficient</div>
                <div className="text-3xl font-bold text-purple-100 mb-2">
                  {stats.giniCoefficient.toFixed(3)}
                </div>
                <div className={`text-sm font-semibold ${giniLevel.color}`}>
                  {giniLevel.label}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-800/40 to-purple-600/40 rounded-xl p-5 border border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/30 transition-all">
                <div className="text-purple-200 text-sm mb-2 font-medium flex items-center gap-2">
                  <span>🏗️</span>
                  <span>Developer Wallet</span>
                </div>
                <div className="text-3xl font-bold text-purple-100 mb-1">
                  {formatNumber(stats.developerBalance)}
                </div>
                <div className="text-xs text-purple-300/80 mb-2">
                  {selectedToken.currency_code}
                </div>
                <div className="text-sm font-semibold text-purple-300 mb-2">
                  {(stats.totalSupplyIssued || 0) > 0
                    ? ((stats.developerBalance / stats.totalSupplyIssued) * 100).toFixed(2)
                    : '0.00'}% of supply
                </div>
                <div className="text-xs font-mono text-purple-400/60 break-all">
                  {selectedToken.issuer_address}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="glass rounded-2xl overflow-hidden border border-purple-500/50 shadow-2xl">
          <div className="p-6 border-b border-purple-600/50 bg-gradient-to-r from-purple-900/50 to-purple-800/50">
            <h3 className="text-2xl font-bold text-purple-200">
              {richList.length > 0 ? '📊 All Holders' : '📊 Rich List Rankings'}
            </h3>
            {richList.length > 0 && (
              <p className="text-purple-400 text-sm mt-2">
                Showing all {richList.length} token holders ranked by balance
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-purple-300 text-lg">Loading rich list data...</p>
              </div>
            </div>
          ) : richList.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-4">👑</div>
              <p className="text-purple-400 text-lg">
                {selectedToken ? 'No holders found for this token' : 'Select a token above to view the rich list'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-600/50 bg-purple-900/60">
                    <th className="text-left p-4 text-purple-300 font-semibold">Rank</th>
                    <th className="text-left p-4 text-purple-300 font-semibold">Wallet Address</th>
                    <th className="text-right p-4 text-purple-300 font-semibold">Balance</th>
                    <th className="text-right p-4 text-purple-300 font-semibold">% of Supply</th>
                    <th className="text-center p-4 text-purple-300 font-semibold">Actions</th>
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
                        className={`border-b border-purple-700/30 hover:bg-purple-800/50 transition-colors ${
                          isTopHolder ? 'bg-purple-600/20 hover:bg-purple-600/30' : isTopTen ? 'bg-purple-800/30' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {isTopHolder && <span className="text-3xl animate-pulse">👑</span>}
                            {!isTopHolder && isTopTen && <span className="text-2xl">🥇</span>}
                            <span className={`font-bold ${isTopHolder ? 'text-purple-300 text-xl' : 'text-purple-200 text-lg'}`}>
                              #{index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-purple-300 text-sm bg-purple-900/50 px-3 py-1.5 rounded-lg inline-block border border-purple-700/40">
                            {holder.address.slice(0, 10)}...{holder.address.slice(-8)}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="font-bold text-purple-200 text-lg">
                            {formatNumber(holder.balance)}
                          </div>
                          <div className="text-xs text-purple-500 font-medium">
                            {selectedToken.currency_code}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className={`font-bold text-base ${
                            percentage >= 10 ? 'text-pink-400' :
                            percentage >= 5 ? 'text-purple-300' :
                            percentage >= 1 ? 'text-purple-400' :
                            'text-purple-500'
                          }`}>
                            {percentage.toFixed(2)}%
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center">
                            <a
                              href={`https://${network === 'mainnet' ? '' : 'test.'}xrpscan.com/account/${holder.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-purple-600/40 hover:bg-purple-600/60 text-purple-100 rounded-lg text-sm font-semibold transition-all duration-200 border border-purple-500/40 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105"
                            >
                              🔍 View
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

        <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-purple-900/50 to-purple-800/50 border border-purple-600/40 shadow-lg shadow-purple-500/20">
          <h4 className="text-base font-bold text-purple-200 mb-3 flex items-center gap-2">
            <span>📚</span>
            Distribution Metrics Explained
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-purple-300">
            <div className="bg-purple-900/50 p-4 rounded-lg border border-purple-700/40">
              <strong className="text-purple-200">Gini Coefficient:</strong> Measures wealth inequality. 0 = perfect equality, 1 = perfect inequality. Lower values indicate better distribution.
            </div>
            <div className="bg-purple-900/50 p-4 rounded-lg border border-purple-700/40">
              <strong className="text-purple-200">Top 10 Concentration:</strong> Percentage of total supply held by top 10 holders. Lower percentages indicate healthier distribution.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
