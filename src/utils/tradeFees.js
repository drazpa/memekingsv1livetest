const RECEIVER_ADDRESS = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';
const DEVELOPER_WALLET = 'rphatRpwXcPAo7CVm46dC78JAQ6kLMqb2M';
const TRADING_FEE_XRP = 0.01;

export const sendTradingFee = async (client, wallet) => {
  if (wallet.address === DEVELOPER_WALLET) {
    console.log('Developer wallet - fee waived');
    return {
      success: true,
      hash: null,
      fee: 0,
      waived: true
    };
  }

  try {
    const feePayment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: RECEIVER_ADDRESS,
      Amount: (TRADING_FEE_XRP * 1000000).toString()
    };

    const prepared = await client.autofill(feePayment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      hash: result.result.hash,
      fee: TRADING_FEE_XRP,
      waived: false
    };
  } catch (error) {
    console.error('Error sending trading fee:', error);
    return {
      success: false,
      error: error.message,
      fee: TRADING_FEE_XRP,
      waived: false
    };
  }
};

export const calculateWithdrawFee = (withdrawAmount, withdrawMode) => {
  return TRADING_FEE_XRP;
};

export { RECEIVER_ADDRESS, TRADING_FEE_XRP };
