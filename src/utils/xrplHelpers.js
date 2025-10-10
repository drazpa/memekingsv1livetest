import { requestWithRetry, submitWithRetry, autofillWithRetry, withRetry } from './xrplClient';
import * as xrpl from 'xrpl';

export async function getAccountLines(address) {
  return requestWithRetry({
    command: 'account_lines',
    account: address,
    ledger_index: 'validated'
  });
}

export async function getAccountInfo(address) {
  return requestWithRetry({
    command: 'account_info',
    account: address,
    ledger_index: 'validated'
  });
}

export async function getAMMInfo(asset, asset2) {
  return requestWithRetry({
    command: 'amm_info',
    asset,
    asset2,
    ledger_index: 'validated'
  });
}

export async function getBookOffers(takerGets, takerPays, limit = 10) {
  return requestWithRetry({
    command: 'book_offers',
    taker_gets: takerGets,
    taker_pays: takerPays,
    limit,
    ledger_index: 'validated'
  });
}

export async function submitTransaction(transaction, wallet) {
  const prepared = await autofillWithRetry(transaction);
  const signed = wallet.sign(prepared);

  return submitWithRetry(signed.tx_blob, wallet);
}

export async function waitForTransaction(txHash, maxAttempts = 10) {
  return withRetry(async (client) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await client.request({
          command: 'tx',
          transaction: txHash
        });

        if (response.result.validated) {
          return response.result;
        }
      } catch (error) {
        if (error.data?.error !== 'txnNotFound') {
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Transaction validation timeout');
  });
}

export { requestWithRetry, submitWithRetry, autofillWithRetry, withRetry };
