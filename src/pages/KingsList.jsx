import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';
import { Client } from 'xrpl';
import { XRPScanLink } from '../components/XRPScanLink';

export default function KingsList() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAllTokens();
  }, []);

  const loadAllTokens = async () => {
    setLoading(true);
    try {
      // Load all tokens
      const { data: tokensData, error: tokensError } = await supabase
        .from('meme_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (tokensError) throw tokensError;

      // Load cached holder data for all tokens
      const { data: holdersData } = await supabase
        .from('token_holders')
        .select('*')
        .eq('rank', 1);

      // Map holders to tokens
      const tokensWithHolders = (tokensData || []).map(token => {
        const holder = holdersData?.find(h => h.token_id === token.id);
        return {
          ...token,
          topHolder: holder || null
        };
      });

      setTokens(tokensWithHolders);
    } catch (error) {
      console.error('Error loading tokens:', error);
      toast.error('Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const fetchTopHolder = async (tokenId) => {
    setFetching(prev => ({ ...prev, [tokenId]: true }));
    let client = null;

    try {
      const token = tokens.find(t => t.id === tokenId);
      if (!token) {
        toast.error('Token not found');
        setFetching(prev => ({ ...prev, [tokenId]: false }));
        return;
      }

      if (!token.issuer_address) {
        toast.error(`Token ${token.token_name} missing issuer address`);
        setFetching(prev => ({ ...prev, [tokenId]: false }));
        return;
      }

      client = new Client('wss://xrplcluster.com');
      await client.connect();

      try {
        // Fetch holder data and price data in parallel
        const [holderResponse, ammPriceResponse] = await Promise.all([
          client.request({
            command: 'account_lines',
            account: token.issuer_address,
            peer: undefined,
            ledger_index: 'validated'
          }).catch(err => {
            console.error('Error fetching account lines:', err);
            return { result: { lines: [] } };
          }),
          token.amm_account_id ? client.request({
            command: 'amm_info',
            asset: {
              currency: token.currency_code,
              issuer: token.issuer_address
            },
            asset2: {
              currency: 'XRP'
            },
            ledger_index: 'validated'
          }).catch(err => {
            console.error('Error fetching AMM info:', err);
            return null;
          }) : Promise.resolve(null)
        ]);

        const trustlines = holderResponse?.result?.lines || [];

        if (trustlines.length === 0) {
          console.log(`No trustlines found for ${token.token_name} (${token.issuer_address})`);
          toast.error(`No holders found for ${token.token_name}`);
          if (client) await client.disconnect();
          setFetching(prev => ({ ...prev, [tokenId]: false }));
          return;
        }

        console.log(`Found ${trustlines.length} trustlines for ${token.token_name}`);

        // Sort by balance descending
        trustlines.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

        const topLine = trustlines[0];
        const balance = parseFloat(topLine.balance);

        console.log(`Top holder for ${token.token_name}: ${topLine.account} with balance ${balance}`);

        if (balance <= 0) {
          toast.error(`No positive balances found for ${token.token_name}`);
          if (client) await client.disconnect();
          setFetching(prev => ({ ...prev, [tokenId]: false }));
          return;
        }

        // Calculate total supply
        const totalSupply = trustlines.reduce((sum, line) => {
          const bal = parseFloat(line.balance);
          return sum + (bal > 0 ? bal : 0);
        }, 0);

        const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
        const isDeveloperWallet = topLine.account === token.receiver_address;

        // Calculate price from AMM
        let price = 0;
        if (ammPriceResponse?.result?.amm) {
          const amm = ammPriceResponse.result.amm;
          const amount = amm.amount;
          const amount2 = amm.amount2;

          let xrpPool, tokenPool;
          if (typeof amount === 'string') {
            xrpPool = parseFloat(amount) / 1000000;
            tokenPool = parseFloat(amount2.value);
          } else {
            xrpPool = parseFloat(amount2) / 1000000;
            tokenPool = parseFloat(amount.value);
          }

          if (tokenPool > 0) {
            price = xrpPool / tokenPool;
          }
        } else {
          price = parseFloat(token.current_price) || 0;
        }

        const xrpValue = balance * price;

        // Delete old holders for this token
        await supabase
          .from('token_holders')
          .delete()
          .eq('token_id', token.id);

        // Save all holders
        const holdersToInsert = trustlines.map((line, index) => {
          const bal = parseFloat(line.balance);
          if (bal <= 0) return null;
          return {
            token_id: token.id,
            holder_address: line.account,
            balance: bal,
            percentage: totalSupply > 0 ? (bal / totalSupply) * 100 : 0,
            is_developer_wallet: line.account === token.receiver_address,
            rank: index + 1,
            last_updated: new Date().toISOString()
          };
        }).filter(h => h !== null);

        if (holdersToInsert.length > 0) {
          await supabase
            .from('token_holders')
            .insert(holdersToInsert);
        }

        // Update token price
        if (price > 0) {
          await supabase
            .from('meme_tokens')
            .update({
              current_price: price,
              updated_at: new Date().toISOString()
            })
            .eq('id', token.id);
        }

        // Update local state
        setTokens(prev => prev.map(t => {
          if (t.id === tokenId) {
            return {
              ...t,
              current_price: price,
              topHolder: {
                holder_address: topLine.account,
                balance: balance,
                percentage: percentage,
                is_developer_wallet: isDeveloperWallet,
                rank: 1,
                last_updated: new Date().toISOString()
              }
            };
          }
          return t;
        }));

        toast.success(`Found king for ${token.token_name}!`);
      } catch (innerError) {
        console.error('Error in fetchTopHolder inner block:', innerError);
        toast.error(`Error: ${innerError.message || 'Failed to process holder data'}`);
      } finally {
        if (client) {
          await client.disconnect();
        }
      }
    } catch (error) {
      console.error('Error fetching top holder (outer):', error);
      const token = tokens.find(t => t.id === tokenId);
      toast.error(`Failed to fetch top holder for ${token?.token_name || 'token'}: ${error.message}`);
    } finally {
      setFetching(prev => ({ ...prev, [tokenId]: false }));
    }
  };

  const fetchAllTopHolders = async () => {
    setLoading(true);
    for (const token of tokens) {
      await fetchTopHolder(token.id);
    }
    setLoading(false);
    toast.success('All top holders updated!');
  };

  const filteredTokens = tokens.filter(token => {
    if (!searchQuery) return true;
    const tokenName = token.token_name || '';
    const tokenSymbol = token.currency_code || '';
    return tokenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const tokensWithKings = filteredTokens.filter(t => t.topHolder !== null);
  const totalXrpValue = tokensWithKings.reduce((sum, token) => {
    const balance = parseFloat(token.topHolder?.balance || 0);
    const price = parseFloat(token.current_price || 0);
    return sum + (balance * price);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">👑 Kings List</h1>
          <p className="text-gray-400">Top holders for each MEMEKINGS token</p>
        </div>

        <button
          onClick={fetchAllTopHolders}
          disabled={loading}
          className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300 flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating All...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Fetch All Kings
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total Tokens</div>
          <div className="text-2xl font-bold text-white">{filteredTokens.length}</div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Kings Found</div>
          <div className="text-2xl font-bold text-yellow-400">{tokensWithKings.length}</div>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total XRP Value</div>
          <div className="text-2xl font-bold text-green-400">
            {totalXrpValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} XRP
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

      {loading && filteredTokens.length === 0 ? (
        <div className="glass rounded-lg p-12 text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-green-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Loading tokens...</p>
        </div>
      ) : filteredTokens.length === 0 ? (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">👑</div>
          <h3 className="text-xl font-bold text-white mb-2">No Tokens Found</h3>
          <p className="text-gray-400">No tokens match your search.</p>
        </div>
      ) : (
        <div className="glass rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50 border-b border-gray-700">
                <tr>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">Token</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">King Address</th>
                  <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">Balance</th>
                  <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">% Supply</th>
                  <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">XRP Value</th>
                  <th className="text-center px-6 py-4 text-gray-400 font-medium text-sm">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredTokens.map((token) => {
                  const holder = token.topHolder;
                  const balance = holder ? parseFloat(holder.balance) : 0;
                  const price = parseFloat(token.current_price) || 0;
                  const xrpValue = balance * price;

                  return (
                    <tr key={token.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <TokenIcon token={token} size="md" />
                          <div>
                            <div className="text-white font-bold">{token.token_name}</div>
                            <div className="text-gray-400 text-sm">{token.currency_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {holder ? (
                          holder.is_developer_wallet ? (
                            <div className="inline-flex px-3 py-1 bg-gradient-to-r from-purple-600 to-purple-500 rounded-full text-white text-xs font-medium">
                              MEMEKINGS Dev
                            </div>
                          ) : (
                            <XRPScanLink
                              type="address"
                              value={holder.holder_address}
                              network="mainnet"
                              className="text-green-400 hover:text-green-300 text-sm font-mono"
                            />
                          )
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {holder ? (
                          <>
                            <div className="text-white font-bold">
                              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-gray-500 text-xs">{token.currency_code}</div>
                          </>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {holder ? (
                          <div className="text-green-400 font-bold">
                            {parseFloat(holder.percentage).toFixed(2)}%
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {holder && xrpValue > 0 ? (
                          <>
                            <div className="text-green-400 font-bold">
                              {xrpValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>
                            <div className="text-gray-500 text-xs">XRP</div>
                          </>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => fetchTopHolder(token.id)}
                          disabled={fetching[token.id]}
                          className="text-yellow-400 hover:text-yellow-300 disabled:opacity-50 inline-flex items-center gap-1 text-sm transition-colors"
                          title={holder ? "Refresh top holder" : "Fetch top holder"}
                        >
                          {fetching[token.id] ? (
                            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <span className="text-2xl">👑</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
