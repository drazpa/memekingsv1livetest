import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import TokenIcon from '../components/TokenIcon';
import { TokenTrustButton } from '../components/TokenTrustButton';
import TradeHistory from '../components/TradeHistory';
import { XRPScanLink } from '../components/XRPScanLink';
import { PriceChart } from '../components/PriceChart';
import toast from 'react-hot-toast';
import * as xrpl from 'xrpl';

export default function TokenProfile({ tokenSlug }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [poolData, setPoolData] = useState(null);
  const [xrpUsdPrice, setXrpUsdPrice] = useState(2.50);
  const [lpBalance, setLpBalance] = useState(null);
  const [swapDropdownOpen, setSwapDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [chartData, setChartData] = useState([]);
  const [userBalance, setUserBalance] = useState(null);

  useEffect(() => {
    loadToken();
    loadConnectedWallet();
    fetchXrpUsdPrice();
  }, [tokenSlug]);

  useEffect(() => {
    if (token) {
      fetchPoolData();
      fetchUserBalance();
      generateMockChartData();
    }
  }, [token, connectedWallet]);

  const loadToken = async () => {
    try {
      setLoading(true);

      const cachedTokens = localStorage.getItem('cachedTokens');
      if (cachedTokens) {
        const tokens = JSON.parse(cachedTokens);
        const foundToken = tokens.find(t =>
          t.token_name?.toLowerCase() === tokenSlug?.toLowerCase()
        );

        if (foundToken) {
          setToken(foundToken);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .ilike('token_name', tokenSlug)
        .single();

      if (error) throw error;

      if (data) {
        setToken(data);
      } else {
        toast.error('Token not found');
      }
    } catch (error) {
      console.error('Error loading token:', error);
      toast.error('Failed to load token');
    } finally {
      setLoading(false);
    }
  };

  const loadConnectedWallet = () => {
    const walletData = localStorage.getItem('connectedWallet');
    if (walletData) {
      setConnectedWallet(JSON.parse(walletData));
    }
  };

  const fetchXrpUsdPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      setXrpUsdPrice(data.ripple?.usd || 2.50);
    } catch (error) {
      console.error('Error fetching XRP/USD price:', error);
    }
  };

  const fetchPoolData = async () => {
    if (!token || !token.amm_pool_created) return;

    try {
      const { data: cache } = await supabase
        .from('pool_data_cache')
        .select('*')
        .eq('token_id', token.id)
        .order('cached_at', { ascending: false })
        .limit(1)
        .single();

      if (cache && (Date.now() - new Date(cache.cached_at).getTime() < 30000)) {
        setPoolData({
          xrpAmount: parseFloat(cache.xrp_amount),
          tokenAmount: parseFloat(cache.token_amount),
          lpTokens: parseFloat(cache.lp_tokens),
          price: parseFloat(cache.price),
          volume24h: parseFloat(cache.volume_24h || 0),
          fees24h: parseFloat(cache.fees_24h || 0),
          apr: parseFloat(cache.apr || 0),
          contributors: parseInt(cache.contributors || 0)
        });

        if (connectedWallet) {
          fetchLPBalance(cache.lp_tokens);
        }
        return;
      }

      const client = new xrpl.Client('wss://xrplcluster.com');
      await client.connect();

      const ammInfo = await client.request({
        command: 'amm_info',
        asset: { currency: 'XRP' },
        asset2: {
          currency: token.currency_hex || token.currency_code,
          issuer: token.issuer_address
        }
      });

      if (ammInfo.result?.amm) {
        const amm = ammInfo.result.amm;
        const xrpAmount = parseFloat(amm.amount) / 1000000;
        const tokenAmount = parseFloat(amm.amount2.value);
        const lpTokens = parseFloat(amm.lp_token.value);
        const price = xrpAmount / tokenAmount;

        const volume24h = token.volume_24h ? parseFloat(token.volume_24h) : 0;
        const tradingFee = parseFloat(amm.trading_fee) / 1000 || 0;
        const fees24h = volume24h * (tradingFee / 100);
        const apr = xrpAmount > 0 ? ((fees24h * 365) / xrpAmount) * 100 : 0;

        const poolDataObj = {
          xrpAmount,
          tokenAmount,
          lpTokens,
          price,
          volume24h,
          fees24h,
          apr,
          contributors: 0
        };

        setPoolData(poolDataObj);

        await supabase.from('pool_data_cache').upsert({
          token_id: token.id,
          xrp_amount: xrpAmount,
          token_amount: tokenAmount,
          lp_tokens: lpTokens,
          price: price,
          volume_24h: volume24h,
          fees_24h: fees24h,
          apr: apr,
          contributors: 0,
          cached_at: new Date().toISOString()
        }, { onConflict: 'token_id' });

        if (connectedWallet) {
          fetchLPBalance(lpTokens);
        }
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching pool data:', error);
    }
  };

  const fetchLPBalance = async (totalLPTokens) => {
    if (!connectedWallet || !token) return;

    try {
      const { data: cache } = await supabase
        .from('lp_balance_cache')
        .select('*')
        .eq('token_id', token.id)
        .eq('user_address', connectedWallet.address)
        .order('cached_at', { ascending: false })
        .limit(1)
        .single();

      if (cache && (Date.now() - new Date(cache.cached_at).getTime() < 60000)) {
        setLpBalance({
          balance: parseFloat(cache.lp_balance),
          share: parseFloat(cache.share_percentage)
        });
        return;
      }

      const client = new xrpl.Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      const lpTokenCurrency = token.lp_token_currency || `03${token.currency_hex?.slice(2, 38)}`;

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const lines = response.result.lines || [];
      const lpLine = lines.find(line =>
        line.currency === lpTokenCurrency &&
        line.account === token.issuer_address
      );

      if (lpLine) {
        const balance = parseFloat(lpLine.balance);
        const share = (balance / totalLPTokens) * 100;

        setLpBalance({ balance, share });

        await supabase.from('lp_balance_cache').upsert({
          token_id: token.id,
          user_address: connectedWallet.address,
          lp_balance: balance,
          share_percentage: share,
          cached_at: new Date().toISOString()
        }, { onConflict: 'token_id,user_address' });
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching LP balance:', error);
    }
  };

  const calculatePrice = () => {
    if (!token) return '0.00000000';
    if (poolData) {
      return poolData.price.toFixed(8);
    }
    if (token.amm_xrp_amount && token.amm_token_amount) {
      return (token.amm_xrp_amount / token.amm_token_amount).toFixed(8);
    }
    return '0.00000000';
  };

  const calculateMarketCap = () => {
    if (!token) return '0';
    const price = parseFloat(calculatePrice());
    return (price * token.supply).toFixed(2);
  };

  const calculate24hChange = () => {
    if (!token || !token.initial_xrp_amount || !token.initial_token_amount) return '0.00';
    if (!poolData) return '0.00';

    const initialPrice = token.initial_xrp_amount / token.initial_token_amount;
    const currentPrice = poolData.price;
    const change = ((currentPrice - initialPrice) / initialPrice) * 100;

    return change.toFixed(2);
  };

  const fetchUserBalance = async () => {
    if (!connectedWallet || !token) return;

    try {
      const client = new xrpl.Client(
        connectedWallet.network === 'mainnet'
          ? 'wss://xrplcluster.com'
          : 'wss://s.altnet.rippletest.net:51233'
      );

      await client.connect();

      const response = await client.request({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const lines = response.result.lines || [];
      const tokenLine = lines.find(line =>
        line.account === token.issuer_address &&
        (line.currency === token.currency_hex || line.currency === token.currency_code)
      );

      if (tokenLine) {
        const balance = parseFloat(tokenLine.balance);
        setUserBalance(balance);
      } else {
        setUserBalance(0);
      }

      await client.disconnect();
    } catch (error) {
      console.error('Error fetching user balance:', error);
      setUserBalance(0);
    }
  };

  const generateMockChartData = () => {
    if (!token) return;

    const basePrice = parseFloat(calculatePrice()) || 0.00000001;
    const now = Math.floor(Date.now() / 1000);
    const data = [];

    for (let i = 30; i >= 0; i--) {
      const time = now - (i * 3600);
      const variance = (Math.random() - 0.5) * 0.2;
      const price = Math.max(basePrice * (1 + variance), 0.00000001);
      data.push({
        time,
        value: price
      });
    }

    setChartData(data);
  };

  const tweetToken = () => {
    const price = calculatePrice();
    const tokenUrl = `https://drazpa-memekingz-a1bo.bolt.host/token/${token.token_name}`;
    const text = `Check out $${token.currency_code} on #XRP Ledger!\n\n💰 Price: ${price} XRP\n📊 Market Cap: ${calculateMarketCap()} XRP\n\n#${token.currency_code} #XRPL #Crypto\n\n${tokenUrl}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const copyProfileLink = () => {
    const tokenUrl = `https://drazpa-memekingz-a1bo.bolt.host/token/${token.token_name}`;
    navigator.clipboard.writeText(tokenUrl).then(() => {
      toast.success('Link copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-purple-300">Loading token...</div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-purple-200 mb-2">Token Not Found</h1>
          <p className="text-purple-400 mb-6">The token you're looking for doesn't exist.</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'dashboard' }))}
            className="btn-primary px-6 py-3 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex items-start gap-4">
            <TokenIcon token={token} size="4xl" className="!w-48 !h-48 !text-8xl" />
            <div>
              <h1 className="text-4xl font-bold text-purple-200 mb-2">{token.token_name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-purple-400 text-lg font-mono">{token.currency_code}</span>
                <XRPScanLink
                  type="address"
                  value={token.issuer_address}
                  network="mainnet"
                />
                {token.amm_pool_created && (
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                    AMM Pool Active
                  </span>
                )}
              </div>
              {token.description && (
                <p className="text-purple-300 mt-3 max-w-2xl">{token.description}</p>
              )}
            </div>
          </div>

          <div className="lg:ml-auto flex flex-col gap-3">
            <div className="glass rounded-lg p-4 text-center min-w-[200px]">
              <div className="text-purple-400 text-sm mb-1">Live Price</div>
              <div className="text-2xl font-bold text-purple-200 font-mono">{calculatePrice()} XRP</div>
              <div className="text-green-400 text-sm">${(parseFloat(calculatePrice()) * xrpUsdPrice).toFixed(6)}</div>
              {token.amm_pool_created && (
                <div className={`text-sm font-bold mt-2 ${
                  parseFloat(calculate24hChange()) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {parseFloat(calculate24hChange()) >= 0 ? '+' : ''}{calculate24hChange()}% 24h
                </div>
              )}
            </div>

            {connectedWallet && userBalance !== null && (
              <div className="glass rounded-lg p-4 text-center min-w-[200px] bg-purple-500/10 border border-purple-500/30">
                <div className="text-purple-400 text-sm mb-1">Your Holdings</div>
                <div className="text-xl font-bold text-purple-200">{userBalance.toFixed(4)}</div>
                <div className="text-purple-400 text-xs">{token.currency_code}</div>
                <div className="text-green-400 text-sm mt-1">
                  {(userBalance * parseFloat(calculatePrice())).toFixed(4)} XRP
                </div>
                <div className="text-green-400 text-xs">
                  ${(userBalance * parseFloat(calculatePrice()) * xrpUsdPrice).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Market Cap</div>
          <div className="text-2xl font-bold text-purple-200">{calculateMarketCap()} XRP</div>
          <div className="text-green-400 text-sm">${(parseFloat(calculateMarketCap()) * xrpUsdPrice).toFixed(2)}</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">Total Supply</div>
          <div className="text-2xl font-bold text-purple-200">{token.supply.toLocaleString()}</div>
          <div className="text-purple-400 text-sm">{token.currency_code}</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-purple-400 text-sm mb-2">24h Volume</div>
          <div className="text-2xl font-bold text-purple-200">
            {poolData ? `${poolData.volume24h.toFixed(2)} XRP` : '0 XRP'}
          </div>
          <div className="text-green-400 text-sm">
            ${poolData ? ((poolData.volume24h || 0) * xrpUsdPrice).toFixed(2) : '0.00'}
          </div>
        </div>
      </div>

      {poolData && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">XRP Liquidity</div>
            <div className="text-xl font-bold text-purple-200">{poolData.xrpAmount.toFixed(2)} XRP</div>
            <div className="text-green-400 text-sm">${(poolData.xrpAmount * xrpUsdPrice).toFixed(2)}</div>
          </div>

          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">Token Liquidity</div>
            <div className="text-xl font-bold text-purple-200">{poolData.tokenAmount.toFixed(2)}</div>
            <div className="text-purple-400 text-sm">{token.currency_code}</div>
          </div>

          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">LP Tokens</div>
            <div className="text-xl font-bold text-purple-200">{(poolData.lpTokens / 1000).toFixed(2)}K</div>
          </div>

          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">APR (1 year)</div>
            <div className="text-xl font-bold text-green-400">{poolData.apr.toFixed(2)}%</div>
          </div>
        </div>
      )}

      {lpBalance && poolData && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-green-300 text-lg font-medium mb-2">Your LP Position</div>
              <div className="text-green-200">
                {lpBalance.balance.toFixed(4)} LP Tokens ({lpBalance.share.toFixed(4)}% of pool)
              </div>
            </div>
            <div className="text-right">
              <div className="text-green-200 font-bold text-xl">
                ~{(poolData.xrpAmount * lpBalance.share / 100).toFixed(4)} XRP
              </div>
              <div className="text-green-400">
                ${((poolData.xrpAmount * lpBalance.share / 100) * xrpUsdPrice).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-6 flex-wrap">
        <TokenTrustButton
          token={token}
          connectedWallet={connectedWallet}
          tokenBalance={0}
          onTrustlineUpdate={() => {}}
          size="lg"
          showDropdown={true}
        />

        <div className="relative swap-dropdown">
          <button
            onClick={() => setSwapDropdownOpen(!swapDropdownOpen)}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold px-6 py-3 rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2"
          >
            <span>💱 Swap</span>
            <svg className={`w-4 h-4 transition-transform ${swapDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {swapDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 glass bg-gradient-to-br from-purple-900/95 to-purple-800/95 border border-purple-500/30 rounded-lg shadow-xl z-50">
              <button
                onClick={() => {
                  localStorage.setItem('selectedTradeToken', JSON.stringify(token));
                  window.dispatchEvent(new CustomEvent('navigateToTrade', { detail: token }));
                }}
                className="w-full px-4 py-3 text-left hover:bg-purple-600/30 transition-colors flex items-center gap-3"
              >
                <div className="text-purple-100 font-medium">Trade on MEMEKINGS</div>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'dashboard' }))}
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold px-6 py-3 rounded-lg shadow-lg transition-all duration-300"
        >
          ← Back
        </button>

        <button
          onClick={copyProfileLink}
          className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-bold px-6 py-3 rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share Link
        </button>

        <button
          onClick={tweetToken}
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold px-6 py-3 rounded-lg shadow-lg transition-all duration-300"
        >
          𝕏 Share on X
        </button>
      </div>

      <div className="glass rounded-xl overflow-hidden mb-6">
        <div className="flex border-b border-purple-500/30 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'text-purple-200 border-b-2 border-purple-500 bg-purple-500/10'
                : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'chart'
                ? 'text-purple-200 border-b-2 border-purple-500 bg-purple-500/10'
                : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'text-purple-200 border-b-2 border-purple-500 bg-purple-500/10'
                : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'trades'
                ? 'text-purple-200 border-b-2 border-purple-500 bg-purple-500/10'
                : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            Trade History
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-purple-400 text-sm mb-1">Issuer Address</div>
                  <div className="font-mono text-sm text-purple-200 break-all">{token.issuer_address}</div>
                </div>
                <div>
                  <div className="text-purple-400 text-sm mb-1">Currency Code</div>
                  <div className="font-mono text-sm text-purple-200">{token.currency_code}</div>
                </div>
                <div>
                  <div className="text-purple-400 text-sm mb-1">Currency Hex</div>
                  <div className="font-mono text-sm text-purple-200 break-all">{token.currency_hex || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-purple-400 text-sm mb-1">Created</div>
                  <div className="text-sm text-purple-200">
                    {new Date(token.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chart' && token.amm_pool_created && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass rounded-lg p-3 border border-green-500/30">
                  <div className="text-green-400 text-xs mb-1">Current Price</div>
                  <div className="text-xl font-bold text-green-200">{calculatePrice()} XRP</div>
                  <div className="text-green-400 text-xs">${(parseFloat(calculatePrice()) * xrpUsdPrice).toFixed(6)}</div>
                </div>
                <div className="glass rounded-lg p-3 border border-blue-500/30">
                  <div className="text-blue-400 text-xs mb-1">24h Change</div>
                  <div className={`text-xl font-bold ${
                    parseFloat(calculate24hChange()) >= 0 ? 'text-green-200' : 'text-red-200'
                  }`}>
                    {parseFloat(calculate24hChange()) >= 0 ? '+' : ''}{calculate24hChange()}%
                  </div>
                  <div className="text-blue-400 text-xs">Price movement</div>
                </div>
                <div className="glass rounded-lg p-3 border border-purple-500/30">
                  <div className="text-purple-400 text-xs mb-1">XRP Liquidity</div>
                  <div className="text-xl font-bold text-purple-200">{poolData?.amm_xrp_amount?.toFixed(2) || '0.00'}</div>
                  <div className="text-purple-400 text-xs">In AMM pool</div>
                </div>
                <div className="glass rounded-lg p-3 border border-cyan-500/30">
                  <div className="text-cyan-400 text-xs mb-1">Token Liquidity</div>
                  <div className="text-xl font-bold text-cyan-200">{poolData?.amm_asset_amount?.toLocaleString() || '0'}</div>
                  <div className="text-cyan-400 text-xs">{token.currency_code}</div>
                </div>
              </div>
              <div className="h-[600px] glass rounded-lg p-4">
                <PriceChart data={chartData} />
              </div>
            </div>
          )}

          {activeTab === 'chart' && !token.amm_pool_created && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <div className="text-purple-300">Chart will be available once AMM pool is created</div>
              <div className="text-purple-400 text-sm mt-2">Historical price data requires an active trading pool</div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-sm mb-2">💰 Market Cap</div>
                  <div className="text-2xl font-bold text-purple-200">{calculateMarketCap()} XRP</div>
                  <div className="text-green-400 text-sm">${(parseFloat(calculateMarketCap()) * xrpUsdPrice).toFixed(2)}</div>
                </div>

                <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-sm mb-2">📊 Total Supply</div>
                  <div className="text-2xl font-bold text-purple-200">{token.supply.toLocaleString()}</div>
                  <div className="text-purple-400 text-sm">{token.currency_code}</div>
                </div>

                <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-sm mb-2">💹 Current Price</div>
                  <div className="text-2xl font-bold text-purple-200">{calculatePrice()} XRP</div>
                  <div className="text-green-400 text-sm">${(parseFloat(calculatePrice()) * xrpUsdPrice).toFixed(6)}</div>
                </div>

                {poolData && (
                  <>
                    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                      <div className="text-purple-400 text-sm mb-2">💧 Total Liquidity</div>
                      <div className="text-2xl font-bold text-purple-200">{poolData.xrpAmount.toFixed(2)} XRP</div>
                      <div className="text-green-400 text-sm">${(poolData.xrpAmount * xrpUsdPrice).toFixed(2)}</div>
                    </div>

                    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                      <div className="text-purple-400 text-sm mb-2">📈 24h Volume</div>
                      <div className="text-2xl font-bold text-purple-200">{poolData.volume24h.toFixed(2)} XRP</div>
                      <div className="text-green-400 text-sm">${(poolData.volume24h * xrpUsdPrice).toFixed(2)}</div>
                    </div>

                    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                      <div className="text-purple-400 text-sm mb-2">💎 APR (Annual)</div>
                      <div className="text-2xl font-bold text-green-400">{poolData.apr.toFixed(2)}%</div>
                      <div className="text-purple-400 text-sm">Estimated returns</div>
                    </div>

                    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                      <div className="text-purple-400 text-sm mb-2">🔄 24h Change</div>
                      <div className={`text-2xl font-bold ${
                        parseFloat(calculate24hChange()) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {parseFloat(calculate24hChange()) >= 0 ? '+' : ''}{calculate24hChange()}%
                      </div>
                      <div className="text-purple-400 text-sm">Price movement</div>
                    </div>

                    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                      <div className="text-purple-400 text-sm mb-2">💵 24h Fees</div>
                      <div className="text-2xl font-bold text-purple-200">{poolData.fees24h.toFixed(4)} XRP</div>
                      <div className="text-green-400 text-sm">${(poolData.fees24h * xrpUsdPrice).toFixed(2)}</div>
                    </div>

                    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                      <div className="text-purple-400 text-sm mb-2">🎯 LP Tokens</div>
                      <div className="text-2xl font-bold text-purple-200">{(poolData.lpTokens / 1000).toFixed(2)}K</div>
                      <div className="text-purple-400 text-sm">Outstanding</div>
                    </div>
                  </>
                )}

                <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-sm mb-2">📅 Token Age</div>
                  <div className="text-2xl font-bold text-purple-200">
                    {Math.floor((Date.now() - new Date(token.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                  </div>
                  <div className="text-purple-400 text-sm">Since creation</div>
                </div>

                <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-sm mb-2">🏷️ Category</div>
                  <div className="text-2xl font-bold text-purple-200">{token.category || 'Meme'}</div>
                  <div className="text-purple-400 text-sm">Token type</div>
                </div>

                <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-sm mb-2">✅ Pool Status</div>
                  <div className="text-2xl font-bold text-purple-200">
                    {token.amm_pool_created ? '🟢 Active' : '🔴 Inactive'}
                  </div>
                  <div className="text-purple-400 text-sm">AMM Pool</div>
                </div>
              </div>

              {lpBalance && poolData && (
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-green-300 mb-4">Your Position Analytics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="text-green-400 text-sm mb-1">LP Tokens Owned</div>
                      <div className="text-2xl font-bold text-green-200">{lpBalance.balance.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-green-400 text-sm mb-1">Pool Share</div>
                      <div className="text-2xl font-bold text-green-200">{lpBalance.share.toFixed(4)}%</div>
                    </div>
                    <div>
                      <div className="text-green-400 text-sm mb-1">XRP Value</div>
                      <div className="text-2xl font-bold text-green-200">{(poolData.xrpAmount * lpBalance.share / 100).toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-green-400 text-sm mb-1">USD Value</div>
                      <div className="text-2xl font-bold text-green-200">${((poolData.xrpAmount * lpBalance.share / 100) * xrpUsdPrice).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'trades' && (
            <div>
              {!connectedWallet ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔒</div>
                  <div className="text-purple-300 mb-2">Connect wallet to view your trades</div>
                  <div className="text-purple-400 text-sm">Your personal trade history will appear here</div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold text-purple-200 mb-4">My Trades</h3>
                  <TradeHistory tokenId={token.id} connectedWallet={connectedWallet} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
