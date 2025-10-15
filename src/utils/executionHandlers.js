import { Client, Wallet, xrpToDrops } from 'xrpl';
import { supabase } from './supabase';
import toast from 'react-hot-toast';

const XRPL_CLIENT_URL = 'wss://s.altnet.rippletest.net:51233';

export async function executeSendXRP(data) {
  const { destinationAddress, amount, memo } = data;

  const walletData = JSON.parse(localStorage.getItem('connectedWallet'));
  if (!walletData || !walletData.seed) {
    throw new Error('No wallet connected or seed not available');
  }

  const client = new Client(XRPL_CLIENT_URL);
  await client.connect();

  try {
    const wallet = Wallet.fromSeed(walletData.seed);

    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destinationAddress,
      Amount: xrpToDrops(amount),
    };

    if (memo) {
      payment.Memos = [{
        Memo: {
          MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
        }
      }];
    }

    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await supabase.from('activity_logs').insert({
      wallet_address: wallet.address,
      action_type: 'send_xrp',
      details: {
        destination: destinationAddress,
        amount: amount,
        memo: memo,
        txHash: result.result.hash
      }
    });

    return {
      status: 'success',
      title: 'XRP Sent Successfully',
      message: `Successfully sent ${amount} XRP to ${destinationAddress.slice(0, 12)}...`,
      transactionHash: result.result.hash,
      data: {
        amount: `${amount} XRP`,
        destination: `${destinationAddress.slice(0, 12)}...`,
        fee: `${parseFloat(result.result.Fee) / 1000000} XRP`,
        ledger: result.result.ledger_index,
        timestamp: new Date().toLocaleString()
      },
      actions: [
        {
          label: 'Send More XRP',
          icon: '📤',
          style: 'secondary',
          onClick: () => window.dispatchEvent(new CustomEvent('sendAIMessage', { detail: 'send XRP' }))
        },
        {
          label: 'Check Balance',
          icon: '💰',
          style: 'secondary',
          onClick: () => window.dispatchEvent(new CustomEvent('sendAIMessage', { detail: 'check my balance' }))
        }
      ]
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to send XRP');
  } finally {
    await client.disconnect();
  }
}

export async function executeSendToken(data) {
  let { destinationAddress, currencyCode, issuerAddress, amount, memo, tokenId } = data;

  if (tokenId) {
    try {
      const tokenData = JSON.parse(tokenId);
      currencyCode = tokenData.code;
      issuerAddress = tokenData.issuer;
    } catch (e) {
      console.error('Failed to parse tokenId:', e);
    }
  }

  const walletData = JSON.parse(localStorage.getItem('connectedWallet'));
  if (!walletData || !walletData.seed) {
    throw new Error('No wallet connected or seed not available');
  }

  const client = new Client(XRPL_CLIENT_URL);
  await client.connect();

  try {
    const wallet = Wallet.fromSeed(walletData.seed);

    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destinationAddress,
      Amount: {
        currency: currencyCode,
        value: amount,
        issuer: issuerAddress
      }
    };

    if (memo) {
      payment.Memos = [{
        Memo: {
          MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
        }
      }];
    }

    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await supabase.from('activity_logs').insert({
      wallet_address: wallet.address,
      action_type: 'send_token',
      details: {
        destination: destinationAddress,
        currency: currencyCode,
        amount: amount,
        issuer: issuerAddress,
        txHash: result.result.hash
      }
    });

    return {
      status: 'success',
      title: 'Token Sent Successfully',
      message: `Successfully sent ${amount} ${currencyCode} to ${destinationAddress.slice(0, 12)}...`,
      transactionHash: result.result.hash,
      data: {
        token: currencyCode,
        amount: `${amount} ${currencyCode}`,
        destination: `${destinationAddress.slice(0, 12)}...`,
        fee: `${parseFloat(result.result.Fee) / 1000000} XRP`,
        ledger: result.result.ledger_index
      },
      actions: [
        {
          label: 'Send More',
          icon: '📤',
          style: 'secondary',
          onClick: () => window.dispatchEvent(new CustomEvent('sendAIMessage', { detail: 'send tokens' }))
        }
      ]
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to send token');
  } finally {
    await client.disconnect();
  }
}

export async function executeSetupTrustline(data) {
  const { currencyCode, issuerAddress, limit } = data;

  const walletData = JSON.parse(localStorage.getItem('connectedWallet'));
  if (!walletData || !walletData.seed) {
    throw new Error('No wallet connected or seed not available');
  }

  const client = new Client(XRPL_CLIENT_URL);
  await client.connect();

  try {
    const wallet = Wallet.fromSeed(walletData.seed);

    const trustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: currencyCode,
        issuer: issuerAddress,
        value: limit || '1000000000'
      }
    };

    const prepared = await client.autofill(trustSet);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await supabase.from('activity_logs').insert({
      wallet_address: wallet.address,
      action_type: 'setup_trustline',
      details: {
        currency: currencyCode,
        issuer: issuerAddress,
        limit: limit,
        txHash: result.result.hash
      }
    });

    return {
      status: 'success',
      title: 'Trustline Created Successfully',
      message: `Trustline for ${currencyCode} has been set up`,
      transactionHash: result.result.hash,
      data: {
        currency: currencyCode,
        issuer: issuerAddress.slice(0, 12) + '...',
        limit: limit || 'Unlimited'
      }
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to setup trustline');
  } finally {
    await client.disconnect();
  }
}

export async function executeBuyToken(data) {
  const { tokenId, amountXRP, slippage } = data;

  const walletData = JSON.parse(localStorage.getItem('connectedWallet'));
  if (!walletData || !walletData.seed) {
    throw new Error('No wallet connected');
  }

  const { data: token, error } = await supabase
    .from('meme_tokens')
    .select('*')
    .eq('id', tokenId)
    .single();

  if (error || !token) {
    throw new Error('Token not found');
  }

  const client = new Client(XRPL_CLIENT_URL);
  await client.connect();

  try {
    const wallet = Wallet.fromSeed(walletData.seed);

    // Check if trustline exists
    const accountLines = await client.request({
      command: 'account_lines',
      account: wallet.address,
      ledger_index: 'validated'
    });

    const hasTrustline = accountLines.result.lines.some(
      line => line.currency === token.currency_code && line.account === token.issuer_address
    );

    // Set up trustline if it doesn't exist
    if (!hasTrustline) {
      const trustSet = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency: token.currency_code,
          issuer: token.issuer_address,
          value: '999999999'
        }
      };

      const preparedTrust = await client.autofill(trustSet);
      const signedTrust = wallet.sign(preparedTrust);
      await client.submitAndWait(signedTrust.tx_blob);
    }

    const offer = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerPays: {
        currency: token.currency_code,
        value: '1000',
        issuer: token.issuer_address
      },
      TakerGets: xrpToDrops(amountXRP)
    };

    const prepared = await client.autofill(offer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await supabase.from('activity_logs').insert({
      wallet_address: wallet.address,
      action_type: 'buy_token',
      details: {
        token: token.token_name,
        amountXRP: amountXRP,
        txHash: result.result.hash
      }
    });

    return {
      status: 'success',
      title: 'Buy Order Placed',
      message: `Successfully placed buy order for ${token.token_name}`,
      transactionHash: result.result.hash,
      data: {
        token: token.token_name,
        spent: `${amountXRP} XRP`,
        slippage: `${slippage}%`
      },
      actions: [
        {
          label: 'View Token',
          icon: '👁️',
          style: 'secondary',
          onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
        }
      ]
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to buy token');
  } finally {
    await client.disconnect();
  }
}

export async function executeSellToken(data) {
  const { tokenId, amountToken, minXRP } = data;

  const walletData = JSON.parse(localStorage.getItem('connectedWallet'));
  if (!walletData || !walletData.seed) {
    throw new Error('No wallet connected');
  }

  const { data: token, error } = await supabase
    .from('meme_tokens')
    .select('*')
    .eq('id', tokenId)
    .single();

  if (error || !token) {
    throw new Error('Token not found');
  }

  const client = new Client(XRPL_CLIENT_URL);
  await client.connect();

  try {
    const wallet = Wallet.fromSeed(walletData.seed);

    // Check if trustline exists
    const accountLines = await client.request({
      command: 'account_lines',
      account: wallet.address,
      ledger_index: 'validated'
    });

    const hasTrustline = accountLines.result.lines.some(
      line => line.currency === token.currency_code && line.account === token.issuer_address
    );

    // Set up trustline if it doesn't exist (needed to receive tokens)
    if (!hasTrustline) {
      const trustSet = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency: token.currency_code,
          issuer: token.issuer_address,
          value: '999999999'
        }
      };

      const preparedTrust = await client.autofill(trustSet);
      const signedTrust = wallet.sign(preparedTrust);
      await client.submitAndWait(signedTrust.tx_blob);
    }

    const offer = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerPays: xrpToDrops(minXRP),
      TakerGets: {
        currency: token.currency_code,
        value: amountToken,
        issuer: token.issuer_address
      }
    };

    const prepared = await client.autofill(offer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await supabase.from('activity_logs').insert({
      wallet_address: wallet.address,
      action_type: 'sell_token',
      details: {
        token: token.token_name,
        amount: amountToken,
        minXRP: minXRP,
        txHash: result.result.hash
      }
    });

    return {
      status: 'success',
      title: 'Sell Order Placed',
      message: `Successfully placed sell order for ${amountToken} ${token.token_name}`,
      transactionHash: result.result.hash,
      data: {
        token: token.token_name,
        amount: `${amountToken} ${token.currency_code}`,
        minReceive: `${minXRP} XRP`
      },
      actions: [
        {
          label: 'View Orders',
          icon: '📊',
          style: 'secondary',
          onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
        }
      ]
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to sell token');
  } finally {
    await client.disconnect();
  }
}

export async function executeCreateTradingBot(data) {
  const { name, strategy, tokenId, buyAmount, sellThreshold, buyThreshold } = data;

  const walletData = JSON.parse(localStorage.getItem('connectedWallet'));
  if (!walletData) {
    throw new Error('No wallet connected');
  }

  try {
    const { data: bot, error } = await supabase
      .from('trading_bots')
      .insert({
        wallet_address: walletData.address,
        name: name,
        strategy: strategy,
        token_id: tokenId,
        buy_amount: parseFloat(buyAmount),
        sell_threshold: parseFloat(sellThreshold),
        buy_threshold: parseFloat(buyThreshold),
        status: 'active',
        last_check: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      status: 'success',
      title: 'Trading Bot Created',
      message: `Bot "${name}" has been created and activated`,
      data: {
        name: name,
        strategy: strategy,
        status: 'Active',
        buyAmount: `${buyAmount} XRP`
      },
      actions: [
        {
          label: 'Manage Bots',
          icon: '⚙️',
          style: 'primary',
          onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'bottrader' }))
        }
      ]
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to create bot');
  }
}
