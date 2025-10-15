import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';
import { Client } from 'xrpl';
import { XRPScanLink } from '../components/XRPScanLink';

export default function KingsList() {
  const [kings, setKings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadKings();
  }, []);

  const loadKings = async () => {
    setLoading(true);
    try {
      const { data: tokensData, error: tokensError } = await supabase
        .from('meme_tokens')
        .select('*')
        .order('created_at', { ascending: true });

      if (tokensError) {
        console.error('Error loading tokens:', tokensError);
        throw tokensError;
      }

      if (!tokensData || tokensData.length === 0) {
        console.log('No tokens found in database');
        setKings([]);
        setLoading(false);
        return;
      }

      console.log(`Found ${tokensData.length} tokens, checking holders...`);

      const kingsData = [];
      for (const token of tokensData) {
        const { data: holderData, error: holderError } = await supabase
          .from('token_holders')
          .select('*')
          .eq('token_id', token.id)
          .order('rank', { ascending: true })
          .limit(1);

        if (holderError) {
          console.error(`Error loading holder for token ${token.name}:`, holderError);
          continue;
        }

        if (holderData && holderData.length > 0) {
          const holder = holderData[0];
          const balance = parseFloat(holder.balance) || 0;
          const price = parseFloat(token.current_price) || 0;
          const xrpValue = balance * price;

          kingsData.push({
            token,
            holder,
            xrpValue
          });
        }
      }

      console.log(`Found ${kingsData.length} kings with holder data`);
      setKings(kingsData);
    } catch (error) {
      console.error('Error loading kings:', error);
      toast.error(`Failed to load kings list: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshTokenHolders = async (tokenId) => {
    setRefreshing(prev => ({ ...prev, [tokenId]: true }));

    try {
      const king = kings.find(k => k.token.id === tokenId);
      if (!king) return;

      const token = king.token;
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

        await loadKings();
        toast.success(`Updated holders for ${token.token_name || token.name}`);
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error refreshing holders:', error);
      toast.error('Failed to refresh holders');
    } finally {
      setRefreshing(prev => ({ ...prev, [tokenId]: false }));
    }
  };

  const refreshAllHolders = async () => {
    if (loading) {
      console.log('Already loading, skipping refresh');
      return;
    }

    setLoading(true);

    try {
      if (kings.length === 0) {
        console.log('No kings to refresh, loading kings first...');
        await loadKings();
        return;
      }

      for (const king of kings) {
        await refreshTokenHolders(king.token.id);
      }
      toast.success('All token holders updated!');
    } catch (error) {
      console.error('Error in refreshAllHolders:', error);
      toast.error('Failed to refresh all holders');
    } finally {
      setLoading(false);
    }
  };

  const filteredKings = kings.filter(king => {
    if (!searchQuery) return true;
    const token = king.token;
    const tokenName = token.token_name || token.name || '';
    const tokenSymbol = token.currency_code || token.symbol || '';
    return tokenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalXrpValue = filteredKings.reduce((sum, king) => sum + king.xrpValue, 0);

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
              Refreshing...
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total Tokens</div>
          <div className="text-2xl font-bold text-white">{filteredKings.length}</div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total XRP Value</div>
          <div className="text-2xl font-bold text-green-400">
            {totalXrpValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} XRP
          </div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Avg XRP Value</div>
          <div className="text-2xl font-bold text-blue-400">
            {filteredKings.length > 0
              ? (totalXrpValue / filteredKings.length).toLocaleString(undefined, { maximumFractionDigits: 2 })
              : '0'} XRP
          </div>
        </div>
      </div>

      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tokens..."
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:border-green-500 focus:ring-green-500/50"
        />
      </div>

      {loading && filteredKings.length === 0 ? (
        <div className="glass rounded-lg p-12 text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-green-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Loading kings...</p>
        </div>
      ) : filteredKings.length === 0 ? (
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
        <div className="glass rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50 border-b border-gray-700">
                <tr>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Rank</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Token</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">King Address</th>
                  <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">Balance</th>
                  <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">% Supply</th>
                  <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">XRP Value</th>
                  <th className="text-center px-6 py-4 text-gray-400 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredKings.map((king, index) => (
                  <tr key={king.token.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-sm font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <TokenIcon token={king.token} size="md" />
                        <div>
                          <div className="text-white font-bold">{king.token.token_name || king.token.name}</div>
                          <div className="text-gray-400 text-sm">{king.token.currency_code || king.token.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {king.holder.is_developer_wallet ? (
                        <div className="inline-flex px-3 py-1 bg-gradient-to-r from-purple-600 to-purple-500 rounded-full text-white text-xs font-medium">
                          MEMEKINGS Dev
                        </div>
                      ) : (
                        <XRPScanLink
                          type="address"
                          value={king.holder.holder_address}
                          network="mainnet"
                          className="text-green-400 hover:text-green-300 text-sm font-mono"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-white font-bold">
                        {parseFloat(king.holder.balance).toLocaleString(undefined, {
                          maximumFractionDigits: 2
                        })}
                      </div>
                      <div className="text-gray-500 text-xs">{king.token.currency_code || king.token.symbol}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-green-400 font-bold">
                        {parseFloat(king.holder.percentage).toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-green-400 font-bold">
                        {king.xrpValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </div>
                      <div className="text-gray-500 text-xs">XRP</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => refreshTokenHolders(king.token.id)}
                        disabled={refreshing[king.token.id]}
                        className="text-green-400 hover:text-green-300 disabled:opacity-50 inline-flex items-center gap-1 text-sm"
                        title="Refresh holder data"
                      >
                        {refreshing[king.token.id] ? (
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
