import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import * as xrpl from 'xrpl';
import toast from 'react-hot-toast';
import { Buffer } from 'buffer';
import TokenIcon from '../components/TokenIcon';
import BotTradeHistoryModal from '../components/BotTradeHistoryModal';
import { logActivity, ACTION_TYPES } from '../utils/activityLogger';

const sanitizeXrpAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid XRP amount');
  }
  return parseFloat(num.toFixed(6));
};

const sanitizeTokenAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid token amount');
  }
  return num.toFixed(15);
};

export default function BotTrader() {
  const [tokens, setTokens] = useState([]);
  const [poolsData, setPoolsData] = useState({});
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [bots, setBots] = useState([]);
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedBot, setSelectedBot] = useState(null);
  const [nextTradeTimes, setNextTradeTimes] = useState({});
  const [botAnnouncements, setBotAnnouncements] = useState({});
  const [botProgress, setBotProgress] = useState({});
  const [newBot, setNewBot] = useState({
    name: '',
    tokenId: '',
    interval: 1,
    minAmount: 0.1,
    maxAmount: 1,
    tradeMode: 50,
    slippage: 5
  });
  const [loading, setLoading] = useState(false);
  const botIntervals = useRef({});
  const [globalStats, setGlobalStats] = useState({
    totalXRPEarnings: 0,
    totalBots: 0,
    activeBots: 0,
    totalFees: 0
  });

  useEffect(() => {
    loadTokens();
    loadConnectedWallet();

    return () => {
      Object.values(botIntervals.current).forEach(clearInterval);
    };
  }, []);

  useEffect(() => {
    if (tokens.length > 0) {
      fetchAllPoolsData();
    }
  }, [tokens]);

  useEffect(() => {
    if (connectedWallet && tokens.length > 0 && Object.keys(poolsData).length > 0) {
      console.log('✅ All dependencies ready - loading bots');
      loadBots();
    }
  }, [connectedWallet, tokens, poolsData]);

  useEffect(() => {
    if (Object.keys(poolsData).length > 0 && bots.length > 0) {
      bots.forEach(bot => {
        if (bot.status === 'running' && !botIntervals.current[bot.id]) {
          const token = tokens.find(t => t.id === bot.token_id);
          if (token && poolsData[token.id]) {
            console.log(`🔄 Pool data now available, starting bot: ${bot.name}`);
            startBot(bot);
          }
        }
      });
    }
  }, [poolsData, bots, tokens]);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setNextTradeTimes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(botId => {
          if (updated[botId] > 0) {
            updated[botId] = updated[botId] - 1;
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadConnectedWallet = () => {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      setConnectedWallet(JSON.parse(stored));
    } else {
      setConnectedWallet(null);
    }
  };

  const loadTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .eq('amm_pool_created', true)
        .order('token_name');

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const fetchAllPoolsData = async () => {
    if (tokens.length === 0) {
      console.log('⚠️ fetchAllPoolsData: No tokens available yet');
      return;
    }

    console.log(`\n💧 Fetching pool data for ${tokens.length} tokens...`);

    const client = new xrpl.Client('wss://xrplcluster.com');

    try {
      await client.connect();
      const poolData = {};

      for (const token of tokens) {
        if (!token.amm_pool_created) {
          console.log(`   ⚠️ ${token.token_name}: No AMM pool created yet`);
          continue;
        }

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
            const xrpAmount = parseFloat(amm.amount) / 1000000;
            const tokenAmount = parseFloat(amm.amount2.value);
            const price = xrpAmount / tokenAmount;

            poolData[token.id] = {
              xrpAmount,
              tokenAmount,
              price,
              accountId: amm.account
            };

            console.log(`   ✅ ${token.token_name}: Pool found - ${xrpAmount.toFixed(2)} XRP / ${tokenAmount.toFixed(2)} tokens (Price: ${price.toFixed(8)})`);
          } else {
            console.log(`   ❌ ${token.token_name}: AMM response has no pool data`);
          }
        } catch (error) {
          console.error(`   ❌ ${token.token_name}: Error fetching pool -`, error.message);
        }
      }

      console.log(`\n✅ Pool data fetched: ${Object.keys(poolData).length} pools loaded`);
      setPoolsData(poolData);
      await client.disconnect();
    } catch (error) {
      console.error('Error fetching pools data:', error);
    }
  };

  const loadBots = async () => {
    if (!connectedWallet) {
      console.log('⚠️ loadBots: No wallet connected');
      return;
    }

    console.log(`\n📥 Loading bots for wallet: ${connectedWallet.address}`);

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trading_bots')
        .select('*')
        .eq('wallet_address', connectedWallet.address)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Found ${data?.length || 0} bots`);

      setBots(data || []);

      data?.forEach(bot => {
        console.log(`   Bot: ${bot.name} - Status: ${bot.status}`);
        if (bot.status === 'running') {
          console.log(`   ▶️ Starting bot: ${bot.name}`);
          startBot(bot);
        } else {
          console.log(`   ⏸️ Bot ${bot.name} is ${bot.status}, not starting`);
        }
      });

      calculateGlobalStats(data || []);
    } catch (error) {
      console.error('Error loading bots:', error);
      toast.error('Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  const calculateGlobalStats = (botsData) => {
    const stats = {
      totalXRPEarnings: 0,
      totalBots: botsData.length,
      activeBots: botsData.filter(b => b.status === 'running').length,
      totalFees: 0
    };

    botsData.forEach(bot => {
      const netProfit = parseFloat(bot.net_profit || 0);
      stats.totalXRPEarnings += netProfit;
      const trades = parseInt(bot.total_trades || 0);
      stats.totalFees += trades * TRADING_FEE;
    });

    setGlobalStats(stats);
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

    if (isNaN(newBot.minAmount) || isNaN(newBot.maxAmount)) {
      toast.error('Please enter valid amounts');
      return;
    }

    if (newBot.minAmount <= 0 || newBot.maxAmount <= 0) {
      toast.error('Amounts must be greater than 0');
      return;
    }

    if (newBot.minAmount >= newBot.maxAmount) {
      toast.error('Min amount must be less than max amount');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('trading_bots')
        .insert([{
          name: newBot.name,
          wallet_address: connectedWallet.address,
          token_id: newBot.tokenId,
          interval: newBot.interval,
          min_amount: parseFloat(newBot.minAmount),
          max_amount: parseFloat(newBot.maxAmount),
          trade_mode: newBot.tradeMode,
          slippage: parseFloat(newBot.slippage),
          status: 'running'
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Trading bot created successfully!');

      setBots(prev => [data, ...prev]);

      const token = tokens.find(t => t.id === data.token_id);
      const hasPoolData = token && poolsData[token.id];

      if (hasPoolData) {
        setTimeout(() => {
          startBot(data);
        }, 1000);
      } else {
        console.log(`⚠️ Bot ${data.name}: Pool data not ready, will start when available`);
        toast('Bot created! It will start trading once pool data is loaded.', {
          icon: '⏳',
          duration: 3000,
        });
      }

      setShowCreateBot(false);
      setNewBot({
        name: '',
        tokenId: '',
        interval: 1,
        minAmount: 0.1,
        maxAmount: 1,
        tradeMode: 50,
        slippage: 5
      });
    } catch (error) {
      console.error('Error creating bot:', error);
      toast.error('Failed to create bot');
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (botId) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    try {
      if (botIntervals.current[botId]) {
        clearInterval(botIntervals.current[botId]);
        delete botIntervals.current[botId];
      }

      const { error } = await supabase
        .from('trading_bots')
        .delete()
        .eq('id', botId);

      if (error) throw error;

      setBots(prev => prev.filter(b => b.id !== botId));
      setNextTradeTimes(prev => {
        const updated = { ...prev };
        delete updated[botId];
        return updated;
      });
      toast.success('Bot deleted');
    } catch (error) {
      console.error('Error deleting bot:', error);
      toast.error('Failed to delete bot');
    }
  };

  const toggleBot = async (bot) => {
    if (bot.status === 'running') {
      await pauseBot(bot.id);
    } else {
      await resumeBot(bot);
    }
  };

  const pauseBot = async (botId) => {
    try {
      if (botIntervals.current[botId]) {
        clearInterval(botIntervals.current[botId]);
        delete botIntervals.current[botId];
      }

      const { error } = await supabase
        .from('trading_bots')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', botId);

      if (error) throw error;

      setBots(prev => prev.map(b =>
        b.id === botId ? { ...b, status: 'paused' } : b
      ));

      setNextTradeTimes(prev => {
        const updated = { ...prev };
        delete updated[botId];
        return updated;
      });

      toast.success('Bot paused');
    } catch (error) {
      console.error('Error pausing bot:', error);
      toast.error('Failed to pause bot');
    }
  };

  const resumeBot = async (bot) => {
    try {
      const { error } = await supabase
        .from('trading_bots')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', bot.id);

      if (error) throw error;

      setBots(prev => prev.map(b =>
        b.id === bot.id ? { ...b, status: 'running' } : b
      ));

      startBot({ ...bot, status: 'running' });
      toast.success('Bot resumed');
    } catch (error) {
      console.error('Error resuming bot:', error);
      toast.error('Failed to resume bot');
    }
  };

  const stopBot = async (botId) => {
    try {
      if (botIntervals.current[botId]) {
        clearInterval(botIntervals.current[botId]);
        delete botIntervals.current[botId];
      }

      const { error } = await supabase
        .from('trading_bots')
        .update({ status: 'stopped', updated_at: new Date().toISOString() })
        .eq('id', botId);

      if (error) throw error;

      setBots(prev => prev.map(b =>
        b.id === botId ? { ...b, status: 'stopped' } : b
      ));

      setNextTradeTimes(prev => {
        const updated = { ...prev };
        delete updated[botId];
        return updated;
      });

      toast.success('Bot stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
      toast.error('Failed to stop bot');
    }
  };

  const startBot = (bot) => {
    if (botIntervals.current[bot.id]) {
      console.log(`⚠️ Bot ${bot.name}: Already running, skipping start`);
      return;
    }

    const token = tokens.find(t => t.id === bot.token_id);
    if (!token) {
      console.log(`❌ Bot ${bot.name}: Cannot start - Token not found`);
      return;
    }

    const poolData = poolsData[token.id];
    if (!poolData) {
      console.log(`❌ Bot ${bot.name}: Cannot start - Pool data not available yet`);
      return;
    }

    console.log(`\n🤖 Starting Bot: ${bot.name}`);
    console.log(`   Token ID: ${bot.token_id}`);
    console.log(`   Interval: ${bot.interval} minutes`);
    console.log(`   Trade Mode: ${bot.trade_mode}% (${bot.trade_mode < 33 ? 'Sell' : bot.trade_mode < 66 ? 'Neutral' : 'Buy'})`);
    console.log(`   Min Amount: ${bot.min_amount} XRP`);
    console.log(`   Max Amount: ${bot.max_amount} XRP`);
    console.log(`   Slippage: ${bot.slippage}%`);

    setNextTradeTimes(prev => ({ ...prev, [bot.id]: bot.interval * 60 }));

    const announceNextMove = () => {
      try {
        const token = tokens.find(t => t.id === bot.token_id);
        if (!token) {
          console.log(`⚠️ Bot ${bot.name}: Cannot announce - token not found`);
          return;
        }

        const poolData = poolsData[token.id];
        if (!poolData || !poolData.price) {
          console.log(`⚠️ Bot ${bot.name}: Cannot announce - pool data not found`);
          return;
        }

        const tradeDecision = Math.random() * 100;
        const willBuy = tradeDecision < bot.trade_mode;
        const estimatedAmount = (Math.random() * (bot.max_amount - bot.min_amount) + bot.min_amount).toFixed(4);
        const currentPrice = poolData.price;

        let announcement;
        if (bot.trade_mode < 33) {
          announcement = `🔴 ${willBuy ? 'Planning BUY' : 'Planning SELL'} ~${estimatedAmount} ${token.token_name} @ ${currentPrice.toFixed(8)} XRP (Sell Mode)`;
        } else if (bot.trade_mode < 66) {
          announcement = `🟡 ${willBuy ? 'Planning BUY' : 'Planning SELL'} ~${estimatedAmount} ${token.token_name} @ ${currentPrice.toFixed(8)} XRP (Neutral Mode)`;
        } else {
          announcement = `🟢 ${willBuy ? 'Planning BUY' : 'Planning SELL'} ~${estimatedAmount} ${token.token_name} @ ${currentPrice.toFixed(8)} XRP (Buy Mode)`;
        }

        setBotAnnouncements(prev => ({ ...prev, [bot.id]: announcement }));
      } catch (error) {
        console.error(`Error announcing bot ${bot.name} next move:`, error);
      }
    };

    const executeTrade = async () => {
      console.log(`\n⏰ Bot ${bot.name}: Trade timer triggered`);

      if (!connectedWallet) {
        console.log(`❌ Bot ${bot.name}: SKIPPED - No wallet connected`);
        const errorAnnouncement = `❌ No wallet connected`;
        setBotAnnouncements(prev => ({ ...prev, [bot.id]: errorAnnouncement }));
        setNextTradeTimes(prev => ({ ...prev, [bot.id]: bot.interval * 60 }));
        return;
      }

      const token = tokens.find(t => t.id === bot.token_id);
      if (!token) {
        console.log(`❌ Bot ${bot.name}: SKIPPED - Token not found (ID: ${bot.token_id})`);
        console.log(`Available tokens:`, tokens.map(t => ({ id: t.id, name: t.token_name })));
        const errorAnnouncement = `❌ Token not found`;
        setBotAnnouncements(prev => ({ ...prev, [bot.id]: errorAnnouncement }));
        setNextTradeTimes(prev => ({ ...prev, [bot.id]: bot.interval * 60 }));
        return;
      }

      const poolData = poolsData[token.id];
      if (!poolData) {
        console.log(`❌ Bot ${bot.name}: SKIPPED - No pool data for ${token.token_name}`);
        console.log(`Available pool data:`, Object.keys(poolsData));
        console.log(`Attempting to fetch pool data...`);

        const errorAnnouncement = `❌ No liquidity pool found - retrying...`;
        setBotAnnouncements(prev => ({ ...prev, [bot.id]: errorAnnouncement }));

        await fetchAllPoolsData();

        setNextTradeTimes(prev => ({ ...prev, [bot.id]: bot.interval * 60 }));
        return;
      }

      console.log(`✅ Bot ${bot.name}: All checks passed - proceeding with trade`);

      let client;
      try {
        const tradeDecision = Math.random() * 100;
        const isBuy = tradeDecision < bot.trade_mode;
        const xrpAmount = (Math.random() * (bot.max_amount - bot.min_amount) + bot.min_amount);
        const currentPrice = poolData.price;

        if (!connectedWallet.seed) {
          throw new Error('Wallet seed required for trading');
        }

        const estimatedTokenAmount = xrpAmount / currentPrice;

        setBotProgress(prev => ({
          ...prev,
          [bot.id]: {
            show: true,
            step: 1,
            totalSteps: 2,
            action: isBuy ? 'BUYING' : 'SELLING',
            tokenName: token.token_name,
            amount: estimatedTokenAmount.toFixed(2),
            xrp: xrpAmount.toFixed(4),
            status: 'Connecting to XRPL...'
          }
        }));

        console.log(`\n🤖 ==================== BOT TRADER EXECUTING ====================`);
        console.log(`Bot Name: ${bot.name}`);
        console.log(`Action: ${isBuy ? 'BUY' : 'SELL'} ${token.token_name}`);
        console.log(`XRP Amount: ${xrpAmount.toFixed(4)} XRP`);
        console.log(`Estimated Tokens: ${estimatedTokenAmount.toFixed(4)}`);
        console.log(`Current Price: ${currentPrice.toFixed(8)} XRP per token`);
        console.log(`Network: MAINNET (wss://xrplcluster.com)`);
        console.log(`===============================================================\n`);

        client = new xrpl.Client('wss://xrplcluster.com');
        await client.connect();

        setBotProgress(prev => ({
          ...prev,
          [bot.id]: { ...prev[bot.id], step: 2, status: `${isBuy ? 'Buying' : 'Selling'} ${estimatedTokenAmount.toFixed(2)} ${token.token_name}...` }
        }));

        const wallet = xrpl.Wallet.fromSeed(connectedWallet.seed);

        const currencyHex = token.currency_code.length > 3
          ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
          : token.currency_code;

        const slippageMultiplier = 1 + ((bot.slippage || 5) / 100);

        let payment;
        if (isBuy) {
          const tokenAmountValue = estimatedTokenAmount / slippageMultiplier;
          const xrpAmountValue = xrpAmount * slippageMultiplier;

          payment = {
            TransactionType: 'Payment',
            Account: connectedWallet.address,
            Destination: connectedWallet.address,
            Amount: {
              currency: currencyHex,
              issuer: token.issuer_address,
              value: sanitizeTokenAmount(tokenAmountValue)
            },
            SendMax: xrpl.xrpToDrops(sanitizeXrpAmount(xrpAmountValue).toString())
          };
        } else {
          const tokenAmountValue = estimatedTokenAmount * slippageMultiplier;
          const xrpAmountValue = xrpAmount / slippageMultiplier;

          payment = {
            TransactionType: 'Payment',
            Account: connectedWallet.address,
            Destination: connectedWallet.address,
            Amount: xrpl.xrpToDrops(sanitizeXrpAmount(xrpAmountValue).toString()),
            SendMax: {
              currency: currencyHex,
              issuer: token.issuer_address,
              value: sanitizeTokenAmount(tokenAmountValue)
            }
          };
        }

        console.log(`\n💱 Bot ${isBuy ? 'BUY' : 'SELL'} Payment Transaction:`);
        console.log(`   ${isBuy ? 'Spending' : 'Receiving'}: ${xrpAmount.toFixed(4)} XRP`);
        console.log(`   ${isBuy ? 'Receiving' : 'Spending'}: ${estimatedTokenAmount.toFixed(4)} ${token.token_name}`);
        console.log(`   Slippage: ${bot.slippage || 5}%`);

        const prepared = await client.autofill(payment);
        const signed = wallet.sign(prepared);

        const result = await client.submitAndWait(signed.tx_blob, { timeout: 45000 });

        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
          const actualAmount = isBuy
            ? parseFloat(result.result.meta.delivered_amount?.value || estimatedTokenAmount)
            : estimatedTokenAmount;

          const txHash = result.result.hash;
          console.log(`✅ Bot ${bot.name}: Trade SUCCESSFUL on MAINNET!`);
          console.log(`   Type: ${isBuy ? 'BUY' : 'SELL'}`);
          console.log(`   Amount: ${actualAmount.toFixed(4)} ${token.token_name}`);
          console.log(`   XRP Cost: ${xrpAmount.toFixed(4)} XRP`);
          console.log(`   Price: ${currentPrice.toFixed(8)} XRP`);
          console.log(`   TX Hash: ${txHash}`);
          console.log(`   XRPScan: https://xrpscan.com/tx/${txHash}`);

          await supabase.from('bot_trades').insert([{
            bot_id: bot.id,
            trade_type: isBuy ? 'BUY' : 'SELL',
            amount: actualAmount,
            xrp_cost: xrpAmount,
            price: currentPrice,
            status: 'success',
            tx_hash: txHash
          }]);

          await logActivity({
            userAddress: connectedWallet.address,
            actionType: ACTION_TYPES.SWAP_EXECUTED,
            description: `Bot ${bot.name}: ${isBuy ? 'Bought' : 'Sold'} ${actualAmount.toFixed(4)} ${token.token_name}`,
            details: {
              botName: bot.name,
              tradeType: isBuy ? 'BUY' : 'SELL',
              amount: actualAmount.toFixed(4),
              xrpCost: xrpAmount.toFixed(4),
              price: currentPrice.toFixed(8),
              isBot: true
            },
            txHash,
            tokenId: token.id
          });

          const { data: botData } = await supabase
            .from('trading_bots')
            .select('*')
            .eq('id', bot.id)
            .single();

          const currentBot = botData || bot;

          const newTotalTrades = currentBot.total_trades + 1;
          const newSuccessfulTrades = currentBot.successful_trades + 1;
          const newBuyVolume = isBuy ? currentBot.total_buy_volume + actualAmount : currentBot.total_buy_volume;
          const newSellVolume = !isBuy ? currentBot.total_sell_volume + actualAmount : currentBot.total_sell_volume;
          const newXRPSpent = isBuy ? currentBot.total_xrp_spent + xrpAmount : currentBot.total_xrp_spent;
          const newXRPReceived = !isBuy ? currentBot.total_xrp_received + xrpAmount : currentBot.total_xrp_received;
          const newNetProfit = newXRPReceived - newXRPSpent;

          await supabase
            .from('trading_bots')
            .update({
              total_trades: newTotalTrades,
              successful_trades: newSuccessfulTrades,
              total_buy_volume: newBuyVolume,
              total_sell_volume: newSellVolume,
              total_xrp_spent: newXRPSpent,
              total_xrp_received: newXRPReceived,
              net_profit: newNetProfit,
              last_trade_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', bot.id);

          const updatedBots = bots.map(b => b.id === bot.id ? {
            ...b,
            total_trades: newTotalTrades,
            successful_trades: newSuccessfulTrades,
            total_buy_volume: newBuyVolume,
            total_sell_volume: newSellVolume,
            total_xrp_spent: newXRPSpent,
            total_xrp_received: newXRPReceived,
            net_profit: newNetProfit,
            last_trade_at: new Date().toISOString()
          } : b);

          setBots(updatedBots);
          calculateGlobalStats(updatedBots);

          setBotProgress(prev => ({
            ...prev,
            [bot.id]: { ...prev[bot.id], step: 2, status: `✅ ${isBuy ? 'Bought' : 'Sold'} ${actualAmount.toFixed(2)} ${token.token_name}!` }
          }));

          setTimeout(() => {
            setBotProgress(prev => ({ ...prev, [bot.id]: { show: false } }));
          }, 3000);

          const successAnnouncement = `✅ ${isBuy ? 'BOUGHT' : 'SOLD'} ${actualAmount.toFixed(4)} ${token.token_name} for ${xrpAmount.toFixed(4)} XRP`;
          setBotAnnouncements(prev => ({ ...prev, [bot.id]: successAnnouncement }));
        } else {
          throw new Error(`Trade failed: ${result.result.meta.TransactionResult}`);
        }

        await client.disconnect();
        setNextTradeTimes(prev => ({ ...prev, [bot.id]: bot.interval * 60 }));

        setTimeout(() => announceNextMove(), 3000);

      } catch (error) {
        console.error(`Bot ${bot.name} trade error:`, error);

        setBotProgress(prev => ({ ...prev, [bot.id]: { show: false } }));

        try {
          if (client && client.isConnected()) {
            await client.disconnect();
          }
        } catch (disconnectError) {
          console.error('Error disconnecting client:', disconnectError);
        }

        let errorAnnouncement;
        let shouldRetry = false;

        if (error.message.includes('xrpToDrops') && error.message.includes('decimal places')) {
          errorAnnouncement = `⚠️ Amount precision error - retrying`;
          console.log(`Bot ${bot.name}: XRP decimal precision error. Adjusting amounts.`);
        } else if (error.message.includes('Invalid XRP amount') || error.message.includes('Invalid token amount')) {
          errorAnnouncement = `⚠️ Invalid amount calculated`;
          console.error(`Bot ${bot.name}: Invalid amount error:`, error);
        } else if (error.message.includes('tecPATH_PARTIAL')) {
          const currentSlippage = bot.slippage || 5;
          const suggestedSlippage = Math.min(currentSlippage * 2, 50);
          errorAnnouncement = `⚠️ Partial fill - increasing slippage to ${suggestedSlippage}%`;
          shouldRetry = true;

          console.log(`Bot ${bot.name}: Partial fill detected. Auto-increasing slippage from ${currentSlippage}% to ${suggestedSlippage}%`);

          await supabase
            .from('trading_bots')
            .update({ slippage: suggestedSlippage })
            .eq('id', bot.id);

          const updatedBots = bots.map(b => b.id === bot.id ? { ...b, slippage: suggestedSlippage } : b);
          setBots(updatedBots);

          setTimeout(() => {
            executeBotTrade(bot);
          }, 2000);
        } else if (error.message.includes('temREDUNDANT')) {
          errorAnnouncement = `⏭️ Skipped: Previous transaction still processing`;
        } else if (error.message.includes('tecPATH_DRY')) {
          errorAnnouncement = `⚠️ Insufficient liquidity in pool`;
        } else if (error.message.includes('tecUNFUNDED_PAYMENT')) {
          errorAnnouncement = `⚠️ Insufficient funds for trade`;
        } else if (error.message.includes('tecUNFUNDED')) {
          errorAnnouncement = `⚠️ Insufficient XRP balance`;
        } else if (error.message.includes('tecNO_LINE')) {
          errorAnnouncement = `⚠️ Trustline not found`;
        } else if (error.message.includes('tecNO_AUTH')) {
          errorAnnouncement = `⚠️ Token requires authorization`;
        } else if (error.message.includes('LastLedgerSequence') || error.message.includes('timeout')) {
          errorAnnouncement = `⏱️ Transaction timeout - retrying`;
        } else if (error.message.includes('WebSocket') || error.message.includes('Failed to fetch')) {
          errorAnnouncement = `🔌 Network error - retrying`;
        } else {
          errorAnnouncement = `❌ ${error.message.substring(0, 60)}`;
        }
        setBotAnnouncements(prev => ({ ...prev, [bot.id]: errorAnnouncement }));

        try {
          await supabase.from('bot_trades').insert([{
            bot_id: bot.id,
            trade_type: 'ERROR',
            amount: 0,
            xrp_cost: 0,
            price: 0,
            status: 'failed',
            error_message: error.message
          }]);

          const { data: botData } = await supabase
            .from('trading_bots')
            .select('*')
            .eq('id', bot.id)
            .single();

          const currentBot = botData || bot;

          await supabase
            .from('trading_bots')
            .update({
              failed_trades: currentBot.failed_trades + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', bot.id);

          setBots(prev => prev.map(b => b.id === bot.id ? {
            ...b,
            failed_trades: b.failed_trades + 1
          } : b));
        } catch (dbError) {
          console.error(`Bot ${bot.name} failed to log error:`, dbError);
        }

        if (!shouldRetry) {
          setNextTradeTimes(prev => ({ ...prev, [bot.id]: bot.interval * 60 }));
          setTimeout(() => announceNextMove(), 2000);
        }
      }
    };

    console.log(`📢 Bot ${bot.name}: Announcing next move...`);
    announceNextMove();

    console.log(`🚀 Bot ${bot.name}: Executing first trade immediately...`);
    executeTrade();

    const intervalMs = bot.interval * 60 * 1000;
    botIntervals.current[bot.id] = setInterval(executeTrade, intervalMs);
    console.log(`⏰ Bot ${bot.name}: Interval set to ${intervalMs}ms (${bot.interval} minutes)`);
    console.log(`✅ Bot ${bot.name}: Successfully started!\n`);
  };

  const exportBotData = async (bot) => {
    try {
      const { data: trades } = await supabase
        .from('bot_trades')
        .select('*')
        .eq('bot_id', bot.id)
        .order('created_at', { ascending: false })
        .limit(100);

      const token = tokens.find(t => t.id === bot.token_id);
      const exportData = {
        botName: bot.name,
        token: token?.token_name,
        createdAt: bot.created_at,
        stats: {
          totalTrades: bot.total_trades,
          successfulTrades: bot.successful_trades,
          failedTrades: bot.failed_trades,
          totalBuyVolume: bot.total_buy_volume,
          totalSellVolume: bot.total_sell_volume,
          totalXRPSpent: bot.total_xrp_spent,
          totalXRPReceived: bot.total_xrp_received,
          netProfit: bot.net_profit
        },
        trades: trades || [],
        settings: {
          interval: bot.interval,
          minAmount: bot.min_amount,
          maxAmount: bot.max_amount,
          tradeMode: bot.trade_mode
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${bot.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Bot data exported');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const importBotData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          toast.success(`Imported data for ${importedData.botName}`);
          console.log('Imported bot data:', importedData);
        } catch (error) {
          toast.error('Failed to import bot data');
          console.error('Import error:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const getTradeModeLabel = (value) => {
    if (value < 33) return 'Mostly Sell';
    if (value < 66) return 'Neutral';
    return 'Mostly Buy';
  };

  const getTradeModeColor = (value) => {
    if (value < 33) return 'text-red-400';
    if (value < 66) return 'text-yellow-400';
    return 'text-green-400';
  };

  const formatCountdown = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const BotCard = ({ bot, isListView = false }) => {
    const token = tokens.find(t => t.id === bot.token_id);
    const poolData = poolsData[token?.id];
    const countdown = nextTradeTimes[bot.id] || 0;
    const announcement = botAnnouncements[bot.id];

    if (!token) return null;

    if (isListView) {
      return (
        <div className="glass rounded-lg p-4 flex items-center gap-4">
          <TokenIcon token={token} size="md" />

          <div className="flex-1 grid grid-cols-7 gap-4 items-center">
            <div>
              <div className="text-lg font-bold text-purple-200">{bot.name}</div>
              <div className="text-purple-400 text-sm">{token.token_name}</div>
            </div>

            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              bot.status === 'running' ? 'bg-green-500/20 text-green-400' :
              bot.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {bot.status === 'running' ? '● Running' : bot.status === 'paused' ? '❙❙ Paused' : '○ Stopped'}
            </div>

            <div className="text-center">
              <div className="text-purple-400 text-xs">Trades</div>
              <div className="text-purple-200 font-bold">{bot.total_trades || 0}</div>
            </div>

            <div className="text-center">
              <div className="text-purple-400 text-xs">Success</div>
              <div className="text-green-400 font-bold">
                {bot.total_trades > 0
                  ? ((bot.successful_trades / bot.total_trades) * 100).toFixed(1)
                  : 0}%
              </div>
            </div>

            <div className="text-center">
              <div className="text-purple-400 text-xs">Net Profit</div>
              <div className={`font-bold ${bot.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {bot.net_profit >= 0 ? '+' : ''}{parseFloat(bot.net_profit || 0).toFixed(2)}
              </div>
            </div>

            <div className="text-center">
              {bot.status === 'running' && countdown > 0 && (
                <>
                  <div className="text-purple-400 text-xs">Next Trade</div>
                  <div className="text-blue-400 font-mono font-bold">{formatCountdown(countdown)}</div>
                </>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => toggleBot(bot)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  bot.status === 'running'
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {bot.status === 'running' ? '❙❙' : '▶'}
              </button>
              <button
                onClick={() => setSelectedBot(bot)}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                title="View History"
              >
                📊
              </button>
              <button
                onClick={() => deleteBot(bot.id)}
                className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="glass rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TokenIcon token={token} size="md" />
            <div>
              <h3 className="text-xl font-bold text-purple-200">{bot.name}</h3>
              <p className="text-purple-400 text-sm">{token.token_name}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            bot.status === 'running' ? 'bg-green-500/20 text-green-400' :
            bot.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {bot.status === 'running' ? '● Running' : bot.status === 'paused' ? '❙❙ Paused' : '○ Stopped'}
          </div>
        </div>

        {poolData && (
          <div className="bg-purple-900/30 rounded-lg p-3">
            <div className="text-purple-400 text-xs mb-1">Live Price</div>
            <div className="text-2xl font-bold text-green-400">
              {poolData.price.toFixed(8)} XRP
            </div>
          </div>
        )}

        {bot.status === 'running' && countdown > 0 && (
          <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-500/30">
            <div className="text-blue-400 text-xs mb-1">Next Trade In</div>
            <div className="text-3xl font-mono font-bold text-blue-300">
              {formatCountdown(countdown)}
            </div>
          </div>
        )}

        {announcement && bot.status === 'running' && (
          <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
            <div className="text-purple-400 text-xs mb-1">Bot Announcement</div>
            <div className="text-sm font-medium text-purple-200">
              {announcement}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-purple-400">Interval:</span>
            <span className="text-purple-200">{bot.interval} min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-purple-400">XRP Range:</span>
            <span className="text-purple-200">{bot.min_amount} - {bot.max_amount} XRP</span>
          </div>
          {poolData && poolData.price && (
            <div className="flex justify-between text-sm">
              <span className="text-purple-400">Token Range:</span>
              <span className="text-purple-200">
                {(bot.min_amount / poolData.price).toFixed(2)} - {(bot.max_amount / poolData.price).toFixed(2)} {token.token_name}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-purple-400">Trade Mode:</span>
            <span className={getTradeModeColor(bot.trade_mode)}>
              {getTradeModeLabel(bot.trade_mode)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-purple-400">Slippage:</span>
            <span className="text-purple-200">{bot.slippage || 5}%</span>
          </div>
        </div>

        <div className="pt-3 border-t border-purple-500/20">
          <div className="text-purple-400 text-xs mb-2">Statistics</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-purple-400">Total Trades</div>
              <div className="text-purple-200 font-bold">{bot.total_trades || 0}</div>
            </div>
            <div>
              <div className="text-purple-400">Success Rate</div>
              <div className="text-green-400 font-bold">
                {bot.total_trades > 0
                  ? ((bot.successful_trades / bot.total_trades) * 100).toFixed(1)
                  : 0}%
              </div>
            </div>
            <div>
              <div className="text-purple-400">Buy Volume</div>
              <div className="text-purple-200 font-bold">{parseFloat(bot.total_buy_volume || 0).toFixed(2)} XRP</div>
            </div>
            <div>
              <div className="text-purple-400">Sell Volume</div>
              <div className="text-purple-200 font-bold">{parseFloat(bot.total_sell_volume || 0).toFixed(2)} XRP</div>
            </div>
            <div>
              <div className="text-purple-400">XRP Spent</div>
              <div className="text-red-400 font-bold">{parseFloat(bot.total_xrp_spent || 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-purple-400">XRP Received</div>
              <div className="text-green-400 font-bold">{parseFloat(bot.total_xrp_received || 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-purple-400">Total XRP Fees</div>
              <div className="text-orange-400 font-bold">{((bot.total_trades || 0) * TRADING_FEE).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-purple-400">Net Profit</div>
              <div className={`font-bold ${bot.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {bot.net_profit >= 0 ? '+' : ''}{parseFloat(bot.net_profit || 0).toFixed(2)} XRP
              </div>
            </div>
          </div>
        </div>

        {bot.last_trade_at && (
          <div className="pt-3 border-t border-purple-500/20">
            <div className="text-purple-400 text-xs mb-1">Last Trade</div>
            <div className="text-purple-300 text-xs">
              {new Date(bot.last_trade_at).toLocaleString()}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => toggleBot(bot)}
            className={`px-4 py-2 rounded-lg font-medium ${
              bot.status === 'running'
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {bot.status === 'running' ? '❙❙ Pause' : '▶ Start'}
          </button>
          <button
            onClick={() => stopBot(bot.id)}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
            disabled={bot.status === 'stopped'}
          >
            ■ Stop
          </button>
          <button
            onClick={() => setSelectedBot(bot)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            title="View History"
          >
            📊 History
          </button>
          <button
            onClick={() => exportBotData(bot)}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
            title="Export Data"
          >
            📥 Export
          </button>
        </div>

        <button
          onClick={() => deleteBot(bot.id)}
          className="w-full px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm"
        >
          🗑️ Delete Bot
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-purple-200">Bot Trader</h2>
          <p className="text-purple-400 mt-1">Automated trading bots for AMM pools</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 glass rounded-lg p-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-purple-400'}`}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-purple-400'}`}
              title="List View"
            >
              ☰
            </button>
          </div>
          <button
            onClick={importBotData}
            className="btn text-purple-300 px-6 py-3 rounded-lg font-medium"
          >
            📥 Import Data
          </button>
          <button
            onClick={() => setShowCreateBot(true)}
            className="btn-primary text-white px-6 py-3 rounded-lg font-medium"
            disabled={loading}
          >
            + Create Bot
          </button>
        </div>
      </div>

      {connectedWallet && bots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">Total XRP Earnings</div>
            <div className={`text-3xl font-bold ${globalStats.totalXRPEarnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {globalStats.totalXRPEarnings >= 0 ? '+' : ''}{globalStats.totalXRPEarnings.toFixed(4)} XRP
            </div>
            <div className="text-purple-500 text-xs mt-1">Net profit/loss</div>
          </div>
          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">Total Bots</div>
            <div className="text-3xl font-bold text-purple-200">{globalStats.totalBots}</div>
            <div className="text-purple-500 text-xs mt-1">Created</div>
          </div>
          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">Active Bots</div>
            <div className="text-3xl font-bold text-blue-400">{globalStats.activeBots}</div>
            <div className="text-purple-500 text-xs mt-1">Currently running</div>
          </div>
          <div className="glass rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">Total Fees Paid</div>
            <div className="text-3xl font-bold text-orange-400">{globalStats.totalFees.toFixed(4)} XRP</div>
            <div className="text-purple-500 text-xs mt-1">{TRADING_FEE} XRP per trade</div>
          </div>
        </div>
      )}

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
          <p className="text-purple-300">Loading bots...</p>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {bots.map(bot => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map(bot => (
            <BotCard key={bot.id} bot={bot} isListView />
          ))}
        </div>
      )}

      {!loading && bots.length === 0 && connectedWallet && (
        <div className="glass rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-2xl font-bold text-purple-200 mb-2">No Trading Bots Yet</h3>
          <p className="text-purple-400 mb-6">
            Create your first automated trading bot to start trading
          </p>
        </div>
      )}

      {showCreateBot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-purple-200">Create Trading Bot</h3>

            <div>
              <label className="block text-purple-300 mb-2">Bot Name *</label>
              <input
                type="text"
                value={newBot.name}
                onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                className="input w-full"
                placeholder="My Trading Bot"
              />
            </div>

            <div>
              <label className="block text-purple-300 mb-2">Select Token *</label>
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
              <label className="block text-purple-300 mb-2">Trade Interval (minutes)</label>
              <input
                type="number"
                value={newBot.interval}
                onChange={(e) => setNewBot({ ...newBot, interval: Math.max(1, parseInt(e.target.value) || 1) })}
                className="input w-full"
                min="1"
                max="1440"
              />
              <div className="text-purple-400 text-xs mt-1">Minimum: 1 minute</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-purple-300 mb-2">Min Amount (XRP)</label>
                <input
                  type="number"
                  value={newBot.minAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setNewBot({ ...newBot, minAmount: isNaN(value) ? 0.1 : value });
                  }}
                  className="input w-full"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-purple-300 mb-2">Max Amount (XRP)</label>
                <input
                  type="number"
                  value={newBot.maxAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setNewBot({ ...newBot, maxAmount: isNaN(value) ? 1 : value });
                  }}
                  className="input w-full"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-purple-300 mb-2">
                Trade Mode: <span className={getTradeModeColor(newBot.tradeMode)}>{getTradeModeLabel(newBot.tradeMode)}</span>
              </label>
              <input
                type="range"
                value={newBot.tradeMode}
                onChange={(e) => setNewBot({ ...newBot, tradeMode: parseInt(e.target.value) })}
                className="w-full"
                min="0"
                max="100"
              />
              <div className="flex justify-between text-xs text-purple-400 mt-1">
                <span>Sell</span>
                <span>Neutral</span>
                <span>Buy</span>
              </div>
            </div>

            <div>
              <label className="block text-purple-300 mb-2">Slippage Tolerance: {newBot.slippage}%</label>
              <input
                type="range"
                value={newBot.slippage}
                onChange={(e) => setNewBot({ ...newBot, slippage: parseFloat(e.target.value) })}
                className="w-full"
                min="0.1"
                max="20"
                step="0.1"
              />
              <div className="flex justify-between text-xs text-purple-400 mt-1">
                <span>0.1%</span>
                <span>5%</span>
                <span>20%</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={createBot}
                className="flex-1 btn-primary text-white px-6 py-3 rounded-lg font-medium"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Bot'}
              </button>
              <button
                onClick={() => setShowCreateBot(false)}
                className="flex-1 btn text-purple-300 px-6 py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
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

      {Object.entries(botProgress).map(([botId, progress]) => {
        if (!progress.show) return null;
        const progressPercent = (progress.step / progress.totalSteps) * 100;

        return (
          <div key={botId} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="glass rounded-lg max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🤖</div>
                <h3 className="text-2xl font-bold text-purple-200 mb-2">
                  {progress.action} {progress.tokenName}
                </h3>
                <p className="text-purple-400">
                  {progress.action === 'BUYING' ? `${progress.xrp} XRP → ${progress.amount}` : `${progress.amount} → ${progress.xrp} XRP`} {progress.tokenName}
                </p>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-purple-400 mb-2">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="w-full bg-purple-900/30 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${progress.step >= 1 ? 'bg-green-500/10' : 'bg-purple-500/10'}`}>
                  <div className={`text-2xl ${progress.step >= 1 ? 'text-green-400' : 'text-purple-400'}`}>
                    {progress.step >= 1 ? '✓' : '⏳'}
                  </div>
                  <div className="flex-1">
                    <div className="text-purple-200 font-medium">Connecting to XRPL</div>
                    <div className="text-purple-400 text-sm">Establishing network connection</div>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${progress.step >= 2 ? 'bg-green-500/10' : 'bg-purple-500/10'}`}>
                  <div className={`text-2xl ${progress.step >= 2 ? 'text-green-400' : 'text-purple-400'}`}>
                    {progress.step >= 2 ? '✓' : '⏳'}
                  </div>
                  <div className="flex-1">
                    <div className="text-purple-200 font-medium">{progress.action === 'BUYING' ? 'Buying' : 'Selling'} Token</div>
                    <div className="text-purple-400 text-sm">{progress.status}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
