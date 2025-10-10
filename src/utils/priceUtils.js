import * as xrpl from 'xrpl';

let xrpUsdPrice = null;
let xrpPriceLastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export const getXRPUSDPrice = async () => {
  const now = Date.now();

  if (xrpUsdPrice && (now - xrpPriceLastFetch) < CACHE_DURATION) {
    return xrpUsdPrice;
  }

  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
    const data = await response.json();
    xrpUsdPrice = data.ripple?.usd || 0.50;
    xrpPriceLastFetch = now;
    return xrpUsdPrice;
  } catch (error) {
    console.error('Error fetching XRP/USD price:', error);
    return xrpUsdPrice || 0.50;
  }
};

export const calculate24hChange = (poolData, dbToken) => {
  if (!poolData || !poolData.price || !dbToken) {
    return '0.00';
  }

  const currentPrice = poolData.price;
  const startingPrice = dbToken.amm_xrp_amount && dbToken.amm_asset_amount
    ? dbToken.amm_xrp_amount / dbToken.amm_asset_amount
    : currentPrice;

  if (!startingPrice || startingPrice === 0) {
    return '0.00';
  }

  const change = ((currentPrice - startingPrice) / startingPrice) * 100;
  return change.toFixed(2);
};

export const calculateMarketCapUSD = async (token, xrpPrice = null) => {
  if (!token || !token.amm_pool_created) {
    return 0;
  }

  try {
    if (!xrpPrice) {
      xrpPrice = await getXRPUSDPrice();
    }

    const client = new xrpl.Client('wss://s1.ripple.com');
    await client.connect();

    const response = await client.request({
      command: 'amm_info',
      asset: {
        currency: 'XRP'
      },
      asset2: {
        currency: token.currency_code,
        issuer: token.issuer_address
      }
    });

    await client.disconnect();

    if (!response.result?.amm) {
      return 0;
    }

    const amount = response.result.amm.amount;
    const amount2 = response.result.amm.amount2;

    const xrpAmount = typeof amount === 'string'
      ? parseInt(amount) / 1000000
      : parseFloat(amount.value);

    const tokenAmount = typeof amount2 === 'string'
      ? parseInt(amount2) / 1000000
      : parseFloat(amount2.value);

    const priceInXRP = xrpAmount / tokenAmount;

    const totalSupply = parseFloat(token.total_supply) || tokenAmount * 2;

    const marketCapXRP = priceInXRP * totalSupply;
    const marketCapUSD = marketCapXRP * xrpPrice;

    return marketCapUSD;
  } catch (error) {
    console.error('Error calculating market cap USD:', error);
    return 0;
  }
};
