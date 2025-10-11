import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import toast from 'react-hot-toast';
import { Buffer } from 'buffer';
import TokenIcon from '../components/TokenIcon';
import BotTradeHistoryModal from '../components/BotTradeHistoryModal';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';
import {
  sanitizeXRP,
  sanitizeToken,
  formatXRP,
  formatToken,
  getRandomAmount
} from '../utils/tradeHelpers';

const BOT_CREATION_FEE = 5;
const BOT_FEE_RECEIVER = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';
const MIN_XRP_AMOUNT = 0.1;
const MAX_XRP_AMOUNT = 100;

const BOT_STRATEGIES = {
  ACCUMULATE: 'accumulate',
  DISTRIBUTE: 'distribute',
  BALANCED: 'balanced'
};

export default function BotTrader() {
  const [tokens, setTokens] = useState([]);
  const [poolsData, setPoolsData] = useState({});
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [bots, setBots] = useState([]);
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [showEditBot, setShowEditBot] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [selectedBot, setSelectedBot] = useState(null);
  const [nextTradeTimes, setNextTradeTimes] = useState({});
  const [nextTradeActions, setNextTradeActions] = useState({});
  const [botAnnouncements, setBotAnnouncements] = useState({});
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteTokens, setFavoriteTokens] = useState([]);
  const [botViewMode, setBotViewMode] = useState('grid');
  const [botSearchQuery, setBotSearchQuery] = useState('');
  const [favoriteBots, setFavoriteBots] = useState([]);
  const [botSortBy, setBotSortBy] = useState('name');
  const [newBot, setNewBot] = useState({
    name: '',
    tokenId: '',
    strategy: BOT_STRATEGIES.BALANCED,
    interval: 15,
    minAmount: 0.5,
    maxAmount: 2,
    slippage: 10,
    buyProbability: 50
  });
  const [loading, setLoading] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState({
    show: false,
    message: ''
  });
  const [tokenBalances, setTokenBalances] = useState({});
  const botIntervals = useRef({});
  const fetchingPools = useRef(new Set());

  useEffect(() => {
    loadTokens();
    loadConnectedWallet();
    loadFavorites();
  }, []);


  useEffect(() => {
    if (tokens.length > 0) {
      fetchAllPoolsData();

      const poolRefreshInterval = setInterval(() => {
        fetchAllPoolsData();
      }, 30000);

      return () => clearInterval(poolRefreshInterval);
    }
  }, [tokens]);

  useEffect(() => {
    let isMounted = true;

    if (connectedWallet) {
      loadBots();
      loadFavorites();
      loadBotFavorites();
      fetchTokenBalances();

      const interval = setInterval(() => {
        if (isMounted) {
          refreshBotsFromDatabase();
          fetchTokenBalances();
        }
      }, 5000);

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [connectedWallet]);

  useEffect(() => {
    if (connectedWallet && tokens.length > 0) {
      fetchTokenBalances();
    }
  }, [tokens, connectedWallet]);

  useEffect(() => {
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

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    }
  };

  const loadFavorites = async () => {
    if (!connectedWallet) return;
    try {
      const { data, error } = await supabase
        .from('token_favorites')
        .select('token_id')
        .eq('wallet_address', connectedWallet.address);
      if (error) throw error;
      setFavoriteTokens(data?.map(f => f.token_id) || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadBotFavorites = () => {
    if (!connectedWallet) return;
    try {
      const stored = localStorage.getItem(`bot_favorites_${connectedWallet.address}`);
      if (stored) {
        setFavoriteBots(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading bot favorites:', error);
    }
  };

  const toggleBotFavorite = (botId) => {
    if (!connectedWallet) return;

    const isFavorite = favoriteBots.includes(botId);
    const newFavorites = isFavorite
      ? favoriteBots.filter(id => id !== botId)
      : [...favoriteBots, botId];

    setFavoriteBots(newFavorites);
    localStorage.setItem(`bot_favorites_${connectedWallet.address}`, JSON.stringify(newFavorites));
    toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
  };

  const toggleFavorite = async (tokenId) => {
    if (!connectedWallet) return;

    const isFavorite = favoriteTokens.includes(tokenId);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('token_favorites')
          .delete()
          .eq('wallet_address', connectedWallet.address)
          .eq('token_id', tokenId);
        if (error) throw error;
        setFavoriteTokens(prev => prev.filter(id => id !== tokenId));
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('token_favorites')
          .insert({
            wallet_address: connectedWallet.address,
            token_id: tokenId
          });
        if (error) throw error;
        setFavoriteTokens(prev => [...prev, tokenId]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const loadTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .order('created_at', { ascending: false});
      if (error) throw error;
      setTokens(data || []);

      const cachedPools = {};
      (data || []).forEach(token => {
        if (token.current_price && token.current_price > 0) {
          cachedPools[token.id] = {
            amm_xrp_amount: token.amm_xrp_amount || 0,
            amm_asset_amount: token.amm_asset_amount || 0,
            price: token.current_price
          };
        }
      });
      if (Object.keys(cachedPools).length > 0) {
        setPoolsData(cachedPools);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const fetchTokenBalances = async () => {
    if (!connectedWallet || tokens.length === 0) return;

    try {
      console.log('🔍 Fetching token balances for wallet:', connectedWallet.address);

      const { requestWithRetry } = await import('../utils/xrplClient');

      const accountLines = await requestWithRetry({
        command: 'account_lines',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      console.log('📊 Account has', accountLines.result.lines.length, 'trustlines');
      console.log('🎯 Looking up balances for', tokens.length, 'tokens');

      const balances = {};
      tokens.forEach(token => {
        const currencyHex = token.currency_code.length > 3
          ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
          : token.currency_code;

        console.log(`\n🔎 Searching for ${token.token_name}:`);
        console.log(`   Currency Code: ${token.currency_code}`);
        console.log(`   Currency Hex: ${currencyHex}`);
        console.log(`   Issuer: ${token.issuer_address}`);

        const tokenLine = accountLines.result.lines.find(line => {
          console.log(`   Checking line: ${line.currency} from ${line.account}`);

          if (line.account !== token.issuer_address) {
            console.log(`   ❌ Issuer mismatch`);
            return false;
          }

          const lineCurrency = line.currency;

          if (token.currency_code.length <= 3) {
            const match = lineCurrency === token.currency_code;
            console.log(`   Standard code check: ${match}`);
            return match;
          }

          if (lineCurrency.length === 40) {
            const match = lineCurrency === currencyHex;
            console.log(`   Hex code check: ${match}`);
            return match;
          }

          const match = lineCurrency === token.currency_code;
          console.log(`   Direct match check: ${match}`);
          return match;
        });

        balances[token.id] = tokenLine ? parseFloat(tokenLine.balance) : 0;

        if (tokenLine) {
          console.log(`   ✅ FOUND Balance: ${tokenLine.balance}`);
        } else {
          console.log(`   ❌ NO BALANCE FOUND`);
        }
      });

      console.log('\n💰 Final balances object:', balances);
      setTokenBalances(balances);
    } catch (error) {
      console.error('❌ Error fetching token balances:', error);
    }
  };

  const fetchAllPoolsData = async (forceRefresh = false) => {
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
            amm_xrp_amount: parseFloat(cache.xrp_amount),
            amm_asset_amount: parseFloat(cache.token_amount),
            price: parseFloat(cache.price)
          };
        });

        setPoolsData(poolData);
        return;
      }

      const tokensToFetch = tokens.filter(token =>
        !poolsData[token.id] && !fetchingPools.current.has(token.id)
      );

      if (tokensToFetch.length === 0) return;

      tokensToFetch.forEach(token => fetchingPools.current.add(token.id));

      console.log('🔄 Fetching fresh pool data from XRPL...');
      const { requestWithRetry } = await import('../utils/xrplClient');

      const poolPromises = tokensToFetch.map(async (token) => {
        try {
          const currencyHex = token.currency_code.length > 3
            ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
            : token.currency_code;

          const ammInfo = await requestWithRetry({
            command: 'amm_info',
            asset: { currency: 'XRP' },
            asset2: { currency: currencyHex, issuer: token.issuer_address },
            ledger_index: 'validated'
          });

          if (ammInfo?.result?.amm) {
            const amm = ammInfo.result.amm;
            const amm_xrp_amount = parseFloat(amm.amount) / 1000000;
            const amm_asset_amount = parseFloat(amm.amount2.value);
            const price = amm_xrp_amount / amm_asset_amount;

            return {
              tokenId: token.id,
              poolData: { amm_xrp_amount, amm_asset_amount, price }
            };
          }
          return { tokenId: token.id, poolData: null };
        } catch (error) {
          console.error(`Error fetching pool data for ${token.token_name}:`, error);
          return { tokenId: token.id, poolData: null };
        } finally {
          fetchingPools.current.delete(token.id);
        }
      });

      const results = await Promise.all(poolPromises);

      const cacheRecords = results
        .filter(({ poolData }) => poolData !== null)
        .map(({ tokenId, poolData }) => ({
          token_id: tokenId,
          xrp_amount: poolData.amm_xrp_amount,
          token_amount: poolData.amm_asset_amount,
          lp_tokens: 0,
          price: poolData.price,
          account_id: '',
          volume_24h: 0,
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

      setPoolsData(prev => {
        const updated = { ...prev };
        results.forEach(({ tokenId, poolData }) => {
          if (poolData) {
            updated[tokenId] = poolData;
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error in fetchAllPoolsData:', error);
      tokens.forEach(token => fetchingPools.current.delete(token.id));
    }
  };

  const fetchPoolData = async (token) => {
    try {
      const { data: cachedPool } = await supabase
        .from('pool_data_cache')
        .select('*')
        .eq('token_id', token.id)
        .gte('last_updated', new Date(Date.now() - 30000).toISOString())
        .maybeSingle();

      if (cachedPool) {
        return {
          amm_xrp_amount: parseFloat(cachedPool.xrp_amount),
          amm_asset_amount: parseFloat(cachedPool.token_amount),
          price: parseFloat(cachedPool.price)
        };
      }

      const { requestWithRetry } = await import('../utils/xrplClient');

      const currencyHex = token.currency_code.length > 3
        ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : token.currency_code;

      const ammInfo = await requestWithRetry({
        command: 'amm_info',
        asset: { currency: 'XRP' },
        asset2: { currency: currencyHex, issuer: token.issuer_address },
        ledger_index: 'validated'
      });

      if (ammInfo?.result?.amm) {
        const amm = ammInfo.result.amm;
        const amm_xrp_amount = parseFloat(amm.amount) / 1000000;
        const amm_asset_amount = parseFloat(amm.amount2.value);
        const price = amm_xrp_amount / amm_asset_amount;

        await supabase
          .from('pool_data_cache')
          .upsert({
            token_id: token.id,
            xrp_amount: amm_xrp_amount,
            token_amount: amm_asset_amount,
            lp_tokens: parseFloat(amm.lp_token?.value || 0),
            price: price,
            account_id: amm.account,
            volume_24h: 0,
            price_change_24h: 0,
            last_updated: new Date().toISOString()
          }, { onConflict: 'token_id' });

        return {
          amm_xrp_amount,
          amm_asset_amount,
          price
        };
      }
    } catch (error) {
      console.error(`Error fetching pool for ${token.token_name}:`, error);
    }
    return null;
  };

  const refreshBotsFromDatabase = async () => {
    if (!connectedWallet) return;
    try {
      const { data, error } = await supabase
        .from('trading_bots')
        .select('*')
        .eq('wallet_address', connectedWallet.address)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error refreshing bots:', error);
        return;
      }

      setBots(prev => {
        let hasChanges = false;

        if (prev.length !== (data || []).length) {
          hasChanges = true;
        }

        const updated = (data || []).map(newBot => {
          const existing = prev.find(b => b.id === newBot.id);

          if (newBot.next_trade_time && newBot.next_action) {
            setNextTradeTimes(prevTimes => ({ ...prevTimes, [newBot.id]: new Date(newBot.next_trade_time).getTime() }));
            setNextTradeActions(prevActions => ({
              ...prevActions,
              [newBot.id]: {
                action: newBot.next_action,
                tokenAmount: newBot.next_token_amount,
                xrpAmount: newBot.next_xrp_amount,
                estimatedPrice: newBot.next_price
              }
            }));
          }

          if (existing) {
            if (
              existing.status !== newBot.status ||
              existing.total_trades !== newBot.total_trades ||
              existing.successful_trades !== newBot.successful_trades ||
              existing.net_profit !== newBot.net_profit ||
              existing.total_xrp_received !== newBot.total_xrp_received ||
              existing.total_xrp_spent !== newBot.total_xrp_spent ||
              existing.updated_at !== newBot.updated_at
            ) {
              hasChanges = true;
            }
            return { ...newBot, _localStatus: existing._localStatus };
          }
          hasChanges = true;
          return newBot;
        });

        return hasChanges ? updated : prev;
      });
    } catch (error) {
      console.error('Error refreshing bots:', error);
    }
  };

  const loadBots = async () => {
    if (!connectedWallet) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('trading_bots')
        .select('*')
        .eq('wallet_address', connectedWallet.address)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBots(data || []);

      if (data && data.length > 0 && tokens.length > 0) {
        const botTokenIds = [...new Set(data.map(bot => bot.token_id))];
        const botTokens = tokens.filter(token => botTokenIds.includes(token.id));
        for (const token of botTokens) {
          if (!poolsData[token.id] && !fetchingPools.current.has(token.id)) {
            fetchingPools.current.add(token.id);
            fetchPoolData(token).then(poolData => {
              if (poolData) {
                setPoolsData(prev => ({ ...prev, [token.id]: poolData }));
              }
            }).finally(() => {
              fetchingPools.current.delete(token.id);
            });
          }
        }
      }

      const runningBotIds = JSON.parse(localStorage.getItem('runningBots') || '[]');
      data?.forEach(bot => {
        if (bot.next_trade_time && bot.next_action) {
          setNextTradeTimes(prev => ({ ...prev, [bot.id]: new Date(bot.next_trade_time).getTime() }));
          setNextTradeActions(prev => ({
            ...prev,
            [bot.id]: {
              action: bot.next_action,
              tokenAmount: bot.next_token_amount,
              xrpAmount: bot.next_xrp_amount,
              estimatedPrice: bot.next_price
            }
          }));
        }

        if (runningBotIds.includes(bot.id)) {
          const token = tokens.find(t => t.id === bot.token_id);
          if (token && poolsData[token.id]) {
            startBot(bot);
          }
        }
      });
    } catch (error) {
      console.error('Error loading bots:', error);
      toast.error('Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  const createBot = async () => {
    if (!newBot.name || !newBot.tokenId) {
      toast.error('Bot name and token are required');
      return;
    }

    if (!connectedWallet) {
      toast.error('Connect wallet to create trading bots');
      return;
    }

    if (newBot.interval < 1) {
      toast.error('Minimum interval is 1 minute');
      return;
    }

    if (newBot.minAmount < MIN_XRP_AMOUNT || newBot.maxAmount > MAX_XRP_AMOUNT) {
      toast.error(`XRP amounts must be between ${MIN_XRP_AMOUNT} and ${MAX_XRP_AMOUNT}`);
      return;
    }

    if (newBot.minAmount >= newBot.maxAmount) {
      toast.error('Min amount must be less than max amount');
      return;
    }

    let client = null;
    const isReceiverWallet = connectedWallet.address === BOT_FEE_RECEIVER;

    try {
      setLoading(true);

      if (isReceiverWallet) {
        setPaymentProgress({
          show: true,
          message: 'Receiver wallet detected - Creating bot for free...'
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setPaymentProgress({
          show: true,
          message: `Processing ${BOT_CREATION_FEE} XRP bot creation fee...`
        });

        try {
          const { getClient } = await import('../utils/xrplClient');
          client = await getClient();

          const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);

          const payment = {
            TransactionType: 'Payment',
            Account: connectedWallet.address,
            Destination: BOT_FEE_RECEIVER,
            Amount: xrpl.xrpToDrops(BOT_CREATION_FEE.toString()),
            Memos: [{
              Memo: {
                MemoData: Buffer.from(`Bot Creation Fee: ${newBot.name}`, 'utf8').toString('hex').toUpperCase()
              }
            }]
          };

          const prepared = await client.autofill(payment);
          const signed = wallet.sign(prepared);
          const result = await client.submitAndWait(signed.tx_blob);

          if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
            throw new Error(`Payment failed: ${result.result.meta.TransactionResult}`);
          }
        } catch (paymentError) {
          throw new Error(paymentError.message || 'Payment processing failed');
        }
      }

      const { data, error } = await supabase
        .from('trading_bots')
        .insert([{
          name: newBot.name,
          wallet_address: connectedWallet.address,
          token_id: newBot.tokenId,
          interval: newBot.interval,
          min_amount: parseFloat(newBot.minAmount),
          max_amount: parseFloat(newBot.maxAmount),
          trade_mode: newBot.buyProbability,
          slippage: parseFloat(newBot.slippage),
          status: 'stopped',
          strategy: newBot.strategy
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Trading bot created successfully!');
      setBots([data, ...bots]);

      const createdToken = tokens.find(t => t.id === newBot.tokenId);
      if (createdToken && !poolsData[createdToken.id] && !fetchingPools.current.has(createdToken.id)) {
        fetchingPools.current.add(createdToken.id);
        try {
          const poolData = await fetchPoolData(createdToken);
          if (poolData) {
            setPoolsData(prev => ({ ...prev, [createdToken.id]: poolData }));
          }
        } finally {
          fetchingPools.current.delete(createdToken.id);
        }
      }

      setPaymentProgress({ show: false, message: '' });
      setShowCreateBot(false);
      setNewBot({
        name: '',
        tokenId: '',
        strategy: BOT_STRATEGIES.BALANCED,
        interval: 15,
        minAmount: 0.5,
        maxAmount: 2,
        slippage: 10,
        buyProbability: 50
      });

      await logActivity({
        userAddress: connectedWallet.address,
        actionType: ACTION_TYPES.BOT_CREATED,
        description: `Created trading bot: ${data.name}`
      });

    } catch (error) {
      console.error('Error creating bot:', error);
      toast.error(error.message || 'Failed to create bot');
      setPaymentProgress({ show: false, message: '' });
    } finally {
      if (client && client.isConnected()) {
        await client.disconnect();
      }
      setLoading(false);
    }
  };

  const determineNextAction = (bot, poolData) => {
    const strategy = bot.strategy || BOT_STRATEGIES.BALANCED;
    const buyProb = (bot.trade_mode || 50) / 100;

    let willBuy = false;
    switch (strategy) {
      case BOT_STRATEGIES.ACCUMULATE:
        willBuy = Math.random() < 0.8;
        break;
      case BOT_STRATEGIES.DISTRIBUTE:
        willBuy = Math.random() < 0.2;
        break;
      default:
        willBuy = Math.random() < buyProb;
    }

    const xrpAmount = getRandomAmount(bot.min_amount, bot.max_amount);
    const currentPrice = poolData.price;
    const estimatedTokenAmount = xrpAmount / currentPrice;

    return {
      action: willBuy ? 'BUY' : 'SELL',
      xrpAmount: xrpAmount.toFixed(4),
      tokenAmount: formatToken(estimatedTokenAmount),
      estimatedPrice: currentPrice.toFixed(8)
    };
  };

  const startBot = async (botOrId) => {
    const botId = typeof botOrId === 'string' ? botOrId : botOrId.id;
    const bot = typeof botOrId === 'string' ? bots.find(b => b.id === botOrId) : botOrId;

    if (!bot) {
      toast.error('Bot not found');
      return;
    }

    if (botIntervals.current[botId]) {
      return;
    }

    const token = tokens.find(t => t.id === bot.token_id);
    if (!token) {
      toast.error('Token not found');
      return;
    }

    if (!poolsData[token.id]) {
      if (!fetchingPools.current.has(token.id)) {
        console.log(`Fetching pool data for ${token.token_name}...`);
        const poolData = await fetchPoolData(token);
        if (poolData) {
          setPoolsData(prev => ({ ...prev, [token.id]: poolData }));
        } else {
          toast.error(`Unable to fetch pool data for ${token.token_name}`);
          return;
        }
      } else {
        console.log('Pool data is being fetched, please wait...');
        return;
      }
    }

    const nextAction = determineNextAction(bot, poolsData[token.id]);
    setNextTradeActions(prev => ({ ...prev, [bot.id]: nextAction }));

    const nextTime = Date.now() + (bot.interval * 60 * 1000);
    setNextTradeTimes(prev => ({ ...prev, [bot.id]: nextTime }));

    setBotAnnouncements(prev => {
      const newAnnouncements = { ...prev };
      if (newAnnouncements[bot.id] && (
        newAnnouncements[bot.id].includes('Slippage') ||
        newAnnouncements[bot.id].includes('❌') ||
        newAnnouncements[bot.id].includes('⚠️')
      )) {
        delete newAnnouncements[bot.id];
      }
      return newAnnouncements;
    });

    await supabase
      .from('trading_bots')
      .update({
        next_trade_time: new Date(nextTime).toISOString(),
        next_action: nextAction.action,
        next_token_amount: nextAction.tokenAmount,
        next_xrp_amount: nextAction.xrpAmount,
        next_price: nextAction.estimatedPrice
      })
      .eq('id', bot.id);

    const executeAndSchedule = async () => {
      try {
        const { data: freshBot } = await supabase
          .from('trading_bots')
          .select('*')
          .eq('id', bot.id)
          .maybeSingle();

        if (!freshBot || freshBot.status !== 'running') {
          return;
        }

        setBots(prev => prev.map(b => b.id === bot.id ? { ...b, ...freshBot } : b));

        await executeBotTrade(freshBot);

        const updatedPoolData = poolsData[token.id];
        if (updatedPoolData) {
          const newAction = determineNextAction(freshBot, updatedPoolData);
          setNextTradeActions(prev => ({ ...prev, [freshBot.id]: newAction }));

          const nextTime = Date.now() + (freshBot.interval * 60 * 1000);
          setNextTradeTimes(prev => ({ ...prev, [freshBot.id]: nextTime }));

          await supabase
            .from('trading_bots')
            .update({
              next_trade_time: new Date(nextTime).toISOString(),
              next_action: newAction.action,
              next_token_amount: newAction.tokenAmount,
              next_xrp_amount: newAction.xrpAmount,
              next_price: newAction.estimatedPrice
            })
            .eq('id', freshBot.id);
        }
      } catch (error) {
        console.error(`Error in bot ${bot.name}:`, error);
      }
    };

    const interval = setInterval(() => {
      executeAndSchedule();
    }, bot.interval * 60 * 1000);

    botIntervals.current[bot.id] = interval;

    setBots(prev => prev.map(b => b.id === bot.id ? { ...b, status: 'running' } : b));

    const runningBotIds = JSON.parse(localStorage.getItem('runningBots') || '[]');
    if (!runningBotIds.includes(bot.id)) {
      runningBotIds.push(bot.id);
      localStorage.setItem('runningBots', JSON.stringify(runningBotIds));
    }

    supabase
      .from('trading_bots')
      .update({ status: 'running' })
      .eq('id', bot.id)
      .then(() => {});
  };

  const pauseBot = async (botOrId) => {
    const botId = typeof botOrId === 'string' ? botOrId : botOrId.id;
    const bot = typeof botOrId === 'string' ? bots.find(b => b.id === botOrId) : botOrId;

    if (!bot) {
      toast.error('Bot not found');
      return;
    }

    if (botIntervals.current[botId]) {
      clearInterval(botIntervals.current[botId]);
      delete botIntervals.current[botId];
    }

    const runningBotIds = JSON.parse(localStorage.getItem('runningBots') || '[]');
    const filteredIds = runningBotIds.filter(id => id !== botId);
    localStorage.setItem('runningBots', JSON.stringify(filteredIds));

    try {
      await supabase
        .from('trading_bots')
        .update({ status: 'paused' })
        .eq('id', botId);

      setBots(prev => prev.map(b => b.id === botId ? { ...b, status: 'paused' } : b));
      toast.success(`Bot ${bot.name} paused`);
    } catch (error) {
      console.error('Error pausing bot:', error);
    }
  };

  const resumeBot = async (botOrId) => {
    const botId = typeof botOrId === 'string' ? botOrId : botOrId.id;
    const bot = typeof botOrId === 'string' ? bots.find(b => b.id === botOrId) : botOrId;

    if (!bot) {
      toast.error('Bot not found');
      return;
    }

    try {
      await supabase
        .from('trading_bots')
        .update({ status: 'running' })
        .eq('id', botId);

      setBots(prev => prev.map(b => b.id === botId ? { ...b, status: 'running' } : b));

      await startBot(bot);

      toast.success(`Bot ${bot.name} resumed`);
    } catch (error) {
      console.error('Error resuming bot:', error);
      toast.error('Failed to resume bot');
    }
  };

  const stopBot = async (botOrId) => {
    const botId = typeof botOrId === 'string' ? botOrId : botOrId.id;
    const bot = typeof botOrId === 'string' ? bots.find(b => b.id === botOrId) : botOrId;

    if (!bot) {
      toast.error('Bot not found');
      return;
    }

    if (botIntervals.current[botId]) {
      clearInterval(botIntervals.current[botId]);
      delete botIntervals.current[botId];
    }

    setNextTradeTimes(prev => {
      const newTimes = { ...prev };
      delete newTimes[botId];
      return newTimes;
    });

    setNextTradeActions(prev => {
      const newActions = { ...prev };
      delete newActions[botId];
      return newActions;
    });

    setBotAnnouncements(prev => {
      const newAnn = { ...prev };
      delete newAnn[botId];
      return newAnn;
    });

    await supabase
      .from('trading_bots')
      .update({
        next_trade_time: null,
        next_action: null,
        next_token_amount: null,
        next_xrp_amount: null,
        next_price: null
      })
      .eq('id', botId);

    const runningBotIds = JSON.parse(localStorage.getItem('runningBots') || '[]');
    const filteredIds = runningBotIds.filter(id => id !== botId);
    localStorage.setItem('runningBots', JSON.stringify(filteredIds));

    try {
      await supabase
        .from('trading_bots')
        .update({ status: 'stopped' })
        .eq('id', botId);

      setBots(prev => prev.map(b => b.id === botId ? { ...b, status: 'stopped' } : b));
      toast.success(`Bot ${bot.name} stopped`);
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  };

  const pauseAll = async () => {
    const runningBots = bots.filter(b => b.status === 'running');
    if (runningBots.length === 0) {
      toast.error('No running bots to pause');
      return;
    }

    toast.loading(`Pausing ${runningBots.length} bots...`);

    for (let i = 0; i < runningBots.length; i++) {
      await pauseBot(runningBots[i]);
      if (i < runningBots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    toast.dismiss();
    toast.success(`Paused ${runningBots.length} bots`);
  };

  const resumeAll = async () => {
    const pausedBots = bots.filter(b => b.status === 'paused');
    if (pausedBots.length === 0) {
      toast.error('No paused bots to resume');
      return;
    }

    toast.loading(`Resuming ${pausedBots.length} bots...`);

    for (let i = 0; i < pausedBots.length; i++) {
      await resumeBot(pausedBots[i]);
      if (i < pausedBots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    toast.dismiss();
    toast.success(`Resumed ${pausedBots.length} bots`);
  };

  const stopAll = async () => {
    const activeBots = bots.filter(b => b.status === 'running' || b.status === 'paused');
    if (activeBots.length === 0) {
      toast.error('No active bots to stop');
      return;
    }

    toast.loading(`Stopping ${activeBots.length} bots...`);

    for (let i = 0; i < activeBots.length; i++) {
      await stopBot(activeBots[i]);
      if (i < activeBots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    toast.dismiss();
    toast.success(`Stopped ${activeBots.length} bots`);
  };

  const startAll = async () => {
    const stoppedBots = bots.filter(b => b.status === 'stopped');
    if (stoppedBots.length === 0) {
      toast.error('No stopped bots to start');
      return;
    }

    toast.loading(`Starting ${stoppedBots.length} bots...`);

    for (let i = 0; i < stoppedBots.length; i++) {
      await startBot(stoppedBots[i]);
      if (i < stoppedBots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    toast.dismiss();
    toast.success(`Started ${stoppedBots.length} bots`);
  };

  const openEditBot = (bot) => {
    setEditingBot({
      ...bot,
      minAmount: bot.min_amount,
      maxAmount: bot.max_amount,
      buyProbability: bot.trade_mode
    });
    setShowEditBot(true);
  };

  const updateBot = async () => {
    if (!editingBot) return;

    if (!editingBot.name || editingBot.name.trim() === '') {
      toast.error('Bot name is required');
      return;
    }

    const interval = parseInt(editingBot.interval);
    if (isNaN(interval) || interval < 1) {
      toast.error('Minimum interval is 1 minute');
      return;
    }

    const minAmount = parseFloat(editingBot.minAmount);
    const maxAmount = parseFloat(editingBot.maxAmount);

    if (isNaN(minAmount) || minAmount < MIN_XRP_AMOUNT) {
      toast.error(`Minimum amount must be at least ${MIN_XRP_AMOUNT} XRP`);
      return;
    }

    if (isNaN(maxAmount) || maxAmount < MIN_XRP_AMOUNT) {
      toast.error(`Maximum amount must be at least ${MAX_XRP_AMOUNT} XRP`);
      return;
    }

    if (minAmount >= maxAmount) {
      toast.error('Min amount must be less than max amount');
      return;
    }

    const slippage = parseFloat(editingBot.slippage);
    if (isNaN(slippage) || slippage < 1 || slippage > 30) {
      toast.error('Slippage must be between 1% and 30%');
      return;
    }

    const wasRunning = editingBot.status === 'running';

    try {
      setLoading(true);

      if (wasRunning) {
        await stopBot(editingBot.id);
      }

      const { error } = await supabase
        .from('trading_bots')
        .update({
          name: editingBot.name.trim(),
          interval: interval,
          min_amount: minAmount,
          max_amount: maxAmount,
          slippage: slippage,
          strategy: editingBot.strategy,
          trade_mode: editingBot.buyProbability
        })
        .eq('id', editingBot.id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const updatedBot = {
        ...editingBot,
        name: editingBot.name.trim(),
        interval: interval,
        min_amount: minAmount,
        max_amount: maxAmount,
        slippage: slippage,
        strategy: editingBot.strategy,
        trade_mode: editingBot.buyProbability
      };

      setBots(prev => prev.map(b => b.id === editingBot.id ? updatedBot : b));

      setBotAnnouncements(prev => {
        const newAnnouncements = { ...prev };
        if (newAnnouncements[editingBot.id]) {
          delete newAnnouncements[editingBot.id];
        }
        return newAnnouncements;
      });

      toast.success('Bot updated successfully!');
      setShowEditBot(false);
      setEditingBot(null);

      if (wasRunning) {
        setTimeout(() => {
          startBot(updatedBot);
        }, 500);
      }
    } catch (error) {
      console.error('Error updating bot:', error);
      toast.error(error.message || 'Failed to update bot');
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (bot) => {
    if (!window.confirm(`Are you sure you want to delete bot "${bot.name}"?`)) {
      return;
    }

    if (botIntervals.current[bot.id]) {
      clearInterval(botIntervals.current[bot.id]);
      delete botIntervals.current[bot.id];
    }

    try {
      const { error } = await supabase
        .from('trading_bots')
        .delete()
        .eq('id', bot.id);

      if (error) throw error;

      setBots(prev => prev.filter(b => b.id !== bot.id));
      toast.success(`Bot ${bot.name} deleted`);
    } catch (error) {
      console.error('Error deleting bot:', error);
      toast.error('Failed to delete bot');
    }
  };

  const executeBotTrade = async (bot) => {
    let client = null;
    let isBuy = true;

    try {
      const token = tokens.find(t => t.id === bot.token_id);
      if (!token) return;

      let poolData = poolsData[token.id];
      if (!poolData) {
        if (!fetchingPools.current.has(token.id)) {
          console.log(`Fetching pool data for bot trade: ${token.token_name}...`);
          poolData = await fetchPoolData(token);
          if (poolData) {
            setPoolsData(prev => ({ ...prev, [token.id]: poolData }));
          } else {
            setBotAnnouncements(prev => ({ ...prev, [bot.id]: '⚠️ Unable to fetch pool data' }));
            return;
          }
        } else {
          setBotAnnouncements(prev => ({ ...prev, [bot.id]: '⏳ Waiting for pool data...' }));
          return;
        }
      }

      const strategy = bot.strategy || BOT_STRATEGIES.BALANCED;
      const buyProb = (bot.trade_mode || 50) / 100;

      switch (strategy) {
        case BOT_STRATEGIES.ACCUMULATE:
          isBuy = Math.random() < 0.8;
          break;
        case BOT_STRATEGIES.DISTRIBUTE:
          isBuy = Math.random() < 0.2;
          break;
        default:
          isBuy = Math.random() < buyProb;
      }

      const xrpAmount = getRandomAmount(bot.min_amount, bot.max_amount);
      const currentPrice = poolData.price;
      const estimatedTokenAmount = xrpAmount / currentPrice;

      const { requestWithRetry } = await import('../utils/xrplClient');

      const accountInfo = await requestWithRetry({
        command: 'account_info',
        account: connectedWallet.address,
        ledger_index: 'validated'
      });

      const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
      const reserve = 10;

      if (isBuy) {
        const maxXRPNeeded = xrpAmount * (1 + parseFloat(bot.slippage) / 100) + 1;
        const availableXRP = xrpBalance - reserve;

        console.log(`💰 XRP Balance Check: Have ${xrpBalance.toFixed(2)} XRP, Reserve ${reserve} XRP, Available ${availableXRP.toFixed(2)} XRP, Need ${maxXRPNeeded.toFixed(2)} XRP`);

        if (availableXRP < maxXRPNeeded) {
          const shortfall = maxXRPNeeded - availableXRP;
          setBotAnnouncements(prev => ({
            ...prev,
            [bot.id]: `⚠️ Need ${shortfall.toFixed(2)} more XRP (have ${availableXRP.toFixed(2)}, need ${maxXRPNeeded.toFixed(2)})`
          }));
          return;
        }
      } else {
        const currencyHex = token.currency_code.length > 3
          ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
          : token.currency_code;

        let currentTokenBalance = 0;
        try {
          const accountLines = await requestWithRetry({
            command: 'account_lines',
            account: connectedWallet.address,
            ledger_index: 'validated'
          });

          const trustLine = accountLines.result.lines?.find(
            line => line.currency === currencyHex && line.account === token.issuer_address
          );

          currentTokenBalance = trustLine ? parseFloat(trustLine.balance) : 0;

          console.log(`💰 Token Balance Check: Have ${formatToken(currentTokenBalance)} ${token.token_name}, Need ${formatToken(estimatedTokenAmount)} ${token.token_name}`);
        } catch (balanceError) {
          console.error('Error fetching token balance:', balanceError);
          currentTokenBalance = tokenBalances[token.id] || 0;
          console.log(`💰 Using cached balance: ${formatToken(currentTokenBalance)} ${token.token_name}`);
        }

        const tokenNeeded = estimatedTokenAmount * (1 + parseFloat(bot.slippage) / 100);

        if (currentTokenBalance < tokenNeeded) {
          const shortfall = tokenNeeded - currentTokenBalance;
          setBotAnnouncements(prev => ({
            ...prev,
            [bot.id]: `⚠️ Need ${formatToken(shortfall)} more ${token.token_name} (have ${formatToken(currentTokenBalance)}, need ${formatToken(tokenNeeded)})`
          }));
          return;
        }
      }

      setBotAnnouncements(prev => ({
        ...prev,
        [bot.id]: `${isBuy ? '🟢 Buying' : '🔴 Selling'} ${formatToken(estimatedTokenAmount)} ${token.token_name} for ${xrpAmount.toFixed(4)} XRP...`
      }));

      const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);
      const currencyHex = token.currency_code.length > 3
        ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : token.currency_code;

      const slippageMultiplier = 1 + (parseFloat(bot.slippage) / 100);

      let payment;
      if (isBuy) {
        const tokenAmountValue = parseFloat(estimatedTokenAmount) / slippageMultiplier;
        const xrpAmountValue = parseFloat(xrpAmount) * slippageMultiplier;

        payment = {
          TransactionType: 'Payment',
          Account: connectedWallet.address,
          Destination: connectedWallet.address,
          Amount: {
            currency: currencyHex,
            issuer: token.issuer_address,
            value: sanitizeToken(tokenAmountValue)
          },
          SendMax: xrpl.xrpToDrops(sanitizeXRP(xrpAmountValue).toString())
        };
      } else {
        const tokenAmountValue = parseFloat(estimatedTokenAmount) * slippageMultiplier;
        const xrpAmountValue = parseFloat(xrpAmount) / slippageMultiplier;

        payment = {
          TransactionType: 'Payment',
          Account: connectedWallet.address,
          Destination: connectedWallet.address,
          Amount: xrpl.xrpToDrops(sanitizeXRP(xrpAmountValue).toString()),
          SendMax: {
            currency: currencyHex,
            issuer: token.issuer_address,
            value: sanitizeToken(tokenAmountValue)
          }
        };
      }

      const { getClient } = await import('../utils/xrplClient');
      client = await getClient();

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob, { timeout: 60000 });

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const actualAmount = isBuy
          ? parseFloat(result.result.meta.delivered_amount?.value || estimatedTokenAmount)
          : estimatedTokenAmount;

        const txHash = result.result.hash;

        await supabase.from('bot_trades').insert([{
          bot_id: bot.id,
          trade_type: isBuy ? 'BUY' : 'SELL',
          amount: actualAmount,
          xrp_cost: xrpAmount,
          price: currentPrice,
          status: 'success',
          tx_hash: txHash
        }]);

        const updateData = {
          total_trades: (bot.total_trades || 0) + 1,
          successful_trades: (bot.successful_trades || 0) + 1
        };

        if (isBuy) {
          updateData.total_xrp_spent = (bot.total_xrp_spent || 0) + xrpAmount;
          updateData.total_tokens_earned = (bot.total_tokens_earned || 0) + actualAmount;
        } else {
          updateData.total_xrp_received = (bot.total_xrp_received || 0) + xrpAmount;
          updateData.total_tokens_spent = (bot.total_tokens_spent || 0) + actualAmount;
        }

        const netProfit = (updateData.total_xrp_received || bot.total_xrp_received || 0) -
                         (updateData.total_xrp_spent || bot.total_xrp_spent || 0);
        updateData.net_profit = netProfit;

        await supabase
          .from('trading_bots')
          .update(updateData)
          .eq('id', bot.id);

        setBots(prev => prev.map(b => b.id === bot.id ? {
          ...b,
          total_trades: (b.total_trades || 0) + 1,
          successful_trades: (b.successful_trades || 0) + 1,
          total_xrp_spent: isBuy ? (b.total_xrp_spent || 0) + xrpAmount : b.total_xrp_spent,
          total_xrp_received: isBuy ? b.total_xrp_received : (b.total_xrp_received || 0) + xrpAmount,
          total_tokens_earned: isBuy ? (b.total_tokens_earned || 0) + actualAmount : b.total_tokens_earned,
          total_tokens_spent: isBuy ? b.total_tokens_spent : (b.total_tokens_spent || 0) + actualAmount,
          net_profit: netProfit
        } : b));

        setBotAnnouncements(prev => ({
          ...prev,
          [bot.id]: `✅ ${isBuy ? 'Bought' : 'Sold'} ${formatToken(actualAmount)} ${token.token_name} for ${xrpAmount.toFixed(4)} XRP`
        }));

        fetchTokenBalances();

      } else {
        throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
      }

    } catch (error) {
      console.error(`Bot ${bot.name} trade error:`, error);

      const errorMessage = error.message || error.toString();
      let errorMsg = '❌ Trade failed';

      if (errorMessage.includes('tecPATH_DRY')) {
        errorMsg = '⚠️ No liquidity path found - Pool may be empty or token pairing issue';
        console.log(`📊 Pool liquidity issue for ${token.token_name}`);
      } else if (errorMessage.includes('tecPATH_PARTIAL')) {
        if (bot.slippage >= 25) {
          errorMsg = `⚠️ Max slippage reached (${bot.slippage}%) - Market too volatile or liquidity too low`;
        } else {
          const suggestedSlippage = Math.min(Math.max(Math.ceil(bot.slippage * 1.5), bot.slippage + 5), 30);
          errorMsg = `💡 Try increasing slippage from ${bot.slippage}% to ${suggestedSlippage}% (Edit bot to adjust)`;
        }
        console.log(`📊 Slippage issue - Current: ${bot.slippage}%, Action: ${isBuy ? 'BUY' : 'SELL'}`);
      } else if (errorMessage.includes('tecUNFUNDED_PAYMENT') || errorMessage.includes('tecUNFUNDED')) {
        try {
          const accountInfo = await requestWithRetry({
            command: 'account_info',
            account: connectedWallet.address,
            ledger_index: 'validated'
          });
          const currentXRP = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));

          if (isBuy) {
            const needed = xrpAmount * (1 + parseFloat(bot.slippage) / 100) + 1;
            errorMsg = `⚠️ Need ${(needed - currentXRP + 10).toFixed(2)} more XRP (have ${currentXRP.toFixed(2)}, need ${needed.toFixed(2)} for trade)`;
          } else {
            errorMsg = `⚠️ Insufficient ${token.token_name} tokens - Balance may have changed. Check wallet.`;
          }
        } catch {
          if (isBuy) {
            errorMsg = `⚠️ Insufficient XRP - Check wallet balance`;
          } else {
            errorMsg = `⚠️ Insufficient ${token.token_name} tokens - Check wallet balance`;
          }
        }
        console.log(`💰 Balance issue detected - Action: ${isBuy ? 'BUY' : 'SELL'}`);
      } else if (errorMessage.includes('tefPAST_SEQ')) {
        errorMsg = '⏱️ Transaction timing issue - Will retry next cycle';
      } else if (errorMessage.includes('telINSUF_FEE_P')) {
        errorMsg = '⚠️ Network fees too high - Will retry';
      } else if (errorMessage.includes('terQUEUED')) {
        errorMsg = '⏳ Transaction queued - Network congestion';
      } else {
        errorMsg = `❌ ${errorMessage.substring(0, 100)}`;
      }

      setBotAnnouncements(prev => ({ ...prev, [bot.id]: errorMsg }));

      console.log(`❌ Trade failed for ${bot.name}: ${errorMsg}`);
      console.log(`   Error details: ${errorMessage}`);
      console.log(`   Bot will continue running and retry on next cycle...`);

      try {
        await supabase.from('trading_bots').update({
          failed_trades: (bot.failed_trades || 0) + 1,
          last_error: errorMsg,
          last_error_at: new Date().toISOString()
        }).eq('id', bot.id);

        await logActivity({
          wallet_address: connectedWallet.address,
          action_type: ACTION_TYPES.FAILED_TRADE,
          description: `Bot trade failed: ${errorMsg}`,
          details: {
            bot_name: bot.name,
            token_name: token.token_name,
            error_message: errorMessage,
            suggested_action: errorMsg
          }
        });
      } catch (dbError) {
        console.error('Error logging failed trade:', dbError);
      }
    }
  };

  const tokensMap = useMemo(() => {
    const map = {};
    tokens.forEach(token => {
      map[token.id] = token;
    });
    return map;
  }, [tokens]);

  const BotTableRow = memo(({ bot, botNumber, token, nextTradeTime, onToggleFavorite, isFavorite, tokenBalance }) => {
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(timer);
    }, []);

    const timeUntil = nextTradeTime ? Math.max(0, Math.floor((nextTradeTime - currentTime) / 1000)) : 0;
    const minutes = Math.floor(timeUntil / 60);
    const seconds = timeUntil % 60;

    return (
      <tr className="hover:bg-blue-500/10 transition-colors">
        <td className="px-4 py-3">
          <span className="text-sm font-bold text-blue-300">#{botNumber}</span>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => onToggleFavorite(bot.id)}
            className="text-2xl hover:scale-110 transition-transform"
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-blue-200">{bot.name}</div>
        </td>
        <td className="px-4 py-3">
          {token && (
            <div className="flex items-center gap-2">
              <TokenIcon token={token} size="sm" />
              <div>
                <div className="text-sm font-medium text-blue-200">{token.token_name}</div>
                <div className="text-xs text-blue-400">{token.currency_code}</div>
              </div>
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          {token && (
            <span className="text-sm text-green-400 font-medium">
              {tokenBalance !== undefined ? formatToken(tokenBalance) : '0.00'}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            bot.status === 'running'
              ? 'bg-green-500/20 text-green-300'
              : bot.status === 'paused'
              ? 'bg-yellow-500/20 text-yellow-300'
              : 'bg-gray-500/20 text-gray-400'
          }`}>
            {bot.status === 'running' ? '🟢 Running' : bot.status === 'paused' ? '⏸ Paused' : '⭕ Stopped'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-blue-300">
            {bot.strategy === BOT_STRATEGIES.BALANCED && '⚖️ Balanced'}
            {bot.strategy === BOT_STRATEGIES.ACCUMULATE && '📈 Accumulate'}
            {bot.strategy === BOT_STRATEGIES.DISTRIBUTE && '📉 Distribute'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-blue-300">{bot.trade_interval}m</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-blue-300">{bot.min_trade_amount}-{bot.max_trade_amount} XRP</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-blue-300">{bot.total_trades || 0}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-green-400 font-medium">
            +{(bot.total_xrp_received || 0).toFixed(4)}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-red-400 font-medium">
            {(bot.total_xrp_spent || 0).toFixed(4)}
          </span>
        </td>
        <td className="px-4 py-3">
          {bot.status === 'running' && nextTradeTime ? (
            <span className="text-sm text-blue-300">
              {minutes}m {seconds}s
            </span>
          ) : (
            <span className="text-sm text-gray-500">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex gap-1 justify-end">
            {bot.status === 'running' ? (
              <button
                onClick={() => pauseBot(bot.id)}
                className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded hover:bg-yellow-500/30 text-xs"
              >
                ⏸ Pause
              </button>
            ) : bot.status === 'paused' ? (
              <button
                onClick={() => resumeBot(bot.id)}
                className="px-3 py-1 bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 text-xs"
              >
                ▶ Resume
              </button>
            ) : (
              <button
                onClick={() => startBot(bot)}
                className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 text-xs"
              >
                ▶ Start
              </button>
            )}
            <button
              onClick={() => stopBot(bot.id)}
              className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 text-xs"
            >
              ⏹ Stop
            </button>
            <button
              onClick={() => {
                setEditingBot(bot);
                setShowEditBot(true);
              }}
              className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded hover:bg-purple-500/30 text-xs"
            >
              ✏️
            </button>
            <button
              onClick={() => {
                setSelectedBot(bot);
              }}
              className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 text-xs"
            >
              📊
            </button>
            <button
              onClick={() => deleteBot(bot)}
              className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 text-xs"
            >
              🗑️
            </button>
          </div>
        </td>
      </tr>
    );
  }, (prevProps, nextProps) => {
    return (
      prevProps.bot.id === nextProps.bot.id &&
      prevProps.bot.status === nextProps.bot.status &&
      prevProps.bot.total_trades === nextProps.bot.total_trades &&
      prevProps.bot.total_xrp_received === nextProps.bot.total_xrp_received &&
      prevProps.bot.total_xrp_spent === nextProps.bot.total_xrp_spent &&
      prevProps.token?.id === nextProps.token?.id &&
      prevProps.nextTradeTime === nextProps.nextTradeTime &&
      prevProps.isFavorite === nextProps.isFavorite &&
      prevProps.tokenBalance === nextProps.tokenBalance
    );
  });

  const BotCard = memo(({ bot, token, poolData, nextTradeTime, nextAction, announcement, tokenBalance, onPause, onStop, onStart, onEdit, onViewActivity, onDelete }) => {
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(timer);
    }, []);

    const timeUntilNext = nextTradeTime ? Math.max(0, nextTradeTime - currentTime) : 0;
    const minutesUntil = Math.floor(timeUntilNext / 60000);
    const secondsUntil = Math.floor((timeUntilNext % 60000) / 1000);

    const successRate = bot.total_trades > 0
      ? ((bot.successful_trades / bot.total_trades) * 100).toFixed(1)
      : 0;

    const profitLoss = bot.net_profit || 0;
    const isProfitable = profitLoss > 0;

    const getStrategyBadge = (strategy) => {
      const badges = {
        [BOT_STRATEGIES.ACCUMULATE]: { label: 'Accumulate', color: 'bg-green-500/20 text-green-300', icon: '📈' },
        [BOT_STRATEGIES.DISTRIBUTE]: { label: 'Distribute', color: 'bg-red-500/20 text-red-300', icon: '📉' },
        [BOT_STRATEGIES.BALANCED]: { label: 'Balanced', color: 'bg-blue-500/20 text-blue-300', icon: '⚖️' }
      };
      return badges[strategy] || badges[BOT_STRATEGIES.BALANCED];
    };

    const strategyBadge = getStrategyBadge(bot.strategy);

    return (
      <div className="glass rounded-lg p-6 space-y-4 hover:border-blue-500/40 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {token && <TokenIcon token={token} size="md" />}
            <div>
              <h3 className="text-lg font-bold text-blue-200">{bot.name}</h3>
              <p className="text-blue-400 text-xs">{token?.token_name || 'Unknown Token'}</p>
              {token && poolData && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-blue-300 text-xs font-mono">
                    Price: {poolData.price.toFixed(8)} XRP
                  </span>
                </div>
              )}
              {token && (
                <div className="mt-1 bg-green-500/10 px-2 py-1 rounded border border-green-500/30">
                  <span className="text-green-400 text-xs font-bold">
                    💰 {tokenBalance !== undefined ? formatToken(tokenBalance) : '0.00'} {token.token_name}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${
            bot.status === 'running' ? 'bg-green-500/20 text-green-300' :
            bot.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
            'bg-gray-500/20 text-gray-300'
          }`}>
            {bot.status === 'running' ? '🟢 Running' :
             bot.status === 'paused' ? '⏸ Paused' :
             '⭕ Stopped'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${strategyBadge.color}`}>
            <span>{strategyBadge.icon}</span>
            <span>{strategyBadge.label}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300">
            Buy: {bot.trade_mode || 50}%
          </div>
          {successRate > 0 && (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              successRate >= 75 ? 'bg-green-500/20 text-green-300' :
              successRate >= 50 ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-red-500/20 text-red-300'
            }`}>
              {successRate}% success
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="glass bg-blue-500/5 rounded-lg p-2.5">
            <div className="text-blue-400 text-xs mb-0.5">Interval</div>
            <div className="text-blue-200 font-semibold">{bot.interval} min</div>
          </div>
          <div className="glass bg-blue-500/5 rounded-lg p-2.5">
            <div className="text-blue-400 text-xs mb-0.5">Range</div>
            <div className="text-blue-200 font-semibold">{bot.min_amount}-{bot.max_amount} XRP</div>
          </div>
          <div className="glass bg-blue-500/5 rounded-lg p-2.5">
            <div className="text-blue-400 text-xs mb-0.5">Total Trades</div>
            <div className="text-blue-200 font-semibold">{bot.total_trades || 0}</div>
          </div>
          <div className="glass bg-blue-500/5 rounded-lg p-2.5">
            <div className="text-blue-400 text-xs mb-0.5">Slippage</div>
            <div className="text-blue-200 font-semibold">{bot.slippage}%</div>
          </div>
          <div className="glass bg-green-500/5 rounded-lg p-2.5">
            <div className="text-green-400 text-xs mb-0.5">XRP Earned</div>
            <div className="text-green-200 font-semibold">
              {bot.total_xrp_received ? `+${bot.total_xrp_received.toFixed(4)}` : '0.0000'}
            </div>
          </div>
          <div className="glass bg-blue-500/5 rounded-lg p-2.5">
            <div className="text-blue-400 text-xs mb-0.5">XRP Spent</div>
            <div className="text-blue-200 font-semibold">
              {bot.total_xrp_spent ? bot.total_xrp_spent.toFixed(4) : '0.0000'}
            </div>
          </div>
        </div>

        {profitLoss !== 0 && (
          <div className={`glass rounded-lg p-3 ${
            isProfitable ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="text-xs text-purple-400 mb-1 text-center">Net P/L</div>
            <div className={`text-lg font-bold text-center ${isProfitable ? 'text-green-300' : 'text-red-300'}`}>
              {isProfitable ? '+' : ''}{profitLoss.toFixed(4)} XRP
            </div>
            {bot.total_xrp_spent > 0 && (
              <div className={`text-xs mt-1 text-center ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitable ? '+' : ''}{((profitLoss / bot.total_xrp_spent) * 100).toFixed(2)}% ROI
              </div>
            )}
          </div>
        )}

        {announcement && (
          <div className={`glass rounded-lg p-3 text-sm ${
            announcement.includes('✅') ? 'bg-green-500/10 text-green-200 border-green-500/30' :
            announcement.includes('❌') || announcement.includes('⚠️') ? 'bg-red-500/10 text-red-200 border-red-500/30' :
            'bg-blue-500/10 text-blue-200'
          }`}>
            {announcement}
          </div>
        )}

        {bot.status === 'running' && nextTradeTime && nextAction && (
          <div className="glass bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-purple-300 text-xs font-semibold">Next Trade Countdown</div>
              <div className="text-purple-200 text-2xl font-bold font-mono">
                {minutesUntil}:{secondsUntil.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-purple-400">Action:</span>
                <span className={`font-semibold ${nextAction.action === 'BUY' ? 'text-green-300' : 'text-red-300'}`}>
                  {nextAction.action === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-400">Amount:</span>
                <span className="text-purple-200 font-semibold">{nextAction.tokenAmount} {token?.token_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-400">XRP:</span>
                <span className="text-purple-200 font-semibold">{nextAction.xrpAmount} XRP</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-400">Est. Price:</span>
                <span className="text-purple-200 font-mono text-xs">{nextAction.estimatedPrice} XRP</span>
              </div>
            </div>
          </div>
        )}

        {bot.status === 'stopped' && (
          <div className="glass bg-gray-500/10 border border-gray-500/30 rounded-lg p-4 text-center">
            <div className="text-gray-400 text-sm">Bot is stopped</div>
            <div className="text-gray-300 text-xs mt-1">Start the bot to begin trading</div>
          </div>
        )}

        {bot.status === 'paused' && (
          <div className="glass bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
            <div className="text-yellow-400 text-sm">Bot is paused</div>
            <div className="text-yellow-300 text-xs mt-1">Resume to continue trading</div>
          </div>
        )}

        <div className="flex gap-2">
          {bot.status === 'running' ? (
            <>
              <button
                onClick={onPause}
                className="flex-1 glass hover:bg-yellow-500/10 text-yellow-200 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                ⏸ Pause
              </button>
              <button
                onClick={onStop}
                className="flex-1 glass hover:bg-red-500/10 text-red-200 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                ⏹ Stop
              </button>
            </>
          ) : bot.status === 'paused' ? (
            <>
              <button
                onClick={onStart}
                className="flex-1 btn-primary text-white py-2.5 rounded-lg text-sm font-medium"
              >
                ▶ Resume
              </button>
              <button
                onClick={onStop}
                className="flex-1 glass hover:bg-red-500/10 text-red-200 py-2.5 rounded-lg text-sm font-medium transition-all"
              >
                ⏹ Stop
              </button>
            </>
          ) : (
            <button
              onClick={onStart}
              className="flex-1 btn-primary text-white py-2.5 rounded-lg text-sm font-medium"
            >
              ▶ Start
            </button>
          )}
          <button
            onClick={onEdit}
            className={`flex-1 glass hover:bg-blue-500/10 text-blue-200 py-2.5 rounded-lg text-sm font-medium transition-all ${
              bot.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={bot.status === 'running'}
          >
            ✏️ Edit
          </button>
          <button
            onClick={onViewActivity}
            className="flex-1 glass hover:bg-blue-500/10 text-blue-200 py-2.5 rounded-lg text-sm font-medium transition-all"
          >
            📊 Activity
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all text-sm font-medium"
          >
            🗑
          </button>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    const timeChanged = Math.floor((prevProps.nextTradeTime || 0) / 1000) !== Math.floor((nextProps.nextTradeTime || 0) / 1000);

    return (
      prevProps.bot.id === nextProps.bot.id &&
      prevProps.bot.status === nextProps.bot.status &&
      prevProps.bot.total_trades === nextProps.bot.total_trades &&
      prevProps.bot.successful_trades === nextProps.bot.successful_trades &&
      prevProps.bot.net_profit === nextProps.bot.net_profit &&
      prevProps.bot.total_xrp_received === nextProps.bot.total_xrp_received &&
      prevProps.bot.total_xrp_spent === nextProps.bot.total_xrp_spent &&
      prevProps.token?.id === nextProps.token?.id &&
      prevProps.token?.image_url === nextProps.token?.image_url &&
      prevProps.poolData?.price === nextProps.poolData?.price &&
      !timeChanged &&
      prevProps.nextAction?.action === nextProps.nextAction?.action &&
      prevProps.nextAction?.tokenAmount === nextProps.nextAction?.tokenAmount &&
      prevProps.announcement === nextProps.announcement &&
      prevProps.tokenBalance === nextProps.tokenBalance
    );
  });

  const botHandlers = useMemo(() => {
    const handlers = {};
    bots.forEach(bot => {
      handlers[bot.id] = {
        onPause: () => pauseBot(bot.id),
        onStop: () => stopBot(bot.id),
        onStart: () => bot.status === 'paused' ? resumeBot(bot.id) : startBot(bot.id),
        onEdit: () => openEditBot(bot),
        onViewActivity: () => setSelectedBot(bot),
        onDelete: () => deleteBot(bot)
      };
    });
    return handlers;
  }, [bots.map(b => `${b.id}-${b.status}`).join(',')]);

  const filteredBots = bots.filter(bot => {
    const token = tokensMap[bot.token_id];
    const matchesSearch = bot.name.toLowerCase().includes(botSearchQuery.toLowerCase()) ||
                          token?.token_name.toLowerCase().includes(botSearchQuery.toLowerCase()) ||
                          token?.currency_code.toLowerCase().includes(botSearchQuery.toLowerCase());
    return matchesSearch;
  });

  const sortedBots = [...filteredBots].sort((a, b) => {
    const aFav = favoriteBots.includes(a.id);
    const bFav = favoriteBots.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;

    const tokenA = tokens.find(t => t.id === a.token_id);
    const tokenB = tokens.find(t => t.id === b.token_id);

    if (botSortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (botSortBy === 'token') {
      return (tokenA?.token_name || '').localeCompare(tokenB?.token_name || '');
    } else if (botSortBy === 'status') {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return 0;
    }
    return 0;
  });

  const filteredTokens = tokens.filter(token => {
    const matchesSearch = token.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          token.currency_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    const aFav = favoriteTokens.includes(a.id);
    const bFav = favoriteTokens.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-blue-200">Trading Bots</h2>
        {connectedWallet && (
          <button
            onClick={() => setShowCreateBot(true)}
            className="btn-primary text-white px-6 py-3 rounded-lg font-medium"
            disabled={loading}
          >
            + Create Bot
          </button>
        )}
      </div>

      {!connectedWallet && (
        <div className="glass rounded-lg p-6 bg-yellow-500/10 border border-yellow-500/30">
          <div className="text-center space-y-2">
            <div className="text-2xl">💡</div>
            <div className="text-yellow-200 font-medium">Connect Wallet to Use Trading Bots</div>
            <p className="text-yellow-300 text-sm">
              Connect your wallet from the Setup page to create and manage trading bots
            </p>
          </div>
        </div>
      )}

      {loading && bots.length === 0 && (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-blue-300">Loading bots...</p>
        </div>
      )}

      {connectedWallet && bots.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-blue-200">My Bots ({sortedBots.length})</h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={startAll}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 font-medium transition-colors"
                title={`Start all stopped bots (${bots.filter(b => b.status === 'stopped').length})`}
              >
                ▶ Start All ({bots.filter(b => b.status === 'stopped').length})
              </button>
              <button
                onClick={pauseAll}
                className="px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30 font-medium transition-colors"
                title={`Pause all running bots (${bots.filter(b => b.status === 'running').length})`}
              >
                ⏸ Pause All ({bots.filter(b => b.status === 'running').length})
              </button>
              <button
                onClick={resumeAll}
                className="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 font-medium transition-colors"
                title={`Resume all paused bots (${bots.filter(b => b.status === 'paused').length})`}
              >
                ▶ Resume All ({bots.filter(b => b.status === 'paused').length})
              </button>
              <button
                onClick={stopAll}
                className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 font-medium transition-colors"
                title={`Stop all active bots (${bots.filter(b => b.status === 'running' || b.status === 'paused').length})`}
              >
                ⏹ Stop All
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div></div>
            <div className="flex gap-2">
              <button
                onClick={() => setBotViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  botViewMode === 'list' ? 'bg-blue-600 text-white' : 'glass text-blue-300'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setBotViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  botViewMode === 'grid' ? 'bg-blue-600 text-white' : 'glass text-blue-300'
                }`}
              >
                Grid
              </button>
            </div>
          </div>

          <div className="glass rounded-lg p-4 space-y-3">
            <input
              type="text"
              placeholder="Search bots by name or token..."
              value={botSearchQuery}
              onChange={(e) => setBotSearchQuery(e.target.value)}
              className="input w-full"
            />
            <div className="flex gap-2">
              <select
                value={botSortBy}
                onChange={(e) => setBotSortBy(e.target.value)}
                className="input flex-1"
              >
                <option value="name">Sort by Name</option>
                <option value="token">Sort by Token</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>
          </div>

          {botViewMode === 'grid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedBots.map((bot, index) => {
                const token = tokensMap[bot.token_id];
                const poolData = token ? poolsData[token.id] : null;
                const handlers = botHandlers[bot.id] || {};
                return (
                  <div key={bot.id} className="relative">
                    <div className="absolute top-2 left-2 z-10 bg-blue-600/80 text-white font-bold px-2 py-1 rounded text-xs">
                      #{index + 1}
                    </div>
                    <button
                      onClick={() => toggleBotFavorite(bot.id)}
                      className="absolute top-2 right-2 z-10 text-2xl hover:scale-110 transition-transform bg-black/50 rounded-full w-8 h-8 flex items-center justify-center"
                    >
                      {favoriteBots.includes(bot.id) ? '⭐' : '☆'}
                    </button>
                    <BotCard
                      bot={bot}
                      token={token}
                      poolData={poolData}
                      nextTradeTime={nextTradeTimes[bot.id]}
                      nextAction={nextTradeActions[bot.id]}
                      announcement={botAnnouncements[bot.id]}
                      tokenBalance={token ? tokenBalances[token.id] : undefined}
                      {...handlers}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-blue-500/20 border-b border-blue-500/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Fav</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Bot Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Token</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Token Balance</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Strategy</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Interval</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Amount Range</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Total Trades</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">XRP Earned</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">XRP Spent</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-blue-200">Next Trade</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-blue-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/20">
                    {sortedBots.map((bot, index) => {
                      const token = tokensMap[bot.token_id];
                      return (
                        <BotTableRow
                          key={bot.id}
                          bot={bot}
                          botNumber={index + 1}
                          token={token}
                          nextTradeTime={nextTradeTimes[bot.id]}
                          onToggleFavorite={toggleBotFavorite}
                          isFavorite={favoriteBots.includes(bot.id)}
                          tokenBalance={token ? tokenBalances[token.id] : undefined}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {connectedWallet && bots.length === 0 && !loading && (
            <div className="glass rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-blue-200 mb-2">No Bots Yet</h3>
              <p className="text-blue-400 mb-6">Create your first trading bot to get started</p>
              <button
                onClick={() => setShowCreateBot(true)}
                className="btn-primary text-white px-6 py-3 rounded-lg font-medium"
              >
                + Create Bot
              </button>
            </div>
          )}
        </div>
      )}


      {!loading && bots.length === 0 && connectedWallet && (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-2xl font-bold text-blue-200 mb-2">No Trading Bots Yet</h3>
          <p className="text-blue-400 mb-6">
            Create your first automated trading bot to start trading
          </p>
        </div>
      )}

      {connectedWallet && tokens.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-blue-200">Available Tokens</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'glass text-blue-300'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'glass text-blue-300'
                }`}
              >
                Grid
              </button>
            </div>
          </div>

          <div className="glass rounded-lg p-4">
            <input
              type="text"
              placeholder="Search tokens by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full"
            />
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedTokens.map(token => (
                <div key={token.id} className="glass rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <TokenIcon token={token} size="md" />
                      <div>
                        <div className="font-semibold text-blue-200">{token.token_name}</div>
                        <div className="text-xs text-blue-400">{token.currency_code}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFavorite(token.id)}
                      className="text-2xl hover:scale-110 transition-transform"
                    >
                      {favoriteTokens.includes(token.id) ? '⭐' : '☆'}
                    </button>
                  </div>
                  {poolsData[token.id] && (
                    <div className="text-xs text-blue-300 text-center">
                      {poolsData[token.id].price.toFixed(8)} XRP
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setNewBot({ ...newBot, tokenId: token.id });
                      setShowCreateBot(true);
                    }}
                    className="w-full btn-primary text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Create Bot
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTokens.map(token => (
                <div key={token.id} className="glass rounded-lg p-4 flex items-center justify-between hover:bg-blue-500/10 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={() => toggleFavorite(token.id)}
                      className="text-2xl hover:scale-110 transition-transform"
                    >
                      {favoriteTokens.includes(token.id) ? '⭐' : '☆'}
                    </button>
                    <TokenIcon token={token} size="md" />
                    <div className="flex-1">
                      <div className="font-semibold text-blue-200">{token.token_name}</div>
                      <div className="text-sm text-blue-400">{token.currency_code}</div>
                    </div>
                    {poolsData[token.id] && (
                      <div className="text-right">
                        <div className="text-sm text-blue-300">
                          Price: {poolsData[token.id].price?.toFixed(6) || 'N/A'} XRP
                        </div>
                        <div className="text-xs text-blue-400">
                          {bots.filter(b => b.token_id === token.id).length} bot(s)
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setNewBot({ ...newBot, tokenId: token.id });
                      setShowCreateBot(true);
                    }}
                    className="btn-primary text-white px-6 py-2 rounded-lg ml-4"
                  >
                    Create Bot
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateBot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-blue-200">Create Trading Bot</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-blue-300 mb-2">Bot Name</label>
                <input
                  type="text"
                  value={newBot.name}
                  onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                  className="input w-full"
                  placeholder="My Trading Bot"
                />
              </div>

              <div>
                <label className="block text-blue-300 mb-2">Select Token</label>
                <select
                  value={newBot.tokenId}
                  onChange={(e) => setNewBot({ ...newBot, tokenId: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Select a token...</option>
                  {tokens.map(token => (
                    <option key={token.id} value={token.id}>
                      {token.token_name} ({token.currency_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-blue-300 mb-2">Strategy</label>
                <select
                  value={newBot.strategy}
                  onChange={(e) => setNewBot({ ...newBot, strategy: e.target.value })}
                  className="input w-full"
                >
                  <option value={BOT_STRATEGIES.BALANCED}>⚖️ Balanced (50/50 Buy/Sell)</option>
                  <option value={BOT_STRATEGIES.ACCUMULATE}>📈 Accumulate (80% Buy / 20% Sell)</option>
                  <option value={BOT_STRATEGIES.DISTRIBUTE}>📉 Distribute (20% Buy / 80% Sell)</option>
                </select>
              </div>

              <div>
                <label className="block text-blue-300 mb-2">
                  Buy Probability: {newBot.buyProbability}%
                </label>
                <input
                  type="range"
                  value={newBot.buyProbability}
                  onChange={(e) => setNewBot({ ...newBot, buyProbability: parseInt(e.target.value) })}
                  className="w-full"
                  min="0"
                  max="100"
                />
                <div className="flex justify-between text-xs text-blue-400 mt-1">
                  <span>More Selling</span>
                  <span>Balanced</span>
                  <span>More Buying</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-300 mb-2">Interval (minutes)</label>
                  <input
                    type="number"
                    value={newBot.interval}
                    onChange={(e) => setNewBot({ ...newBot, interval: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="input w-full"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 mb-2">Slippage (%)</label>
                  <input
                    type="number"
                    value={newBot.slippage}
                    onChange={(e) => setNewBot({ ...newBot, slippage: Math.max(1, parseFloat(e.target.value) || 10) })}
                    className="input w-full"
                    min="1"
                    max="20"
                    step="0.5"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 mb-2">Min Amount (XRP)</label>
                  <input
                    type="number"
                    value={newBot.minAmount}
                    onChange={(e) => setNewBot({ ...newBot, minAmount: parseFloat(e.target.value) || 0.1 })}
                    className="input w-full"
                    min={MIN_XRP_AMOUNT}
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 mb-2">Max Amount (XRP)</label>
                  <input
                    type="number"
                    value={newBot.maxAmount}
                    onChange={(e) => setNewBot({ ...newBot, maxAmount: parseFloat(e.target.value) || 1 })}
                    className="input w-full"
                    min={MIN_XRP_AMOUNT}
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="text-yellow-200 text-sm space-y-1">
                <p className="font-semibold">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  {connectedWallet?.address === BOT_FEE_RECEIVER ? (
                    <li className="text-green-300">✨ Receiver wallet - Bot creation is FREE</li>
                  ) : (
                    <li>Bot creation fee: {BOT_CREATION_FEE} XRP</li>
                  )}
                  <li>Bots can be edited when stopped or paused</li>
                  <li>XRP range must be between {MIN_XRP_AMOUNT} and {MAX_XRP_AMOUNT}</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowCreateBot(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={createBot}
                className="flex-1 btn-primary"
                disabled={loading}
              >
                {loading ? 'Creating...' : `Create Bot (${BOT_CREATION_FEE} XRP)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditBot && editingBot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-blue-200">Edit Bot: {editingBot.name}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-blue-300 mb-2">Bot Name</label>
                <input
                  type="text"
                  value={editingBot.name}
                  onChange={(e) => setEditingBot({ ...editingBot, name: e.target.value })}
                  className="input w-full"
                  placeholder="Enter bot name"
                />
              </div>
              <div>
                <label className="block text-blue-300 mb-2">Strategy</label>
                <select
                  value={editingBot.strategy}
                  onChange={(e) => setEditingBot({ ...editingBot, strategy: e.target.value })}
                  className="input w-full"
                >
                  <option value={BOT_STRATEGIES.BALANCED}>⚖️ Balanced (50/50)</option>
                  <option value={BOT_STRATEGIES.ACCUMULATE}>📈 Accumulate (80/20)</option>
                  <option value={BOT_STRATEGIES.DISTRIBUTE}>📉 Distribute (20/80)</option>
                </select>
              </div>

              <div>
                <label className="block text-blue-300 mb-2">
                  Buy Probability: {editingBot.buyProbability}%
                </label>
                <input
                  type="range"
                  value={editingBot.buyProbability}
                  onChange={(e) => setEditingBot({ ...editingBot, buyProbability: parseInt(e.target.value) })}
                  className="w-full"
                  min="0"
                  max="100"
                />
                <div className="flex justify-between text-xs text-blue-400 mt-1">
                  <span>More Selling</span>
                  <span>Balanced</span>
                  <span>More Buying</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-300 mb-2">Interval (minutes)</label>
                  <input
                    type="number"
                    value={editingBot.interval || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, interval: e.target.value })}
                    className="input w-full"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 mb-2">Slippage (%)</label>
                  <input
                    type="number"
                    value={editingBot.slippage || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, slippage: e.target.value })}
                    className="input w-full"
                    min="1"
                    max="30"
                    step="0.5"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 mb-2">Min Amount (XRP)</label>
                  <input
                    type="number"
                    value={editingBot.minAmount || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, minAmount: e.target.value })}
                    className="input w-full"
                    min={MIN_XRP_AMOUNT}
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 mb-2">Max Amount (XRP)</label>
                  <input
                    type="number"
                    value={editingBot.maxAmount || ''}
                    onChange={(e) => setEditingBot({ ...editingBot, maxAmount: e.target.value })}
                    className="input w-full"
                    min={MIN_XRP_AMOUNT}
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowEditBot(false);
                  setEditingBot(null);
                }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={updateBot}
                className="flex-1 btn-primary"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Bot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentProgress.show && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-8 max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-blue-200">Processing Payment</h3>
              <p className="text-blue-300">{paymentProgress.message}</p>
            </div>
          </div>
        </div>
      )}

      {selectedBot && (
        <BotTradeHistoryModal
          bot={selectedBot}
          onClose={() => setSelectedBot(null)}
        />
      )}
    </div>
  );
}
