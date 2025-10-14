import * as xrpl from 'xrpl';
import { supabase } from './supabase';
import { logActivity, ACTION_TYPES } from './activityLogger';
import { sendTradingFee } from './tradeFees';
import { Buffer } from 'buffer';

export class CommandExecutor {
  constructor() {
    this.wallet = null;
    this.client = null;
  }

  setWallet(wallet) {
    this.wallet = wallet;
  }

  async connect() {
    if (!this.client || !this.client.isConnected()) {
      this.client = new xrpl.Client('wss://xrplcluster.com');
      await this.client.connect();
    }
    return this.client;
  }

  async disconnect() {
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
    }
  }

  parseCommand(input) {
    const normalizedInput = input.toLowerCase().trim();

    const sendMatch = normalizedInput.match(/send\s+([rR][a-zA-Z0-9]{24,34})\s+(\d+(?:\.\d+)?)\s+xrp/);
    if (sendMatch) {
      return {
        type: 'SEND_XRP',
        destination: sendMatch[1],
        amount: parseFloat(sendMatch[2])
      };
    }

    const sendTokenMatch = normalizedInput.match(/send\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+(?:to\s+)?([rR][a-zA-Z0-9]{24,34})/);
    if (sendTokenMatch) {
      return {
        type: 'SEND_TOKEN',
        amount: parseFloat(sendTokenMatch[1]),
        token: sendTokenMatch[2].toUpperCase(),
        destination: sendTokenMatch[3]
      };
    }

    const buyMatch = normalizedInput.match(/buy\s+(\d+(?:\.\d+)?)\s+([a-z]+)/);
    if (buyMatch) {
      return {
        type: 'BUY_TOKEN',
        amount: parseFloat(buyMatch[1]),
        token: buyMatch[2].toUpperCase()
      };
    }

    const sellMatch = normalizedInput.match(/sell\s+(\d+(?:\.\d+)?)\s+([a-z]+)/);
    if (sellMatch) {
      return {
        type: 'SELL_TOKEN',
        amount: parseFloat(sellMatch[1]),
        token: sellMatch[2].toUpperCase()
      };
    }

    const balanceMatch = normalizedInput.match(/(?:check|show|what(?:'s| is)?|get)\s+(?:my\s+)?balance/);
    if (balanceMatch) {
      return { type: 'CHECK_BALANCE' };
    }

    const tokenInfoMatch = normalizedInput.match(/(?:info|information|details|about)\s+(?:about\s+)?([a-z]+)/);
    if (tokenInfoMatch) {
      return {
        type: 'TOKEN_INFO',
        token: tokenInfoMatch[1].toUpperCase()
      };
    }

    const priceMatch = normalizedInput.match(/(?:price|cost)\s+(?:of\s+)?([a-z]+)/);
    if (priceMatch) {
      return {
        type: 'TOKEN_PRICE',
        token: priceMatch[1].toUpperCase()
      };
    }

    const trustlineMatch = normalizedInput.match(/(?:setup|create|add)\s+trustline\s+(?:for\s+)?([a-z]+)/);
    if (trustlineMatch) {
      return {
        type: 'SETUP_TRUSTLINE',
        token: trustlineMatch[1].toUpperCase()
      };
    }

    return { type: 'UNKNOWN', input };
  }

  async executeCommand(parsedCommand) {
    if (!this.wallet) {
      return {
        success: false,
        message: 'Please connect your wallet first to execute commands.',
        requiresWallet: true
      };
    }

    try {
      await this.connect();

      switch (parsedCommand.type) {
        case 'SEND_XRP':
          return await this.executeSendXRP(parsedCommand);

        case 'SEND_TOKEN':
          return await this.executeSendToken(parsedCommand);

        case 'BUY_TOKEN':
          return await this.executeBuyToken(parsedCommand);

        case 'SELL_TOKEN':
          return await this.executeSellToken(parsedCommand);

        case 'CHECK_BALANCE':
          return await this.executeCheckBalance();

        case 'TOKEN_INFO':
          return await this.executeTokenInfo(parsedCommand);

        case 'TOKEN_PRICE':
          return await this.executeTokenPrice(parsedCommand);

        case 'SETUP_TRUSTLINE':
          return await this.executeSetupTrustline(parsedCommand);

        default:
          return {
            success: false,
            message: `I couldn't understand that command. Try:\n• "SEND Rxxx... 15 XRP"\n• "BUY 1000 ORANGE"\n• "SELL 500 BANANA"\n• "CHECK BALANCE"\n• "PRICE OF BANANA"`
          };
      }
    } catch (error) {
      console.error('Command execution error:', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
        error: error.message
      };
    }
  }

  async executeSendXRP({ destination, amount }) {
    try {
      const payment = {
        TransactionType: 'Payment',
        Account: this.wallet.address,
        Destination: destination,
        Amount: xrpl.xrpToDrops(amount.toString())
      };

      const prepared = await this.client.autofill(payment);
      const wallet = xrpl.Wallet.fromSeed(this.wallet.seed);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        await logActivity({
          userAddress: this.wallet.address,
          actionType: ACTION_TYPES.XRP_SENT,
          description: `Sent ${amount} XRP to ${destination}`,
          txHash: result.result.hash
        });

        return {
          success: true,
          message: `Successfully sent ${amount} XRP to ${destination}!`,
          txHash: result.result.hash,
          data: {
            amount,
            destination,
            fee: (parseFloat(result.result.Fee) / 1000000).toFixed(6)
          }
        };
      } else {
        return {
          success: false,
          message: `Transaction failed: ${result.result.meta.TransactionResult}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to send XRP: ${error.message}`
      };
    }
  }

  async executeSendToken({ amount, token, destination }) {
    try {
      const { data: tokenData } = await supabase
        .from('meme_tokens')
        .select('*')
        .ilike('currency_code', token)
        .single();

      if (!tokenData) {
        return {
          success: false,
          message: `Token "${token}" not found. Please check the token name.`
        };
      }

      const currencyHex = Buffer.from(tokenData.currency_code, 'utf8')
        .toString('hex')
        .toUpperCase()
        .padEnd(40, '0');

      const payment = {
        TransactionType: 'Payment',
        Account: this.wallet.address,
        Destination: destination,
        Amount: {
          currency: currencyHex,
          issuer: tokenData.issuer_address,
          value: amount.toString()
        }
      };

      const prepared = await this.client.autofill(payment);
      const wallet = xrpl.Wallet.fromSeed(this.wallet.seed);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        await logActivity({
          userAddress: this.wallet.address,
          actionType: ACTION_TYPES.TOKEN_SENT,
          description: `Sent ${amount} ${token} to ${destination}`,
          txHash: result.result.hash,
          tokenId: tokenData.id
        });

        return {
          success: true,
          message: `Successfully sent ${amount} ${token} to ${destination}!`,
          txHash: result.result.hash,
          data: {
            amount,
            token,
            destination
          }
        };
      } else {
        return {
          success: false,
          message: `Transaction failed: ${result.result.meta.TransactionResult}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to send token: ${error.message}`
      };
    }
  }

  async executeBuyToken({ amount, token }) {
    try {
      const { data: tokenData } = await supabase
        .from('meme_tokens')
        .select('*')
        .ilike('currency_code', token)
        .eq('amm_pool_created', true)
        .single();

      if (!tokenData) {
        return {
          success: false,
          message: `Token "${token}" not found or doesn't have an AMM pool yet.`
        };
      }

      const currentPrice = tokenData.amm_xrp_amount / tokenData.amm_asset_amount;
      const estimatedXRP = amount * currentPrice;
      const slippage = 1.02;
      const maxXRP = estimatedXRP * slippage;

      const currencyHex = Buffer.from(tokenData.currency_code, 'utf8')
        .toString('hex')
        .toUpperCase()
        .padEnd(40, '0');

      const payment = {
        TransactionType: 'Payment',
        Account: this.wallet.address,
        Destination: this.wallet.address,
        Amount: {
          currency: currencyHex,
          issuer: tokenData.issuer_address,
          value: amount.toString()
        },
        SendMax: xrpl.xrpToDrops(maxXRP.toFixed(6)),
        Flags: 131072
      };

      const prepared = await this.client.autofill(payment);
      const wallet = xrpl.Wallet.fromSeed(this.wallet.seed);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob, { timeout: 45000 });

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        const actualAmount = result.result.meta.delivered_amount?.value
          ? parseFloat(result.result.meta.delivered_amount.value)
          : amount;

        await sendTradingFee(this.client, wallet);

        const { data: tradeData } = await supabase
          .from('trade_history')
          .insert({
            token_id: tokenData.id,
            trader_address: this.wallet.address,
            trade_type: 'buy',
            token_amount: actualAmount,
            xrp_amount: estimatedXRP,
            price: currentPrice,
            tx_hash: result.result.hash,
            slippage: 2.0
          })
          .select()
          .single();

        await logActivity({
          userAddress: this.wallet.address,
          actionType: ACTION_TYPES.SWAP_EXECUTED,
          description: `Bought ${actualAmount.toFixed(4)} ${token}`,
          txHash: result.result.hash,
          tokenId: tokenData.id
        });

        return {
          success: true,
          message: `Successfully bought ${actualAmount.toFixed(4)} ${token} for approximately ${estimatedXRP.toFixed(4)} XRP!`,
          txHash: result.result.hash,
          data: {
            token,
            amount: actualAmount,
            xrpSpent: estimatedXRP,
            price: currentPrice
          }
        };
      } else {
        return {
          success: false,
          message: `Buy transaction failed: ${result.result.meta.TransactionResult}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to buy token: ${error.message}`
      };
    }
  }

  async executeSellToken({ amount, token }) {
    try {
      const { data: tokenData } = await supabase
        .from('meme_tokens')
        .select('*')
        .ilike('currency_code', token)
        .eq('amm_pool_created', true)
        .single();

      if (!tokenData) {
        return {
          success: false,
          message: `Token "${token}" not found or doesn't have an AMM pool yet.`
        };
      }

      const currentPrice = tokenData.amm_xrp_amount / tokenData.amm_asset_amount;
      const estimatedXRP = amount * currentPrice;
      const slippage = 0.98;
      const minXRP = estimatedXRP * slippage;

      const currencyHex = Buffer.from(tokenData.currency_code, 'utf8')
        .toString('hex')
        .toUpperCase()
        .padEnd(40, '0');

      const payment = {
        TransactionType: 'Payment',
        Account: this.wallet.address,
        Destination: this.wallet.address,
        Amount: xrpl.xrpToDrops(estimatedXRP.toFixed(6)),
        SendMax: {
          currency: currencyHex,
          issuer: tokenData.issuer_address,
          value: (amount * 1.02).toString()
        },
        DeliverMin: xrpl.xrpToDrops(minXRP.toFixed(6)),
        Flags: 131072
      };

      const prepared = await this.client.autofill(payment);
      const wallet = xrpl.Wallet.fromSeed(this.wallet.seed);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob, { timeout: 45000 });

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        await sendTradingFee(this.client, wallet);

        await supabase
          .from('trade_history')
          .insert({
            token_id: tokenData.id,
            trader_address: this.wallet.address,
            trade_type: 'sell',
            token_amount: amount,
            xrp_amount: estimatedXRP,
            price: currentPrice,
            tx_hash: result.result.hash,
            slippage: 2.0
          });

        await logActivity({
          userAddress: this.wallet.address,
          actionType: ACTION_TYPES.SWAP_EXECUTED,
          description: `Sold ${amount.toFixed(4)} ${token}`,
          txHash: result.result.hash,
          tokenId: tokenData.id
        });

        return {
          success: true,
          message: `Successfully sold ${amount.toFixed(4)} ${token} for approximately ${estimatedXRP.toFixed(4)} XRP!`,
          txHash: result.result.hash,
          data: {
            token,
            amount,
            xrpReceived: estimatedXRP,
            price: currentPrice
          }
        };
      } else {
        return {
          success: false,
          message: `Sell transaction failed: ${result.result.meta.TransactionResult}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to sell token: ${error.message}`
      };
    }
  }

  async executeCheckBalance() {
    try {
      const accountInfo = await this.client.request({
        command: 'account_info',
        account: this.wallet.address,
        ledger_index: 'validated'
      });

      const balance = parseFloat(xrpl.dropsToXrp(accountInfo.result.account_data.Balance));
      const reserve = 10 + (accountInfo.result.account_data.OwnerCount * 2);

      const accountLines = await this.client.request({
        command: 'account_lines',
        account: this.wallet.address,
        ledger_index: 'validated'
      });

      const tokenBalances = accountLines.result.lines.map(line => ({
        currency: line.currency.length > 3
          ? Buffer.from(line.currency, 'hex').toString('utf8').replace(/\0/g, '')
          : line.currency,
        balance: parseFloat(line.balance),
        issuer: line.account
      })).filter(t => t.balance > 0);

      return {
        success: true,
        message: `Your XRP balance is ${balance.toFixed(6)} XRP (${(balance - reserve).toFixed(6)} available)`,
        data: {
          xrpBalance: balance,
          xrpAvailable: balance - reserve,
          reserve,
          tokenBalances
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to check balance: ${error.message}`
      };
    }
  }

  async executeTokenInfo({ token }) {
    try {
      const { data: tokenData } = await supabase
        .from('meme_tokens')
        .select('*')
        .ilike('currency_code', token)
        .single();

      if (!tokenData) {
        return {
          success: false,
          message: `Token "${token}" not found.`
        };
      }

      const price = tokenData.amm_pool_created
        ? tokenData.amm_xrp_amount / tokenData.amm_asset_amount
        : 0;

      const marketCap = tokenData.supply * price;

      return {
        success: true,
        message: `${tokenData.token_name} (${tokenData.currency_code})\n\nPrice: ${price.toFixed(8)} XRP\nSupply: ${tokenData.supply.toLocaleString()}\nMarket Cap: ${marketCap.toFixed(2)} XRP\nLiquidity: ${(tokenData.amm_xrp_amount || 0).toFixed(2)} XRP\nPool: ${tokenData.amm_pool_created ? 'Active' : 'Not created'}`,
        data: {
          ...tokenData,
          price,
          marketCap
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get token info: ${error.message}`
      };
    }
  }

  async executeTokenPrice({ token }) {
    try {
      const { data: tokenData } = await supabase
        .from('meme_tokens')
        .select('*')
        .ilike('currency_code', token)
        .eq('amm_pool_created', true)
        .single();

      if (!tokenData) {
        return {
          success: false,
          message: `Token "${token}" not found or doesn't have an active pool.`
        };
      }

      const price = tokenData.amm_xrp_amount / tokenData.amm_asset_amount;

      const { data: tradeData } = await supabase
        .from('trade_history')
        .select('created_at, price')
        .eq('token_id', tokenData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      let change24h = 0;
      if (tokenData.initial_xrp_amount && tokenData.initial_asset_amount) {
        const initialPrice = tokenData.initial_xrp_amount / tokenData.initial_asset_amount;
        change24h = ((price - initialPrice) / initialPrice) * 100;
      }

      return {
        success: true,
        message: `${token} is currently trading at ${price.toFixed(8)} XRP${change24h !== 0 ? ` (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% 24h)` : ''}`,
        data: {
          token,
          price,
          change24h,
          recentTrades: tradeData?.length || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get price: ${error.message}`
      };
    }
  }

  async executeSetupTrustline({ token }) {
    try {
      const { data: tokenData } = await supabase
        .from('meme_tokens')
        .select('*')
        .ilike('currency_code', token)
        .single();

      if (!tokenData) {
        return {
          success: false,
          message: `Token "${token}" not found.`
        };
      }

      const currencyHex = Buffer.from(tokenData.currency_code, 'utf8')
        .toString('hex')
        .toUpperCase()
        .padEnd(40, '0');

      const trustSet = {
        TransactionType: 'TrustSet',
        Account: this.wallet.address,
        LimitAmount: {
          currency: currencyHex,
          issuer: tokenData.issuer_address,
          value: '10000000000'
        }
      };

      const prepared = await this.client.autofill(trustSet);
      const wallet = xrpl.Wallet.fromSeed(this.wallet.seed);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        await logActivity({
          userAddress: this.wallet.address,
          actionType: ACTION_TYPES.TRUSTLINE_ADDED,
          description: `Setup trustline for ${token}`,
          txHash: result.result.hash,
          tokenId: tokenData.id
        });

        return {
          success: true,
          message: `Successfully setup trustline for ${token}! You can now receive and trade this token.`,
          txHash: result.result.hash
        };
      } else {
        return {
          success: false,
          message: `Trustline setup failed: ${result.result.meta.TransactionResult}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to setup trustline: ${error.message}`
      };
    }
  }
}

export const commandExecutor = new CommandExecutor();
