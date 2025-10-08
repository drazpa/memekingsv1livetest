import * as xrpl from 'xrpl';

export const sanitizeAmount = (amount, maxDecimals = 6) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid amount');
  }
  const multiplier = Math.pow(10, maxDecimals);
  return Math.floor(num * multiplier) / multiplier;
};

export const sanitizeXRP = (amount) => {
  return sanitizeAmount(amount, 6);
};

export const sanitizeToken = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid token amount');
  }
  return num.toFixed(6);
};

export const createBuyPayment = (walletAddress, tokenCurrency, tokenIssuer, tokenAmount, maxXRP) => {
  try {
    const sanitizedToken = sanitizeToken(tokenAmount);
    const sanitizedXRP = sanitizeXRP(maxXRP);

    return {
      TransactionType: 'Payment',
      Account: walletAddress,
      Destination: walletAddress,
      Amount: {
        currency: tokenCurrency,
        issuer: tokenIssuer,
        value: sanitizedToken
      },
      SendMax: xrpl.xrpToDrops(sanitizedXRP.toString())
    };
  } catch (error) {
    throw new Error(`Buy payment error: ${error.message}`);
  }
};

export const createSellPayment = (walletAddress, tokenCurrency, tokenIssuer, tokenAmount, minXRP) => {
  try {
    const sanitizedToken = sanitizeToken(tokenAmount);
    const sanitizedXRP = sanitizeXRP(minXRP);

    return {
      TransactionType: 'Payment',
      Account: walletAddress,
      Destination: walletAddress,
      Amount: xrpl.xrpToDrops(sanitizedXRP.toString()),
      SendMax: {
        currency: tokenCurrency,
        issuer: tokenIssuer,
        value: sanitizedToken
      }
    };
  } catch (error) {
    throw new Error(`Sell payment error: ${error.message}`);
  }
};

export const calculateSlippageAmount = (amount, slippagePercent, isBuy) => {
  const multiplier = 1 + (slippagePercent / 100);
  return isBuy ? amount * multiplier : amount / multiplier;
};

export const formatXRP = (amount) => {
  return parseFloat(amount).toFixed(6);
};

export const formatToken = (amount) => {
  return parseFloat(amount).toFixed(2);
};

export const getRandomAmount = (min, max) => {
  const range = max - min;
  const random = min + (Math.random() * range);
  return sanitizeXRP(random);
};
