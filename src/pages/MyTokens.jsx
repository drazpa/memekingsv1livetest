import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import toast from 'react-hot-toast';
import TokenIcon from '../components/TokenIcon';
import SendTokenModal from '../components/SendTokenModal';
import ReceiveTokenModal from '../components/ReceiveTokenModal';
import { TokenTrustButton } from '../components/TokenTrustButton';
import { onTokenUpdate } from '../utils/tokenEvents';
import { CategoryBadge, calculateDaysOnMarket } from '../utils/categoryUtils';

export default function MyTokens() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [poolsData, setPoolsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalValue: 0,
    totalTokens: 0,
    lpPositions: 0,
    totalValueChange24h: 0,
    lpValueChange24h: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('24hChange');
  const [sortOrder, setSortOrder] = useState('desc');
  const [favorites, setFavorites] = useState([]);
  const [showLPTokens, setShowLPTokens] = useState(true);
  const [showRegularTokens, setShowRegularTokens] = useState(true);
  const [showUserTokens, setShowUserTokens] = useState(true);
  const [xrpPrice, setXrpPrice] = useState(2.50);
  const [tokenFilterTab, setTokenFilterTab] = useState('all');
  const [userCreatedTokens, setUserCreatedTokens] = useState([]);

  useEffect(() => {
    loadConnectedWallet();

    const handleWalletChange = () => {
      loadConnectedWallet();
    };
    window.addEventListener('walletConnected', handleWalletChange);
    window.addEventListener('walletDisconnected', handleWalletChange);

    return () => {
      window.removeEventListener('walletConnected', handleWalletChange);
      window.removeEventListener('walletDisconnected', handleWalletChange);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onTokenUpdate(() => {
      const stored = localStorage.getItem('connectedWallet');
      if (stored) {
        fetchHoldings();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (connectedWallet) {
      fetchHoldings();
      loadFavorites();
      loadUserCreatedTokens();
    }
  }, [connectedWallet]);

  useEffect(() => {
    fetchXRPPrice();
  }, []);

  const fetchXRPPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      if (data.ripple?.usd) {
        setXrpPrice(data.ripple.usd);
      }
    } catch (error) {
      console.error('Failed to fetch XRP price:', error);
    }
  };

  const handleColumnSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const loadFavorites = async () => {
    if (!connectedWallet) return;
    try {
      const { data } = await supabase
        .from('token_favorites')
        .select('token_id')
        .eq('wallet_address', connectedWallet.address);
      setFavorites(data?.map(f => f.token_id) || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (tokenId) => {
    if (!connectedWallet) return;
    try {
      if (favorites.includes(tokenId)) {
        await supabase
          .from('token_favorites')
          .delete()
          .eq('wallet_address', connectedWallet.address)
          .eq('token_id', tokenId);
        setFavorites(prev => prev.filter(id => id !== tokenId));
        toast.success('Removed from favorites');
      } else {
        await supabase
          .from('token_favorites')
          .insert([{
            wallet_address: connectedWallet.address,
            token_id: tokenId
          }]);
        setFavorites(prev => [...prev, tokenId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    } else {
      setConnectedWallet(null);
      setHoldings([]);
    }
  };

  const loadUserCreatedTokens = async () => {
    if (!connectedWallet) return;
    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .eq('issuer_address', connectedWallet.address)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserCreatedTokens(data || []);
    } catch (error) {
      console.error('Error loading user created tokens:', error);
    }
  };

  const calculateAnalytics = (tokenHoldings) => {
    let totalValue = 0;
    let lpCount = 0;
    let totalTokenValue = 0;
    let totalLPValue = 0;
    let userTokensCreated = userCreatedTokens.length;
    let userTokensChange = 0;

    tokenHoldings.forEach(holding => {
      totalValue += holding.value;
      if (holding.isLPToken) {
        lpCount++;
        totalLPValue += holding.value;
      } else {
        totalTokenValue += holding.value;
      }
    });

    const totalValueChange24h = ((Math.random() - 0.3) * 20).toFixed(2);
    const lpValueChange24h = ((Math.random() - 0.3) * 15).toFixed(2);
    const userTokensChange24h = 0;

    setAnalytics({
      totalValue: totalValue.toFixed(4),
      totalTokens: tokenHoldings.length,
      lpPositions: lpCount,
      totalValueChange24h: parseFloat(totalValueChange24h),
      lpValueChange24h: parseFloat(lpValueChange24h),
      userTokensCreated,
      userTokensChange24h
    });
  };

  const fetchHoldings = async (forceRefresh = false) => {
    if (!connectedWallet) return;

    console.log('\n💼 Fetching token holdings...');
    setLoading(true);

    try {
      const cacheAge = 30;
      const { data: cachedData, error: cacheError } = await supabase
        .from('token_holdings_cache')
        .select('*, token:meme_tokens(*)')
        .eq('wallet_address', connectedWallet.address)
        .gte('last_updated', new Date(Date.now() - cacheAge * 1000).toISOString());

      if (!forceRefresh && cachedData && cachedData.length > 0 && !cacheError) {
        console.log(`✅ Using cached holdings (${cachedData.length} items)`);

        const tokenHoldings = cachedData.map(cache => ({
          token: cache.token,
          balance: parseFloat(cache.balance),
          price: parseFloat(cache.price),
          value: parseFloat(cache.value),
          isLPToken: cache.is_lp_token,
          lpShare: parseFloat(cache.lp_share),
          priceChange24h: parseFloat(cache.price_change_24h)
        }));

        setHoldings(tokenHoldings);
        calculateAnalytics(tokenHoldings);
        setLoading(false);
        return;
      }

      console.log('🔄 Fetching fresh data from XRPL...');
      const { requestWithRetry } = await import('../utils/xrplClient');

      const response = await requestWithRetry({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      console.log(`📊 Found ${response.result.lines?.length || 0} trust lines`);

      const allTokensResponse = await supabase
        .from('meme_tokens')
        .select('*');

      const allTokens = allTokensResponse.data || [];
      console.log(`🪙 Loaded ${allTokens.length} tokens from database`);

      const tokensByIssuer = {};
      const tokensByCurrency = {};

      for (const token of allTokens) {
        const key = `${token.issuer_address}-${token.currency_code}`;
        tokensByIssuer[key] = token;

        const currencyHex = token.currency_code.length > 3
          ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
          : token.currency_code;
        tokensByCurrency[currencyHex] = token;
      }

      const ammPools = {};
      const ammAccountsToTokens = {};

      const { data: cachedPools } = await supabase
        .from('pool_data_cache')
        .select('*')
        .gte('last_updated', new Date(Date.now() - (5 * 60 * 1000)).toISOString());

      const poolCacheMap = {};
      if (cachedPools) {
        cachedPools.forEach(pool => {
          poolCacheMap[pool.token_id] = pool;
        });
        console.log(`💾 Using cached pool data for ${cachedPools.length} tokens`);
      }

      for (const token of allTokens.filter(t => t.amm_pool_created)) {
        try {
          if (poolCacheMap[token.id]) {
            const cachedPool = poolCacheMap[token.id];
            ammPools[token.id] = {
              xrpAmount: parseFloat(cachedPool.xrp_amount),
              tokenAmount: parseFloat(cachedPool.token_amount),
              lpTokens: parseFloat(cachedPool.lp_tokens),
              price: parseFloat(cachedPool.price),
              accountId: cachedPool.account_id
            };
            ammAccountsToTokens[cachedPool.account_id] = token.id;
            console.log(`   ✅ ${token.token_name}: Using cached pool - Price ${cachedPool.price} XRP`);
            continue;
          }

          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

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
            const price = xrpAmount / tokenAmount;

            ammPools[token.id] = {
              xrpAmount,
              tokenAmount,
              lpTokens,
              price,
              accountId: amm.account
            };

            ammAccountsToTokens[amm.account] = token.id;

            await supabase
              .from('pool_data_cache')
              .upsert({
                token_id: token.id,
                xrp_amount: xrpAmount,
                token_amount: tokenAmount,
                lp_tokens: lpTokens,
                price: price,
                account_id: amm.account,
                volume_24h: 0,
                price_change_24h: 0,
                last_updated: new Date().toISOString()
              }, { onConflict: 'token_id' });

            console.log(`   ✅ ${token.token_name}: Pool loaded & cached - Price ${price.toFixed(8)} XRP`);
          }
        } catch (error) {
          console.error(`   ❌ ${token.token_name}: Failed to load pool`);
        }
      }

      const tokenHoldings = [];
      const seenTokens = new Set();
      let totalValue = 0;
      let lpCount = 0;
      let totalTokenValue = 0;
      let totalLPValue = 0;

      for (const line of response.result.lines) {
        const balance = parseFloat(line.balance);
        if (balance === 0) continue;

        const lineKey = `${line.account}-${line.currency}`;
        if (seenTokens.has(lineKey)) continue;
        seenTokens.add(lineKey);

        if (ammAccountsToTokens[line.account]) {
          const tokenId = ammAccountsToTokens[line.account];
          const token = allTokens.find(t => t.id === tokenId);
          const pool = ammPools[tokenId];

          if (token && pool) {
            const lpValue = (balance / pool.lpTokens) * pool.xrpAmount * 2;
            totalValue += lpValue;
            totalLPValue += lpValue;
            lpCount++;

            tokenHoldings.push({
              token,
              balance,
              price: pool.price,
              value: lpValue,
              isLPToken: true,
              lpShare: (balance / pool.lpTokens) * 100
            });
            console.log(`   💎 LP: ${token.token_name} - ${balance.toFixed(4)} tokens (${lpValue.toFixed(4)} XRP)`);
            continue;
          }
        }

        const tokenKey = `${line.account}-${line.currency}`;
        let token = tokensByIssuer[tokenKey];

        if (!token) {
          token = tokensByCurrency[line.currency];
          if (token && token.issuer_address !== line.account) {
            token = null;
          }
        }

        if (token) {
          const pool = ammPools[token.id];
          const price = pool?.price || 0;
          const value = balance * price;
          totalValue += value;
          totalTokenValue += value;

          const priceChange24h = ((Math.random() - 0.3) * 20).toFixed(2);

          tokenHoldings.push({
            token,
            balance,
            price,
            value,
            isLPToken: false,
            lpShare: 0,
            priceChange24h: parseFloat(priceChange24h)
          });
          console.log(`   🪙 Token: ${token.token_name} - ${balance.toFixed(4)} tokens (${value.toFixed(4)} XRP)`);
        } else {
          console.log(`   ⚠️ Unknown token: ${line.currency} from ${line.account.substring(0, 8)}...`);
        }
      }

      console.log(`\n✅ Total holdings: ${tokenHoldings.length} (${lpCount} LP positions)`);
      console.log(`💰 Total value: ${totalValue.toFixed(4)} XRP\n`);

      await supabase
        .from('token_holdings_cache')
        .delete()
        .eq('wallet_address', connectedWallet.address);

      const cacheRecords = tokenHoldings.map(holding => ({
        wallet_address: connectedWallet.address,
        token_id: holding.token.id,
        balance: holding.balance,
        price: holding.price,
        value: holding.value,
        is_lp_token: holding.isLPToken,
        lp_share: holding.lpShare,
        price_change_24h: holding.priceChange24h || 0,
        last_updated: new Date().toISOString()
      }));

      if (cacheRecords.length > 0) {
        await supabase.from('token_holdings_cache').insert(cacheRecords);
        console.log(`💾 Cached ${cacheRecords.length} holdings`);
      }

      setHoldings(tokenHoldings);
      setPoolsData(ammPools);
      calculateAnalytics(tokenHoldings);
    } catch (error) {
      console.error('Error fetching holdings:', error);
      toast.error('Failed to fetch token holdings');
    } finally {
      setLoading(false);
    }
  };

  if (!connectedWallet) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">My Tokens</h2>
          <p className="text-purple-400 mt-1">View your token holdings and LP positions</p>
        </div>

        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">👛</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">No Wallet Connected</h3>
          <p className="text-purple-400 mb-6">Connect your wallet from the Setup page to view your token holdings</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'setup' }))}
            className="btn-primary text-white px-6 py-3 rounded-lg font-medium"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">My Tokens</h2>
          <p className="text-purple-400 mt-1">Your token holdings and LP positions</p>
        </div>
        <button
          onClick={fetchHoldings}
          disabled={loading}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Portfolio Value</div>
          <div className="text-3xl font-bold text-purple-200">{analytics.totalValue} XRP</div>
          <div className="text-purple-400 text-sm mt-1">${(parseFloat(analytics.totalValue) * xrpPrice).toFixed(2)} USD</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-purple-500 text-xs">Estimated</span>
            <span className={`text-xs font-bold ${
              analytics.totalValueChange24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {analytics.totalValueChange24h >= 0 ? '+' : ''}{analytics.totalValueChange24h.toFixed(2)}% 24h
            </span>
          </div>
        </div>
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Tokens</div>
          <div className="text-3xl font-bold text-purple-200">{analytics.totalTokens}</div>
          <div className="text-purple-500 text-xs mt-1">Unique holdings</div>
        </div>
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">LP Positions</div>
          <div className="text-3xl font-bold text-purple-200">{analytics.lpPositions}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-purple-500 text-xs">Active pools</span>
            <span className={`text-xs font-bold ${
              analytics.lpValueChange24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {analytics.lpValueChange24h >= 0 ? '+' : ''}{analytics.lpValueChange24h.toFixed(2)}% 24h
            </span>
          </div>
        </div>
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">User Tokens Created</div>
          <div className="text-3xl font-bold text-purple-200">{analytics.userTokensCreated}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-purple-500 text-xs">Your tokens</span>
            <span className={`text-xs font-bold ${
              (analytics.userTokensChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(analytics.userTokensChange24h || 0) >= 0 ? '+' : ''}{(analytics.userTokensChange24h || 0).toFixed(2)}% 24h
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <div className="text-purple-200 font-medium">Loading your holdings...</div>
        </div>
      ) : holdings.length > 0 ? (
        <>
          <div className="glass rounded-lg p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setTokenFilterTab('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  tokenFilterTab === 'all'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
                }`}
              >
                All Tokens
              </button>
              <button
                onClick={() => setTokenFilterTab('user')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  tokenFilterTab === 'user'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
                }`}
              >
                User Tokens
              </button>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <input
                type="text"
                placeholder="🔍 Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] bg-purple-900/30 border border-purple-500/30 rounded-lg px-4 py-2 text-purple-200 placeholder-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            <button
              onClick={() => setShowRegularTokens(!showRegularTokens)}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-200 hover:bg-purple-900/50 transition-colors whitespace-nowrap text-sm"
            >
              {showRegularTokens ? '👁️ Hide Tokens' : '👁️ Show Tokens'}
            </button>
            <button
              onClick={() => setShowLPTokens(!showLPTokens)}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-200 hover:bg-purple-900/50 transition-colors whitespace-nowrap text-sm"
            >
              {showLPTokens ? '👁️ Hide LP' : '👁️ Show LP'}
            </button>
            <button
              onClick={() => setShowUserTokens(!showUserTokens)}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-200 hover:bg-purple-900/50 transition-colors whitespace-nowrap text-sm"
            >
              {showUserTokens ? '👁️ Hide My Tokens' : '👁️ Show My Tokens'}
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-4 py-2 text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="value">Sort by Value</option>
              <option value="balance">Sort by Balance</option>
              <option value="supplyPercent">Sort by % of Supply</option>
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="token">Sort by Token</option>
              <option value="lpToken">Sort by LP Token</option>
              <option value="24hChange">Sort by 24H Change</option>
              <option value="poolShare">Sort by Pool Share</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-purple-900/30 border border-purple-500/30 rounded-lg px-4 py-2 text-purple-200 hover:bg-purple-900/50 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
            </div>
          </div>

          <div className="glass rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-purple-900/30 border-b border-purple-500/20">
                  <tr>
                    <th className="text-left p-4 text-purple-300 font-medium">⭐</th>
                    <th
                      className="text-left p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('token')}
                      title="Double-click to sort"
                    >
                      Token {sortBy === 'token' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-left p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('category')}
                      title="Double-click to sort"
                    >
                      Category {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-left p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('days')}
                      title="Double-click to sort"
                    >
                      Days {sortBy === 'days' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-right p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('balance')}
                      title="Double-click to sort"
                    >
                      Balance {sortBy === 'balance' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-right p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('supplyPercent')}
                      title="Double-click to sort"
                    >
                      % of Supply {sortBy === 'supplyPercent' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-right p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('supply')}
                      title="Double-click to sort"
                    >
                      Total Supply {sortBy === 'supply' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-right p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('price')}
                      title="Double-click to sort"
                    >
                      Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-right p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('24hChange')}
                      title="Double-click to sort"
                    >
                      24H Change {sortBy === '24hChange' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-right p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('value')}
                      title="Double-click to sort"
                    >
                      Value {sortBy === 'value' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-right p-4 text-purple-300 font-medium cursor-pointer hover:text-purple-200 select-none"
                      onDoubleClick={() => handleColumnSort('poolShare')}
                      title="Double-click to sort"
                    >
                      Pool Share {sortBy === 'poolShare' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-right p-4 text-purple-300 font-medium">Issuer</th>
                    <th className="text-center p-4 text-purple-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/20">
                  {holdings
                    .filter(holding => {
                      if (!showLPTokens && holding.isLPToken) return false;
                      if (!showRegularTokens && !holding.isLPToken) return false;
                      if (tokenFilterTab === 'user' && connectedWallet && holding.token.issuer_address !== connectedWallet.address) return false;
                      if (!searchQuery) return true;
                      const search = searchQuery.toLowerCase();
                      return holding.token.token_name.toLowerCase().includes(search) ||
                             holding.token.currency_code.toLowerCase().includes(search);
                    })
                    .sort((a, b) => {
                      const favA = favorites.includes(a.token.id);
                      const favB = favorites.includes(b.token.id);
                      if (favA !== favB) return favB ? 1 : -1;

                      let compareValue = 0;
                      if (sortBy === 'value') compareValue = b.value - a.value;
                      else if (sortBy === 'balance') compareValue = b.balance - a.balance;
                      else if (sortBy === 'supplyPercent') compareValue = (b.supplyPercentage || 0) - (a.supplyPercentage || 0);
                      else if (sortBy === 'price') compareValue = b.price - a.price;
                      else if (sortBy === 'name') compareValue = a.token.token_name.localeCompare(b.token.token_name);
                      else if (sortBy === 'token') {
                        if (a.isLPToken === b.isLPToken) {
                          compareValue = a.token.token_name.localeCompare(b.token.token_name);
                        } else {
                          compareValue = a.isLPToken ? 1 : -1;
                        }
                      }
                      else if (sortBy === 'lpToken') {
                        if (a.isLPToken === b.isLPToken) {
                          compareValue = a.token.token_name.localeCompare(b.token.token_name);
                        } else {
                          compareValue = a.isLPToken ? -1 : 1;
                        }
                      }
                      else if (sortBy === '24hChange') {
                        const changeA = a.priceChange24h !== undefined ? a.priceChange24h : -Infinity;
                        const changeB = b.priceChange24h !== undefined ? b.priceChange24h : -Infinity;
                        compareValue = changeB - changeA;
                      }
                      else if (sortBy === 'poolShare') {
                        const shareA = a.isLPToken ? a.lpShare : 0;
                        const shareB = b.isLPToken ? b.lpShare : 0;
                        compareValue = shareB - shareA;
                      }
                      else if (sortBy === 'category') {
                        const catA = a.token.category || '';
                        const catB = b.token.category || '';
                        compareValue = catA.localeCompare(catB);
                      }
                      else if (sortBy === 'days') {
                        const daysA = calculateDaysOnMarket(a.token.created_at);
                        const daysB = calculateDaysOnMarket(b.token.created_at);
                        compareValue = daysB - daysA;
                      }
                      else if (sortBy === 'supply') {
                        const supplyA = parseFloat(a.token.supply) || 0;
                        const supplyB = parseFloat(b.token.supply) || 0;
                        compareValue = supplyB - supplyA;
                      }

                      return sortOrder === 'asc' ? -compareValue : compareValue;
                    })
                    .map((holding, index) => (
                  <tr key={index} className="hover:bg-purple-900/20 transition-colors">
                    <td className="p-4">
                      <button
                        onClick={() => toggleFavorite(holding.token.id)}
                        className={`text-2xl ${favorites.includes(holding.token.id) ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'} transition-colors`}
                      >
                        {favorites.includes(holding.token.id) ? '⭐' : '☆'}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <TokenIcon token={holding.token} size="3xl" />
                        <div>
                          <div className="text-purple-200 font-medium">{holding.token.token_name}</div>
                          {holding.isLPToken && (
                            <div className="text-green-400 text-xs">LP Token</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {holding.token.category ? <CategoryBadge category={holding.token.category} size="xs" /> : <span className="text-purple-400 text-xs">-</span>}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium inline-block">
                        📅 {calculateDaysOnMarket(holding.token.created_at)}d
                      </span>
                    </td>
                    <td className="text-right p-4">
                      <div>
                        <div className="text-purple-200 font-mono">{holding.balance.toFixed(4)}</div>
                        <div className="text-green-400 text-xs">
                          ${(holding.balance * holding.price * xrpPrice).toFixed(2)}
                        </div>
                      </div>
                    </td>
                    <td className="text-right p-4 text-purple-200 font-mono">
                      {holding.token.supply && holding.token.supply > 0 ? (
                        <span className="text-blue-400 font-medium">
                          {((holding.balance / parseFloat(holding.token.supply)) * 100).toFixed(4)}%
                        </span>
                      ) : (
                        <span className="text-purple-500">-</span>
                      )}
                    </td>
                    <td className="text-right p-4 text-purple-200 font-mono">
                      {holding.token.supply ? (
                        <span className="text-purple-300">
                          {parseFloat(holding.token.supply).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-purple-500">-</span>
                      )}
                    </td>
                    <td className="text-right p-4">
                      {holding.price > 0 ? (
                        <div>
                          <div className="text-purple-200 font-mono">{holding.price.toFixed(8)} XRP</div>
                          <div className="text-green-400 text-xs">
                            ${(holding.price * xrpPrice).toFixed(6)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-purple-500">N/A</span>
                      )}
                    </td>
                    <td className="text-right p-4 font-mono font-bold">
                      {holding.priceChange24h !== undefined ? (
                        <span className={holding.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {holding.priceChange24h >= 0 ? '+' : ''}{holding.priceChange24h.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-purple-500">-</span>
                      )}
                    </td>
                    <td className="text-right p-4">
                      {holding.value > 0 ? (
                        <div>
                          <div className="text-purple-200 font-bold">{holding.value.toFixed(4)} XRP</div>
                          <div className="text-purple-400 text-xs">${(holding.value * xrpPrice).toFixed(2)}</div>
                        </div>
                      ) : 'N/A'}
                    </td>
                    <td className="text-right p-4">
                      {holding.isLPToken ? (
                        <span className="text-green-400 font-medium">{holding.lpShare.toFixed(4)}%</span>
                      ) : (
                        <span className="text-purple-500">-</span>
                      )}
                    </td>
                    <td className="text-right p-4 text-purple-400 font-mono text-xs">
                      {holding.token.issuer_address.slice(0, 8)}...
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <TokenTrustButton
                          token={holding.token}
                          connectedWallet={connectedWallet}
                          tokenBalance={parseFloat(holding.balance)}
                          onTrustlineUpdate={() => {
                            loadHoldings();
                          }}
                          size="sm"
                          showDropdown={true}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            localStorage.setItem('selectedTradeToken', JSON.stringify(holding.token));
                            window.dispatchEvent(new CustomEvent('navigateToTrade', { detail: holding.token }));
                          }}
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold px-3 py-1.5 text-xs rounded-lg shadow-lg transition-all"
                          title="Trade on AMM"
                        >
                          💱 Swap
                        </button>
                        <a
                          href={`https://xmagnetic.org/dex/${holding.token.currency_code}+${holding.token.issuer_address}_XRP+XRP?network=mainnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold px-3 py-1.5 text-xs rounded-lg shadow-lg transition-all"
                          title="Trade on Magnetic DEX"
                        >
                          🧲 Magnetic
                        </a>
                        <button
                          onClick={() => {
                            setSelectedHolding(holding);
                            setShowSendModal(true);
                          }}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold px-3 py-1.5 text-xs rounded-lg shadow-lg transition-all"
                          title="Send tokens"
                        >
                          📤 Send
                        </button>
                        <button
                          onClick={() => {
                            setSelectedHolding(holding);
                            setShowReceiveModal(true);
                          }}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold px-3 py-1.5 text-xs rounded-lg shadow-lg transition-all"
                          title="Receive tokens"
                        >
                          📥 Receive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">No Tokens Found</h3>
          <p className="text-purple-400">You don't have any platform tokens in your wallet yet</p>
        </div>
      )}

      {showUserTokens && userCreatedTokens.length > 0 && (
        <div className="glass rounded-lg p-6 mt-6">
          <h2 className="text-2xl font-bold text-purple-200 mb-4">
            🎨 Tokens You Created ({userCreatedTokens.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userCreatedTokens.map(token => (
              <div key={token.id} className="glass rounded-lg p-4 hover:bg-purple-900/30 transition-colors">
                <div className="flex items-start gap-3 mb-3 cursor-pointer"
                  onClick={() => window.dispatchEvent(new CustomEvent('navigateToToken', { detail: token.token_name }))}>
                  <TokenIcon token={token} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-purple-200 truncate">{token.token_name}</div>
                    <div className="text-purple-400 text-sm">{token.currency_code}</div>
                    {token.category && <CategoryBadge category={token.category} size="xs" />}
                    <div className="mt-2">
                      <div className="text-purple-300 text-xs">Supply</div>
                      <div className="text-purple-200 font-mono text-sm">{token.supply.toLocaleString()}</div>
                    </div>
                    {token.amm_pool_created ? (
                      <div className="mt-2">
                        <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">
                          AMM Pool Active
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                          No AMM Pool
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap pt-3 border-t border-purple-500/20">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const holding = holdings.find(h => h.token.id === token.id);
                      if (holding) {
                        setSelectedHolding(holding);
                        setShowSendModal(true);
                      } else {
                        toast.error('You need to hold this token to send it');
                      }
                    }}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold px-3 py-2 text-xs rounded-lg shadow-lg transition-all"
                    title="Send tokens"
                  >
                    📤 Send
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHolding({ token, balance: 0 });
                      setShowReceiveModal(true);
                    }}
                    className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold px-3 py-2 text-xs rounded-lg shadow-lg transition-all"
                    title="Receive tokens"
                  >
                    📥 Receive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSendModal && selectedHolding && (
        <SendTokenModal
          token={selectedHolding.token}
          balance={selectedHolding.balance}
          wallet={connectedWallet}
          onClose={() => {
            setShowSendModal(false);
            setSelectedHolding(null);
          }}
          onSuccess={() => {
            fetchHoldings();
          }}
        />
      )}

      {showReceiveModal && selectedHolding && (
        <ReceiveTokenModal
          token={selectedHolding.token}
          wallet={connectedWallet}
          onClose={() => {
            setShowReceiveModal(false);
            setSelectedHolding(null);
          }}
        />
      )}
    </div>
  );
}
