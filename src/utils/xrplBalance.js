import { requestWithRetry } from './xrplClient';

const balanceCache = new Map();
const CACHE_DURATION = 10000;

export async function getXRPBalance(address, useCache = true) {
  if (!address) return 0;

  if (useCache && balanceCache.has(address)) {
    const cached = balanceCache.get(address);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.balance;
    }
  }

  try {
    const response = await requestWithRetry({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    const balance = parseFloat(response.result.account_data.Balance) / 1000000;

    balanceCache.set(address, {
      balance,
      timestamp: Date.now()
    });

    return balance;
  } catch (error) {
    if (error.data?.error === 'actNotFound') {
      balanceCache.set(address, {
        balance: 0,
        timestamp: Date.now()
      });
      return 0;
    }

    console.error('Error fetching XRP balance:', error);

    const errorMessage = error.message?.includes('timeout')
      ? 'Connection to XRPL network timed out'
      : error.message?.includes('disconnect')
      ? 'Lost connection to XRPL network'
      : error.message || 'Failed to fetch balance from XRPL';

    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

export async function checkWalletFunded(address, minBalance = 2) {
  try {
    const balance = await getXRPBalance(address);
    return {
      isFunded: balance >= minBalance,
      balance,
      minBalance
    };
  } catch (error) {
    return {
      isFunded: false,
      balance: 0,
      minBalance,
      error: error.message
    };
  }
}
