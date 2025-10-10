import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';
import { Client } from 'xrpl';
import { XRPScanLink } from '../components/XRPScanLink';

export default function KingsList() {
  const [tokens, setTokens] = useState([]);
  const [holders, setHolders] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState({});
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('balance');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalKings: 0,
    totalBalance: 0,
    avgHolding: 0,
    topKing: null
  });

  useEffect(() => {
    loadTokensAndHolders();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [holders]);

  const loadTokensAndHolders = async () => {
    setLoading(true);
    try {
      const { data: tokensData, error: tokensError } = await supabase
        .from('meme_tokens')
        .select('*')
        .order('created_at', { ascending: true });

      if (tokensError) throw tokensError;

      setTokens(tokensData || []);

      const holdersData = {};
      for (const token of tokensData || []) {
        const { data: holderData } = await supabase
          .from('token_holders')
          .select('*')
          .eq('token_id', token.id)
          .order('rank', { ascending: true })
          .limit(1);

        if (holderData && holderData.length > 0) {
          holdersData[token.id] = holderData[0];
        }
      }

      setHolders(holdersData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load token holders');
    } finally {
      setLoading(false);
    }
  };

  const refreshTokenHolders = async (token) => {
    setRefreshing(prev => ({ ...prev, [token.id]: true }));

    try {
      const receiverWallet = localStorage.getItem('memekings_receiver');

      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      try {
        const response = await client.request({
          command: 'account_lines',
          account: token.issuer_address,
          peer: undefined,
          ledger_index: 'validated'
        });

        const trustlines = response.result.lines || [];

        const totalSupply = parseFloat(token.initial_supply) || 0;
        const holdersToInsert = [];

        trustlines.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

        trustlines.forEach((line, index) => {
          const balance = parseFloat(line.balance);
          if (balance > 0) {
            const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;

            holdersToInsert.push({
              token_id: token.id,
              holder_address: line.account,
              balance: balance,
              percentage: percentage,
              is_developer_wallet: line.account === receiverWallet,
              rank: index + 1,
              last_updated: new Date().toISOString()
            });
          }
        });

        await supabase
          .from('token_holders')
          .delete()
          .eq('token_id', token.id);

        if (holdersToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('token_holders')
            .insert(holdersToInsert);

          if (insertError) throw insertError;
        }

        const topHolder = holdersToInsert[0];
        if (topHolder) {
          setHolders(prev => ({
            ...prev,
            [token.id]: topHolder
          }));
        }

        toast.success(`Updated holders for ${token.name}`);
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error refreshing holders:', error);
      toast.error(`Failed to refresh holders for ${token.name}`);
    } finally {
      setRefreshing(prev => ({ ...prev, [token.id]: false }));
    }
  };

  const refreshAllHolders = async () => {
    setLoading(true);
    for (const token of tokens) {
      await refreshTokenHolders(token);
    }
    setLoading(false);
    toast.success('All token holders updated!');
  };

  const calculateStats = () => {
    const kingsList = Object.values(holders);
    if (kingsList.length === 0) return;

    const totalBalance = kingsList.reduce((sum, h) => sum + parseFloat(h.balance), 0);
    const avgHolding = totalBalance / kingsList.length;

    const topKing = kingsList.reduce((top, current) => {
      return parseFloat(current.balance) > parseFloat(top?.balance || 0) ? current : top;
    }, null);

    setStats({
      totalKings: kingsList.length,
      totalBalance: totalBalance,
      avgHolding: avgHolding,
      topKing: topKing
    });
  };

  const getTokenById = (tokenId) => {
    return tokens.find(t => t.id === tokenId);
  };

  const sortedTokens = [...tokens].sort((a, b) => {
    const holderA = holders[a.id];
    const holderB = holders[b.id];

    if (!holderA && !holderB) return 0;
    if (!holderA) return 1;
    if (!holderB) return -1;

    switch (sortBy) {
      case 'balance':
        return parseFloat(holderB.balance) - parseFloat(holderA.balance);
      case 'percentage':
        return parseFloat(holderB.percentage) - parseFloat(holderA.percentage);
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const filteredTokens = sortedTokens.filter(token => {
    const matchesSearch = token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         token.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && holders[token.id];
  });

  const KingCard = ({ token, holder, rank }) => (
    <div className="glass rounded-lg p-6 hover:border-green-500/50 transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="relative">
          <TokenIcon token={token} size="lg" />
          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
            #{rank}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-white truncate">{token.name}</h3>
            <span className="text-gray-400 text-sm">({token.symbol})</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-gray-400 text-xs mb-1">👑 Top Holder</div>
              {holder.is_developer_wallet ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-purple-500 rounded-full text-white text-xs font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    MEMEKINGS Developer
                  </div>
                </div>
              ) : (
                <XRPScanLink
                  type="address"
                  value={holder.holder_address}
                  network="mainnet"
                  className="text-green-400 hover:text-green-300 text-sm font-mono"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-xs mb-1">Balance</div>
                <div className="text-white font-bold text-lg">
                  {parseFloat(holder.balance).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <div className="text-gray-500 text-xs">{token.symbol}</div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">% of Supply</div>
                <div className="text-green-400 font-bold text-lg">
                  {parseFloat(holder.percentage).toFixed(2)}%
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full"
                    style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
              <div className="text-gray-500 text-xs">
                Updated: {new Date(holder.last_updated).toLocaleDateString()}
              </div>
              <button
                onClick={() => refreshTokenHolders(token)}
                disabled={refreshing[token.id]}
                className="text-green-400 hover:text-green-300 text-xs flex items-center gap-1 disabled:opacity-50"
              >
                {refreshing[token.id] ? (
                  <>
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const KingRow = ({ token, holder, rank }) => (
    <div className="glass rounded-lg p-4 hover:border-green-500/50 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-sm font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-lg flex-shrink-0">
            #{rank}
          </div>

          <TokenIcon token={token} size="md" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white truncate">{token.name}</h3>
              <span className="text-gray-400 text-sm">({token.symbol})</span>
            </div>
            <div className="text-gray-500 text-xs">
              Updated: {new Date(holder.last_updated).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-gray-400 text-xs mb-1">Balance</div>
            <div className="text-white font-bold">
              {parseFloat(holder.balance).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </div>
          </div>

          <div className="text-right">
            <div className="text-gray-400 text-xs mb-1">% of Supply</div>
            <div className="text-green-400 font-bold">
              {parseFloat(holder.percentage).toFixed(2)}%
            </div>
          </div>

          <div className="w-48">
            <div className="text-gray-400 text-xs mb-1">👑 Top Holder</div>
            {holder.is_developer_wallet ? (
              <div className="px-2 py-1 bg-gradient-to-r from-purple-600 to-purple-500 rounded-full text-white text-xs font-medium text-center">
                MEMEKINGS Developer
              </div>
            ) : (
              <XRPScanLink
                type="address"
                value={holder.holder_address}
                network="mainnet"
                className="text-green-400 hover:text-green-300 text-xs font-mono block truncate"
              />
            )}
          </div>

          <button
            onClick={() => refreshTokenHolders(token)}
            disabled={refreshing[token.id]}
            className="text-green-400 hover:text-green-300 disabled:opacity-50 flex-shrink-0"
          >
            {refreshing[token.id] ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">👑 Kings List</h1>
          <p className="text-gray-400">Top holders for each MEMEKINGS token</p>
        </div>

        <button
          onClick={refreshAllHolders}
          disabled={loading}
          className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300 flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing All...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh All
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total Kings</div>
          <div className="text-2xl font-bold text-white">{stats.totalKings}</div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total Balance</div>
          <div className="text-2xl font-bold text-green-400">
            {stats.totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Avg Holding</div>
          <div className="text-2xl font-bold text-blue-400">
            {stats.avgHolding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Supreme King</div>
          {stats.topKing && (
            <div className="text-sm font-medium text-yellow-400 truncate">
              {getTokenById(stats.topKing.token_id)?.name || 'N/A'}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokens..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:border-green-500 focus:ring-green-500/50"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:border-green-500 focus:ring-green-500/50"
          >
            <option value="balance">Sort by Balance</option>
            <option value="percentage">Sort by Percentage</option>
            <option value="name">Sort by Name</option>
          </select>

          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {loading && filteredTokens.length === 0 ? (
        <div className="glass rounded-lg p-12 text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-green-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Loading token holders...</p>
        </div>
      ) : filteredTokens.length === 0 ? (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">👑</div>
          <h3 className="text-xl font-bold text-white mb-2">No Kings Found</h3>
          <p className="text-gray-400 mb-6">No token holders data available yet.</p>
          <button
            onClick={refreshAllHolders}
            className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-lg hover:from-green-500 hover:to-green-400 shadow-lg shadow-green-500/20 transition-all duration-300"
          >
            Fetch Holder Data
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-4'}>
          {filteredTokens.map((token, index) => {
            const holder = holders[token.id];
            if (!holder) return null;

            return viewMode === 'grid' ? (
              <KingCard key={token.id} token={token} holder={holder} rank={index + 1} />
            ) : (
              <KingRow key={token.id} token={token} holder={holder} rank={index + 1} />
            );
          })}
        </div>
      )}
    </div>
  );
}
