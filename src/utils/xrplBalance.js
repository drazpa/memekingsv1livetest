import * as xrpl from 'xrpl';

export async function getXRPBalance(address) {
  if (!address) return 0;

  try {
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();

    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    await client.disconnect();

    const balance = parseFloat(response.result.account_data.Balance) / 1000000;
    return balance;
  } catch (error) {
    if (error.data?.error === 'actNotFound') {
      return 0;
    }
    console.error('Error fetching XRP balance:', error);
    throw error;
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
