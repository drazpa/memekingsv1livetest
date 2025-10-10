import { createClient } from 'npm:@supabase/supabase-js@2.74.0';
import * as xrpl from 'npm:xrpl@4.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Bot {
  id: string;
  name: string;
  wallet_address: string;
  token_id: string;
  status: string;
  strategy: string;
  interval: number;
  min_amount: number;
  max_amount: number;
  slippage: number;
  trade_mode: number;
  last_trade_time: string | null;
  next_trade_time: string | null;
}

interface Token {
  id: string;
  currency_code: string;
  issuer_address: string;
  token_name: string;
}

interface Wallet {
  address: string;
  seed: string;
}

function getRandomAmount(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function sanitizeXRP(amount: number): string {
  return Math.floor(amount * 1000000) / 1000000 + '';
}

function sanitizeToken(amount: number): string {
  const amountStr = amount.toFixed(15);
  return amountStr.replace(/\.?0+$/, '') || '0';
}

function determineNextAction(bot: Bot, poolData: any): string {
  const random = Math.random() * 100;
  const buyProbability = bot.trade_mode || 50;
  
  if (bot.strategy === 'accumulate') {
    return random < 75 ? 'BUY' : 'SELL';
  } else if (bot.strategy === 'distribute') {
    return random < 25 ? 'BUY' : 'SELL';
  } else {
    return random < buyProbability ? 'BUY' : 'SELL';
  }
}

async function fetchPoolData(token: Token, client: xrpl.Client): Promise<any> {
  try {
    const response = await client.request({
      command: 'amm_info',
      asset: { currency: 'XRP' },
      asset2: {
        currency: token.currency_code.length > 3
          ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
          : token.currency_code,
        issuer: token.issuer_address,
      },
    });

    if (response.result?.amm) {
      const amm = response.result.amm;
      const xrpAmount = parseFloat(amm.amount);
      const tokenAmount = parseFloat(amm.amount2.value);
      const price = xrpAmount / tokenAmount;
      return { price, xrpAmount, tokenAmount };
    }
    return null;
  } catch (error) {
    console.error('Error fetching pool data:', error);
    return null;
  }
}

async function executeTrade(bot: Bot, token: Token, wallet: Wallet, supabase: any) {
  let client: xrpl.Client | null = null;
  
  try {
    console.log(`[${bot.name}] Executing trade...`);
    
    client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    
    const poolData = await fetchPoolData(token, client);
    if (!poolData) {
      console.log(`[${bot.name}] No pool data for ${token.token_name}`);
      await client.disconnect();
      return;
    }
    
    const action = determineNextAction(bot, poolData);
    const isBuy = action === 'BUY';
    const xrpAmount = getRandomAmount(bot.min_amount, bot.max_amount);
    const currentPrice = poolData.price;
    const estimatedTokenAmount = xrpAmount / currentPrice;
    
    const accountInfo = await client.request({
      command: 'account_info',
      account: wallet.address,
      ledger_index: 'validated',
    });
    
    const xrpBalance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
    const reserve = 10;
    
    if (isBuy) {
      const maxXRPNeeded = xrpAmount * (1 + parseFloat(bot.slippage.toString()) / 100) + 1;
      const availableXRP = xrpBalance - reserve;
      
      if (availableXRP < maxXRPNeeded) {
        console.log(`[${bot.name}] Insufficient XRP: need ${maxXRPNeeded}, have ${availableXRP}`);
        await supabase.from('trading_bots').update({
          last_error: `Insufficient XRP (need ${maxXRPNeeded.toFixed(2)}, have ${availableXRP.toFixed(2)})`,
          last_error_at: new Date().toISOString(),
          status: 'paused'
        }).eq('id', bot.id);
        await client.disconnect();
        return;
      }
    } else {
      const currencyHex = token.currency_code.length > 3
        ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
        : token.currency_code;
      
      const accountLines = await client.request({
        command: 'account_lines',
        account: wallet.address,
        ledger_index: 'validated',
      });
      
      const trustLine = accountLines.result.lines?.find(
        (line: any) => line.currency === currencyHex && line.account === token.issuer_address
      );
      
      const currentTokenBalance = trustLine ? parseFloat(trustLine.balance) : 0;
      const tokenNeeded = estimatedTokenAmount * (1 + parseFloat(bot.slippage.toString()) / 100);
      
      if (currentTokenBalance < tokenNeeded) {
        console.log(`[${bot.name}] Insufficient tokens: need ${tokenNeeded}, have ${currentTokenBalance}`);
        await supabase.from('trading_bots').update({
          last_error: `Insufficient ${token.token_name} (need ${tokenNeeded.toFixed(4)}, have ${currentTokenBalance.toFixed(4)})`,
          last_error_at: new Date().toISOString(),
          status: 'paused'
        }).eq('id', bot.id);
        await client.disconnect();
        return;
      }
    }
    
    const xrplWallet = xrpl.Wallet.fromSeed(wallet.seed);
    const currencyHex = token.currency_code.length > 3
      ? Buffer.from(token.currency_code, 'utf8').toString('hex').toUpperCase().padEnd(40, '0')
      : token.currency_code;
    
    const slippageMultiplier = 1 + (parseFloat(bot.slippage.toString()) / 100);
    
    let payment: any;
    if (isBuy) {
      const tokenAmountValue = parseFloat(estimatedTokenAmount.toString()) / slippageMultiplier;
      const xrpAmountValue = parseFloat(xrpAmount.toString()) * slippageMultiplier;
      
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: {
          currency: currencyHex,
          issuer: token.issuer_address,
          value: sanitizeToken(tokenAmountValue),
        },
        SendMax: xrpl.xrpToDrops(sanitizeXRP(xrpAmountValue)),
      };
    } else {
      const tokenAmountValue = parseFloat(estimatedTokenAmount.toString()) * slippageMultiplier;
      const xrpAmountValue = parseFloat(xrpAmount.toString()) / slippageMultiplier;
      
      payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: wallet.address,
        Amount: xrpl.xrpToDrops(sanitizeXRP(xrpAmountValue)),
        SendMax: {
          currency: currencyHex,
          issuer: token.issuer_address,
          value: sanitizeToken(tokenAmountValue),
        },
      };
    }
    
    const prepared = await client.autofill(payment);
    const signed = xrplWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob, { timeout: 60000 });
    
    if (result.result.meta.TransactionResult === 'tesSUCCESS') {
      const actualAmount = isBuy
        ? parseFloat(result.result.meta.delivered_amount?.value || estimatedTokenAmount)
        : estimatedTokenAmount;
      
      const txHash = result.result.hash;
      
      await supabase.from('bot_trades').insert([{
        bot_id: bot.id,
        trade_type: isBuy ? 'BUY' : 'SELL',
        token_amount: actualAmount,
        xrp_amount: xrpAmount,
        price: currentPrice,
        tx_hash: txHash,
        status: 'success'
      }]);
      
      const totalTrades = (bot as any).total_trades || 0;
      const successfulTrades = (bot as any).successful_trades || 0;
      const totalXrpSpent = isBuy ? ((bot as any).total_xrp_spent || 0) + xrpAmount : (bot as any).total_xrp_spent || 0;
      const totalXrpReceived = isBuy ? (bot as any).total_xrp_received || 0 : ((bot as any).total_xrp_received || 0) + xrpAmount;
      const totalTokensEarned = isBuy ? ((bot as any).total_tokens_earned || 0) + actualAmount : (bot as any).total_tokens_earned || 0;
      const totalTokensSpent = isBuy ? (bot as any).total_tokens_spent || 0 : ((bot as any).total_tokens_spent || 0) + actualAmount;
      
      const nextTradeTime = new Date(Date.now() + bot.interval * 60 * 1000).toISOString();
      
      await supabase.from('trading_bots').update({
        total_trades: totalTrades + 1,
        successful_trades: successfulTrades + 1,
        last_trade_time: new Date().toISOString(),
        next_trade_time: nextTradeTime,
        total_xrp_spent: totalXrpSpent,
        total_xrp_received: totalXrpReceived,
        total_tokens_earned: totalTokensEarned,
        total_tokens_spent: totalTokensSpent,
        net_profit: totalXrpReceived - totalXrpSpent,
        last_error: null,
        last_error_at: null
      }).eq('id', bot.id);
      
      console.log(`[${bot.name}] ✅ Trade executed: ${isBuy ? 'BUY' : 'SELL'} ${actualAmount.toFixed(4)} ${token.token_name} for ${xrpAmount} XRP`);
    } else {
      throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
    }
    
    await client.disconnect();
    
  } catch (error: any) {
    console.error(`[${bot.name}] ❌ Trade error:`, error);
    
    const errorMessage = error.message || error.toString();
    let errorMsg = 'Trade failed';
    let shouldPause = false;
    
    if (errorMessage.includes('tecPATH_PARTIAL')) {
      errorMsg = `Slippage too low (${bot.slippage}%)`;
      shouldPause = bot.slippage >= 25;
    } else if (errorMessage.includes('tecUNFUNDED')) {
      errorMsg = 'Insufficient funds';
      shouldPause = true;
    }
    
    await supabase.from('trading_bots').update({
      failed_trades: ((bot as any).failed_trades || 0) + 1,
      last_error: errorMsg,
      last_error_at: new Date().toISOString(),
      status: shouldPause ? 'paused' : bot.status
    }).eq('id', bot.id);
    
    if (client) {
      try {
        await client.disconnect();
      } catch (e) {
        console.error('Error disconnecting client:', e);
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 30000);
    const nowISO = bufferTime.toISOString();
    
    console.log(`🤖 Bot executor running at ${now.toISOString()}, checking for trades due before ${nowISO}`);
    
    const { data: runningBots, error: botsError } = await supabase
      .from('trading_bots')
      .select('*, tokens(*), wallets(*)')
      .eq('status', 'running')
      .or(`next_trade_time.is.null,next_trade_time.lte.${nowISO}`);
    
    if (botsError) {
      console.error('❌ Error fetching bots:', botsError);
      throw botsError;
    }
    
    console.log(`📊 Found ${runningBots?.length || 0} running bots ready to trade`);
    
    if (!runningBots || runningBots.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No bots ready to trade',
        executed: 0,
        checkedAt: now.toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    const results = [];
    
    for (const bot of runningBots) {
      if (!bot.tokens || !bot.wallets) {
        console.error(`❌ Bot ${bot.id} missing token or wallet data`);
        continue;
      }
      
      try {
        await executeTrade(bot, bot.tokens, bot.wallets, supabase);
        results.push({ botId: bot.id, botName: bot.name, status: 'success' });
      } catch (error) {
        console.error(`❌ Failed to execute trade for bot ${bot.id}:`, error);
        results.push({ botId: bot.id, botName: bot.name, status: 'error', error: error.message });
      }
    }
    
    console.log(`✅ Bot executor completed: ${results.filter(r => r.status === 'success').length}/${results.length} trades executed`);
    
    return new Response(JSON.stringify({
      success: true,
      executed: results.filter(r => r.status === 'success').length,
      total: results.length,
      results,
      checkedAt: now.toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error: any) {
    console.error('❌ Bot executor error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});