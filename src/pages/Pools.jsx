import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';
import { onTokenUpdate } from '../utils/tokenEvents';

export default function Pools() {
  const [tokens, setTokens] = useState([]);
  const [poolsData, setPoolsData] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [lpBalances, setLpBalances] = useState({});
  const [viewMode, setViewMode] = useState(() => {
    return window.innerWidth < 768 ? 'grid' : 'list';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('liquidity');
  const [poolFilter, setPoolFilter] = useState('all');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    loadTokens();
    loadConnectedWallet();

    const unsubscribe = onTokenUpdate(() => {
      loadTokens();
    });

    const handleWalletChange = () => {
      loadConnectedWallet();
    };
    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);

    return () => {
      unsubscribe();
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  }, []);

  useEffect(() => {
    if (tokens.length > 0) {
      fetchAllPoolsData();
    }
  }, [tokens]);

  useEffect(() => {
    if (connectedWallet && Object.keys(poolsData).length > 0) {
      fetchLPBalances();
    }
  }, [connectedWallet, poolsData]);

  useEffect(() => {
    if (connectedWallet) {
      loadFavorites();
    }
  }, [connectedWallet]);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    } else {
      setConnectedWallet(null);
    }
  };

  const loadFavorites = async () => {
    if (!connectedWallet) return;
    try {
      const { data, error } = await supabase
        .from('token_favorites')
        .select('token_id')
        .eq('user_address', connectedWallet.address);

      if (error) throw error;
      setFavorites(data?.map(f => f.token_id) || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (tokenId, e) => {
    if (e) e.stopPropagation();
    if (!connectedWallet) {
      toast.error('Connect wallet to favorite pools');
      return;
    }

    try {
      const isFavorited = favorites.includes(tokenId);

      if (isFavorited) {
        const { error } = await supabase
          .from('token_favorites')
          .delete()
          .eq('user_address', connectedWallet.address)
          .eq('token_id', tokenId);

        if (error) throw error;
        setFavorites(favorites.filter(id => id !== tokenId));
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('token_favorites')
          .insert([{
            user_address: connectedWallet.address,
            token_id: tokenId
          }]);

        if (error) throw error;
        setFavorites([...favorites, tokenId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const loadTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .eq('amm_pool_created', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const fetchAllPoolsData = async (forceRefresh = false) => {
    setRefreshing(true);

    try {
      const cacheAge = 30;
      const { data: cachedPools, error: cacheError } = await supabase
        .from('pool_data_cache')
        .select('*')
        .gte('last_updated', new Date(Date.now() - cacheAge * 1000).toISOString());

      if (!forceRefresh && cachedPools && cachedPools.length > 0 && !cacheError) {
        console.log(`✅ Using cached pool data (${cachedPools.length} pools)`);

        const poolData = {};
        cachedPools.forEach(cache => {
          poolData[cache.token_id] = {
            xrpAmount: parseFloat(cache.xrp_amount),
            tokenAmount: parseFloat(cache.token_amount),
            lpTokens: parseFloat(cache.lp_tokens),
            price: parseFloat(cache.price),
            accountId: cache.account_id,
            volume24h: parseFloat(cache.volume_24h || 0),
            priceChange24h: parseFloat(cache.price_change_24h || 0)
          };
        });

        setPoolsData(poolData);
        setRefreshing(false);
        return;
      }

      console.log('🔄 Fetching fresh pool data from XRPL...');
      const { requestWithRetry } = await import('../utils/xrplClient');
      const poolData = {};

      for (const token of tokens) {
        try {
          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

          console.log(`Fetching AMM info for ${token.token_name}:`, {
            currency: token.currency_code,
            hex: currencyHex,
            issuer: token.issuer_address
          });

          const ammInfoResponse = await requestWithRetry({
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
            const xrpAmount = parseFloat(amm.amount) / 1000000;
            const tokenAmount = parseFloat(amm.amount2.value);
            const lpTokens = parseFloat(amm.lp_token?.value || 0);
            const tradingFee = parseFloat(amm.trading_fee || 0) / 1000;
            const auctionSlot = amm.auction_slot || null;

            const volume24h = token.volume_24h ? parseFloat(token.volume_24h) : 0;
            const fees24h = volume24h * (tradingFee / 100);
            const apr = xrpAmount > 0 ? ((fees24h * 365) / xrpAmount) * 100 : 0;

            poolData[token.id] = {
              xrpAmount,
              tokenAmount,
              lpTokens,
              price: xrpAmount / tokenAmount,
              accountId: amm.account,
              tradingFee,
              volume24h,
              fees24h,
              apr,
              auctionSlot
            };

            console.log(`Found pool for ${token.token_name}:`, poolData[token.id]);
          } else {
            console.log(`No AMM found for ${token.token_name}`);
          }
        } catch (error) {
          console.error(`Error fetching pool data for ${token.token_name}:`, error.message);
          poolData[token.id] = null;
        }
      }

      const cacheRecords = Object.entries(poolData)
        .filter(([_, data]) => data !== null)
        .map(([tokenId, data]) => ({
          token_id: tokenId,
          xrp_amount: data.xrpAmount,
          token_amount: data.tokenAmount,
          lp_tokens: data.lpTokens,
          price: data.price,
          account_id: data.accountId,
          volume_24h: data.volume24h || 0,
          price_change_24h: 0,
          last_updated: new Date().toISOString()
        }));

      if (cacheRecords.length > 0) {
        for (const record of cacheRecords) {
          await supabase
            .from('pool_data_cache')
            .upsert(record, { onConflict: 'token_id' });
        }
        console.log(`💾 Cached ${cacheRecords.length} pools`);
      }

      setPoolsData(poolData);
      console.log('All pool data loaded:', poolData);
    } catch (error) {
      console.error('Error fetching pools data:', error);
      toast.error(`Failed to fetch pool data: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchLPBalances = async () => {
    if (!connectedWallet) return;

    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const lpBal = {};
      if (response.result.lines) {
        response.result.lines.forEach(line => {
          const poolData = Object.entries(poolsData).find(
            ([_, data]) => data && data.accountId === line.account
          );

          if (poolData) {
            const [tokenId, data] = poolData;
            const balance = parseFloat(line.balance);
            const share = data.lpTokens > 0 ? (balance / data.lpTokens) * 100 : 0;
            lpBal[tokenId] = { balance, share };
          }
        });
      }

      setLpBalances(lpBal);
      await client.disconnect();
    } catch (error) {
      console.error('Error fetching LP balances:', error);
    }
  };

  const calculatePrice = (token) => {
    if (!token.amm_pool_created || !token.amm_xrp_amount || !token.amm_asset_amount) return 0;
    return token.amm_xrp_amount / token.amm_asset_amount;
  };

  const getLivePrice = (token) => {
    const poolData = poolsData[token.id];
    if (poolData && poolData.price) {
      return poolData.price;
    }
    return calculatePrice(token);
  };

  const calculateMarketCap = (token) => {
    const price = getLivePrice(token);
    const supply = parseFloat(token.total_supply) || 0;
    return price * supply;
  };

  const calculate24hChange = (token) => {
    const poolData = poolsData[token.id];
    if (!poolData || !poolData.price || !token.amm_xrp_amount || !token.amm_asset_amount) {
      return '0.00';
    }

    const currentPrice = poolData.price;
    const startingPrice = token.amm_xrp_amount / token.amm_asset_amount;

    if (!startingPrice || startingPrice === 0) {
      return '0.00';
    }

    const change = ((currentPrice - startingPrice) / startingPrice) * 100;
    return change.toFixed(2);
  };

  const PoolCard = ({ token }) => {
    const poolData = poolsData[token.id];
    const lpBalance = lpBalances[token.id];
    const livePrice = getLivePrice(token);
    const marketCap = calculateMarketCap(token);

    return (
      <div className="glass rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TokenIcon token={token} size="3xl" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-purple-200">{token.token_name}/XRP</h3>
                <button
                  onClick={(e) => toggleFavorite(token.id, e)}
                  className="text-lg hover:scale-110 transition-transform"
                >
                  {favorites.includes(token.id) ? '⭐' : '☆'}
                </button>
              </div>
              <p className="text-purple-400 text-sm">AMM Pool</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="text-2xl font-bold text-purple-200">{livePrice.toFixed(8)}</div>
              {token.amm_pool_created && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  parseFloat(calculate24hChange(token)) >= 0
                    ? 'text-green-300 bg-green-500/10'
                    : 'text-red-300 bg-red-500/10'
                }`}>
                  {parseFloat(calculate24hChange(token)) >= 0 ? '+' : ''}{calculate24hChange(token)}%
                </span>
              )}
            </div>
            <div className="text-purple-400 text-xs">XRP per token</div>
          </div>
        </div>

        {poolData ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-xs mb-1">XRP Liquidity</div>
                <div className="text-lg font-bold text-purple-200">{poolData.xrpAmount.toFixed(2)}</div>
              </div>
              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-xs mb-1">Token Liquidity</div>
                <div className="text-lg font-bold text-purple-200">{poolData.tokenAmount.toFixed(0)}</div>
              </div>
              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-xs mb-1">LP Tokens</div>
                <div className="text-lg font-bold text-purple-200">{poolData.lpTokens.toFixed(2)}</div>
              </div>
              <div className="glass rounded-lg p-4">
                <div className="text-purple-400 text-xs mb-1">Market Cap</div>
                <div className="text-lg font-bold text-purple-200">
                  {marketCap.toFixed(2)} XRP
                </div>
              </div>
            </div>

            {lpBalance && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-green-300 text-sm font-medium mb-1">Your LP Position</div>
                    <div className="text-green-200 text-xs">
                      {lpBalance.balance.toFixed(4)} LP Tokens ({lpBalance.share.toFixed(4)}% of pool)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-200 font-bold">
                      ~{(poolData.xrpAmount * lpBalance.share / 100).toFixed(4)} XRP
                    </div>
                    <div className="text-green-300 text-xs">Your Share Value</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <a
                href={`https://xmagnetic.org/amm/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-primary text-center py-2 rounded-lg text-sm"
              >
                🏊 AMM Pool →
              </a>
              <button
                onClick={() => {
                  localStorage.setItem('selectedTradeToken', JSON.stringify(token));
                  window.dispatchEvent(new CustomEvent('navigateToTrade', { detail: token }));
                }}
                className="flex-1 btn-secondary text-center py-2 rounded-lg text-sm"
              >
                💱 Swap
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-purple-400 py-8">
            <div className="animate-pulse">Loading pool data...</div>
          </div>
        )}
      </div>
    );
  };

  const PoolRow = ({ token }) => {
    const poolData = poolsData[token.id];
    const lpBalance = lpBalances[token.id];
    const livePrice = getLivePrice(token);

    if (!poolData) {
      return null;
    }

    return (
      <tr className="border-t border-purple-500/20 hover:bg-purple-900/20">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <TokenIcon token={token} size="3xl" />
            <div className="flex items-center gap-2">
              <div>
                <div className="font-bold text-purple-200">{token.token_name}/XRP</div>
                <div className="text-purple-400 text-xs">{token.currency_code}</div>
              </div>
              <button
                onClick={(e) => toggleFavorite(token.id, e)}
                className="text-lg hover:scale-110 transition-transform"
              >
                {favorites.includes(token.id) ? '⭐' : '☆'}
              </button>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <div className="text-purple-200 font-bold">{livePrice.toFixed(8)}</div>
              <div className="text-purple-400 text-xs">XRP</div>
            </div>
            {token.amm_pool_created && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                parseFloat(calculate24hChange(token)) >= 0
                  ? 'text-green-300 bg-green-500/10'
                  : 'text-red-300 bg-red-500/10'
              }`}>
                {parseFloat(calculate24hChange(token)) >= 0 ? '+' : ''}{calculate24hChange(token)}%
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-purple-200 font-bold">
          {poolData ? `${poolData.xrpAmount.toFixed(2)} XRP` : 'Loading...'}
        </td>
        <td className="px-4 py-3 text-purple-300">
          {poolData && poolData.volume24h > 0 ? `${poolData.volume24h.toFixed(2)} XRP` : '0 XRP'}
        </td>
        <td className="px-4 py-3">
          {poolData && poolData.apr > 0 ? (
            <span className="text-green-400 font-bold">{poolData.apr.toFixed(2)}%</span>
          ) : (
            <span className="text-purple-500">0%</span>
          )}
        </td>
        <td className="px-4 py-3 text-purple-300">
          {poolData && poolData.fees24h > 0 ? `${poolData.fees24h.toFixed(4)} XRP` : '0 XRP'}
        </td>
        <td className="px-4 py-3 text-purple-300">
          {poolData && poolData.lpTokens > 0 ? (
            <span className="font-medium">{(poolData.lpTokens / 1000).toFixed(0)}K</span>
          ) : (
            <span className="text-purple-500">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-purple-200 font-medium">
          {poolData && poolData.contributors > 0 ? poolData.contributors : '0'}
        </td>
        <td className="px-4 py-3">
          {lpBalance ? (
            <div>
              <div className="text-green-200 font-medium">{lpBalance.balance.toFixed(4)}</div>
              <div className="text-green-400 text-xs">{lpBalance.share.toFixed(2)}%</div>
            </div>
          ) : (
            <span className="text-purple-500">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <a
              href={`https://xmagnetic.org/amm/${token.currency_code}+${token.issuer_address}_XRP+XRP?network=mainnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-white text-xs px-2 py-1 rounded"
              title="AMM Pool"
            >
              🏊 AMM
            </a>
            <button
              onClick={() => {
                localStorage.setItem('selectedTradeToken', JSON.stringify(token));
                window.dispatchEvent(new CustomEvent('navigateToTrade', { detail: token }));
              }}
              className="btn-secondary text-white text-xs px-2 py-1 rounded"
              title="Swap"
            >
              💱
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">AMM Pools</h2>
          <p className="text-purple-400 mt-1">Liquidity pools for all platform tokens</p>
        </div>
        <button
          onClick={fetchAllPoolsData}
          disabled={refreshing}
          className="btn text-purple-300 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Pools'}
        </button>
      </div>

      {!connectedWallet && (
        <div className="glass rounded-lg p-6 bg-yellow-500/10 border border-yellow-500/30">
          <div className="text-center space-y-2">
            <div className="text-2xl">💡</div>
            <div className="text-yellow-200 font-medium">Connect Wallet to See Your LP Positions</div>
            <p className="text-yellow-300 text-sm">
              Connect your wallet from the Setup page to view your liquidity provider positions
            </p>
          </div>
        </div>
      )}

      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setPoolFilter('all')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                poolFilter === 'all' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
              }`}
            >
              All AMM Pools
            </button>
            <button
              onClick={() => setPoolFilter('mine')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                poolFilter === 'mine' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
              }`}
            >
              My AMM Pools
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
              }`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'glass text-purple-300'
              }`}
            >
              ▦ Grid
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <input
            type="text"
            placeholder="🔍 Search pools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input text-purple-200 md:col-span-2"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input text-purple-200"
          >
            <option value="liquidity">Sort by Liquidity</option>
            <option value="volume">Sort by Volume</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tokens
              .filter(token => {
                if (!token.amm_pool_created) return false;
                const matchesSearch = token.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  token.currency_code.toLowerCase().includes(searchQuery.toLowerCase());
                const hasLP = lpBalances[token.id] && lpBalances[token.id].balance > 0;
                return matchesSearch && (poolFilter === 'all' || (poolFilter === 'mine' && hasLP));
              })
              .sort((a, b) => {
                if (sortBy === 'liquidity') {
                  return (poolsData[b.id]?.xrpAmount || 0) - (poolsData[a.id]?.xrpAmount || 0);
                } else if (sortBy === 'volume') {
                  return (poolsData[b.id]?.tokenAmount || 0) - (poolsData[a.id]?.tokenAmount || 0);
                } else {
                  return a.token_name.localeCompare(b.token_name);
                }
              })
              .map(token => (
                <PoolCard key={token.id} token={token} />
              ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-900/30">
                <tr>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Pool</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Live Price</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Liquidity</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">24h Volume</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">APR (1 year)</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">24h Fees</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">LP Tokens</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Contributors</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Your LP</th>
                  <th className="text-left px-4 py-3 text-purple-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens
                  .filter(token => {
                    if (!token.amm_pool_created) return false;
                    const matchesSearch = token.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      token.currency_code.toLowerCase().includes(searchQuery.toLowerCase());
                    const hasLP = lpBalances[token.id] && lpBalances[token.id].balance > 0;
                    return matchesSearch && (poolFilter === 'all' || (poolFilter === 'mine' && hasLP));
                  })
                  .sort((a, b) => {
                    if (sortBy === 'liquidity') {
                      return (poolsData[b.id]?.xrpAmount || 0) - (poolsData[a.id]?.xrpAmount || 0);
                    } else if (sortBy === 'volume') {
                      return (poolsData[b.id]?.tokenAmount || 0) - (poolsData[a.id]?.tokenAmount || 0);
                    } else {
                      return a.token_name.localeCompare(b.token_name);
                    }
                  })
                  .map(token => (
                    <PoolRow key={token.id} token={token} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tokens.length === 0 && (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🏊</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">No AMM Pools Yet</h3>
          <p className="text-purple-400">AMM pools will appear here once tokens are created with liquidity</p>
        </div>
      )}
    </div>
  );
}
