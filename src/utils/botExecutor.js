import { supabase } from './supabase';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';

let executorInterval = null;
let isExecuting = false;
let currentWalletAddress = null;

export const startGlobalBotExecutor = (walletAddress) => {
  if (executorInterval) {
    console.log('Bot executor already running');
    return;
  }

  currentWalletAddress = walletAddress;
  console.log('🤖 Starting global bot executor for wallet:', walletAddress);

  executorInterval = setInterval(async () => {
    if (isExecuting) {
      console.log('⏭️  Skipping execution - previous execution still running');
      return;
    }

    isExecuting = true;
    try {
      await executeReadyBots(walletAddress);
    } catch (error) {
      console.error('Error in bot executor:', error);
    } finally {
      isExecuting = false;
    }
  }, 5000);

  const botsSubscription = supabase
    .channel('global_bot_executor')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'trading_bots',
      filter: `wallet_address=eq.${walletAddress}`
    }, (payload) => {
      console.log('🔔 Bot update received:', payload.eventType);
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        if (payload.new.status === 'running') {
          setTimeout(() => executeReadyBots(walletAddress), 1000);
        }
      }
    })
    .subscribe();

  window.__botExecutorSubscription = botsSubscription;

  console.log('✅ Global bot executor started');
};

export const stopGlobalBotExecutor = () => {
  if (executorInterval) {
    clearInterval(executorInterval);
    executorInterval = null;
    console.log('🛑 Global bot executor stopped');
  }

  if (window.__botExecutorSubscription) {
    window.__botExecutorSubscription.unsubscribe();
    window.__botExecutorSubscription = null;
  }

  isExecuting = false;
  currentWalletAddress = null;
};

const executeReadyBots = async (walletAddress) => {
  try {
    const { data: bots, error } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('status', 'running');

    if (error) throw error;
    if (!bots || bots.length === 0) return;

    const now = new Date();

    for (const bot of bots) {
      if (!bot.next_trade_time) {
        console.log(`🔄 Bot ${bot.name} has no next_trade_time, scheduling first trade`);
        const nextTime = new Date(Date.now() + (bot.interval * 60 * 1000));
        await supabase
          .from('trading_bots')
          .update({ next_trade_time: nextTime.toISOString() })
          .eq('id', bot.id);
        continue;
      }

      const nextTradeTime = new Date(bot.next_trade_time);
      if (now >= nextTradeTime) {
        console.log(`⏰ Executing bot: ${bot.name}`);
        await executeBotTrade(bot);
      }
    }
  } catch (error) {
    console.error('Error executing ready bots:', error);
  }
};

const executeBotTrade = async (bot) => {
  try {
    await supabase
      .from('trading_bots')
      .update({ last_execution_attempt: new Date().toISOString() })
      .eq('id', bot.id);

    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('address', bot.wallet_address)
      .maybeSingle();

    if (!wallet || !wallet.seed) {
      console.error('Wallet not found or missing seed');
      return;
    }

    const { data: token } = await supabase
      .from('meme_tokens')
      .select('*')
      .eq('id', bot.token_id)
      .maybeSingle();

    if (!token) {
      console.error('Token not found');
      return;
    }

    const { data: poolCache } = await supabase
      .from('pool_data_cache')
      .select('*')
      .eq('token_id', token.id)
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!poolCache) {
      console.error('No pool data available');
      return;
    }

    const isBuy = Math.random() * 100 < bot.trade_mode;
    const amount = bot.min_amount + Math.random() * (bot.max_amount - bot.min_amount);

    const client = new xrpl.Client(
      wallet.network === 'mainnet'
        ? 'wss://xrplcluster.com'
        : 'wss://s.altnet.rippletest.net:51233'
    );

    await client.connect();

    const xrplWallet = xrpl.Wallet.fromSeed(wallet.seed);
    const currencyHex = token.currency_code.length > 3
      ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
      : token.currency_code;

    const tx = isBuy
      ? {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: wallet.address,
          Amount: {
            currency: currencyHex,
            value: amount.toFixed(6),
            issuer: token.issuer_address
          },
          SendMax: xrpl.xrpToDrops((amount * parseFloat(poolCache.price) * (1 + bot.slippage / 100)).toFixed(6)),
          Paths: [[{
            account: token.issuer_address,
            type: 1
          }]]
        }
      : {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: wallet.address,
          Amount: xrpl.xrpToDrops((amount * parseFloat(poolCache.price) * (1 - bot.slippage / 100)).toFixed(6)),
          SendMax: {
            currency: currencyHex,
            value: amount.toFixed(6),
            issuer: token.issuer_address
          },
          Paths: [[{
            account: token.issuer_address,
            type: 1
          }]]
        };

    const prepared = await client.autofill(tx);
    const signed = xrplWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    const success = result.result.meta.TransactionResult === 'tesSUCCESS';

    const xrpAmount = isBuy
      ? (parseFloat(result.result.DeliveredAmount || 0) / 1000000)
      : amount * parseFloat(poolCache.price);
    const tokenAmount = isBuy ? amount : 0;

    await supabase.from('bot_trades').insert({
      bot_id: bot.id,
      wallet_address: bot.wallet_address,
      token_id: bot.token_id,
      trade_type: isBuy ? 'buy' : 'sell',
      xrp_amount: xrpAmount,
      token_amount: tokenAmount,
      price: parseFloat(poolCache.price),
      success,
      tx_hash: result.result.hash
    });

    const updates = {
      total_trades: (bot.total_trades || 0) + 1,
      successful_trades: (bot.successful_trades || 0) + (success ? 1 : 0),
      last_trade_time: new Date().toISOString(),
      next_trade_time: new Date(Date.now() + (bot.interval * 60 * 1000)).toISOString()
    };

    if (isBuy && success) {
      updates.total_xrp_spent = (parseFloat(bot.total_xrp_spent || 0) + xrpAmount).toString();
      updates.total_token_received = (parseFloat(bot.total_token_received || 0) + tokenAmount).toString();
      updates.token_balance = (parseFloat(bot.token_balance || 0) + tokenAmount).toString();
    } else if (!isBuy && success) {
      updates.total_xrp_received = (parseFloat(bot.total_xrp_received || 0) + xrpAmount).toString();
      updates.total_token_spent = (parseFloat(bot.total_token_spent || 0) + tokenAmount).toString();
      updates.token_balance = (parseFloat(bot.token_balance || 0) - tokenAmount).toString();
    }

    const netProfit = (parseFloat(updates.total_xrp_received || bot.total_xrp_received || 0) -
                       parseFloat(updates.total_xrp_spent || bot.total_xrp_spent || 0));
    updates.net_profit = netProfit.toFixed(6);

    await supabase
      .from('trading_bots')
      .update(updates)
      .eq('id', bot.id);

    console.log(`✅ Bot ${bot.name} trade executed: ${isBuy ? 'BUY' : 'SELL'} ${amount.toFixed(4)} @ ${xrpAmount.toFixed(6)} XRP`);
  } catch (error) {
    console.error(`❌ Error executing bot ${bot.name}:`, error);

    await supabase
      .from('trading_bots')
      .update({
        last_error: error.message,
        last_error_time: new Date().toISOString(),
        next_trade_time: new Date(Date.now() + (bot.interval * 60 * 1000)).toISOString()
      })
      .eq('id', bot.id);
  }
};
