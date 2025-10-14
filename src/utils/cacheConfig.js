export const CACHE_DURATIONS = {
  BALANCE: 5 * 60 * 1000,
  POOL_DATA: 3 * 60 * 1000,
  TOKEN_HOLDERS: 10 * 60 * 1000,
  PRICE_DATA: 2 * 60 * 1000,
  LP_POSITION: 5 * 60 * 1000,
  TOKEN_LIST: 5 * 60 * 1000,
  MARKET_DATA: 2 * 60 * 1000,
};

export const LOCALSTORAGE_CACHE = {
  TOKEN_LIST: 'cached_token_list',
  TOKEN_LIST_TIMESTAMP: 'cached_token_list_ts',
  XRP_PRICE: 'cached_xrp_price',
  XRP_PRICE_TIMESTAMP: 'cached_xrp_price_ts',
};

export const getCachedData = (key, maxAge = 5 * 60 * 1000) => {
  try {
    const cached = localStorage.getItem(key);
    const timestamp = localStorage.getItem(`${key}_timestamp`);

    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < maxAge) {
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.error('Error reading from cache:', error);
  }
  return null;
};

export const setCachedData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(`${key}_timestamp`, Date.now().toString());
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
};

export const clearOldCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.endsWith('_timestamp')) {
        const timestamp = parseInt(localStorage.getItem(key));
        const age = Date.now() - timestamp;
        if (age > 24 * 60 * 60 * 1000) {
          const dataKey = key.replace('_timestamp', '');
          localStorage.removeItem(key);
          localStorage.removeItem(dataKey);
        }
      }
    });
  } catch (error) {
    console.error('Error clearing old cache:', error);
  }
};
