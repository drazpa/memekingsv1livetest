import { supabase } from './supabase';

export class AICachedData {
  static CACHE_EXPIRY = 30000;

  static async getTokenWithCache(tokenCode) {
    try {
      const { data: token, error } = await supabase
        .from('meme_tokens')
        .select('*, pool_data_cache(*)')
        .ilike('currency_code', tokenCode)
        .single();

      if (error || !token) {
        return null;
      }

      const poolCache = token.pool_data_cache?.[0];
      const isCacheValid = poolCache &&
        (Date.now() - new Date(poolCache.last_updated).getTime() < this.CACHE_EXPIRY);

      const price = isCacheValid && poolCache.price > 0
        ? poolCache.price
        : token.amm_xrp_amount && token.amm_asset_amount
          ? parseFloat(token.amm_xrp_amount) / parseFloat(token.amm_asset_amount)
          : 0;

      const marketCap = price * parseFloat(token.supply || 0);
      const liquidity = isCacheValid
        ? poolCache.xrp_amount
        : token.amm_xrp_amount || 0;

      const volume24h = isCacheValid ? poolCache.volume_24h || 0 : 0;
      const priceChange24h = isCacheValid ? poolCache.price_change_24h || 0 : 0;

      return {
        ...token,
        currentPrice: price,
        marketCap,
        liquidity,
        volume24h,
        priceChange24h,
        cacheStatus: isCacheValid ? 'valid' : 'stale'
      };
    } catch (error) {
      console.error('Error fetching cached token data:', error);
      return null;
    }
  }

  static async getAllTokensWithCache(limit = 20) {
    try {
      const { data: tokens, error } = await supabase
        .from('meme_tokens')
        .select('*, pool_data_cache(*)')
        .eq('amm_pool_created', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return tokens.map(token => {
        const poolCache = token.pool_data_cache?.[0];
        const isCacheValid = poolCache &&
          (Date.now() - new Date(poolCache.last_updated).getTime() < this.CACHE_EXPIRY);

        const price = isCacheValid && poolCache.price > 0
          ? poolCache.price
          : token.amm_xrp_amount && token.amm_asset_amount
            ? parseFloat(token.amm_xrp_amount) / parseFloat(token.amm_asset_amount)
            : 0;

        const marketCap = price * parseFloat(token.supply || 0);

        return {
          ...token,
          currentPrice: price,
          marketCap,
          liquidity: isCacheValid ? poolCache.xrp_amount : token.amm_xrp_amount || 0,
          volume24h: isCacheValid ? poolCache.volume_24h || 0 : 0,
          priceChange24h: isCacheValid ? poolCache.price_change_24h || 0 : 0,
          cacheStatus: isCacheValid ? 'valid' : 'stale'
        };
      });
    } catch (error) {
      console.error('Error fetching cached tokens:', error);
      return [];
    }
  }

  static async getMarketCapRankings(limit = 10) {
    try {
      const tokens = await this.getAllTokensWithCache(50);

      return tokens
        .filter(t => t.marketCap > 0)
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching market cap rankings:', error);
      return [];
    }
  }

  static async getVolumeLeaders(limit = 10) {
    try {
      const tokens = await this.getAllTokensWithCache(50);

      return tokens
        .filter(t => t.volume24h > 0)
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching volume leaders:', error);
      return [];
    }
  }

  static async getTopGainers(limit = 10) {
    try {
      const tokens = await this.getAllTokensWithCache(50);

      return tokens
        .filter(t => t.priceChange24h > 0)
        .sort((a, b) => b.priceChange24h - a.priceChange24h)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      return [];
    }
  }

  static async getTopLosers(limit = 10) {
    try {
      const tokens = await this.getAllTokensWithCache(50);

      return tokens
        .filter(t => t.priceChange24h < 0)
        .sort((a, b) => a.priceChange24h - b.priceChange24h)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching top losers:', error);
      return [];
    }
  }

  static async getTokenHolders(tokenCode, limit = 10) {
    try {
      const { data: token } = await supabase
        .from('meme_tokens')
        .select('id, token_name, supply')
        .ilike('currency_code', tokenCode)
        .single();

      if (!token) return null;

      const { data: holders, error } = await supabase
        .from('token_holdings_cache')
        .select('*')
        .eq('token_id', token.id)
        .order('balance', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Holder query error:', error);
        return null;
      }

      const isCacheValid = holders?.length > 0 && holders[0].last_updated &&
        (Date.now() - new Date(holders[0].last_updated).getTime() < this.CACHE_EXPIRY * 10);

      return {
        token,
        holders: holders || [],
        totalHolders: holders?.length || 0,
        totalBalance: holders?.reduce((sum, h) => sum + parseFloat(h.balance || 0), 0) || 0,
        cacheStatus: isCacheValid ? 'valid' : 'stale'
      };
    } catch (error) {
      console.error('Error fetching holders from cache:', error);
      return null;
    }
  }

  static async getWalletHoldings(walletAddress) {
    try {
      const { data: holdings, error } = await supabase
        .from('token_holdings_cache')
        .select('*, meme_tokens(*)')
        .eq('wallet_address', walletAddress)
        .gt('balance', 0)
        .order('value', { ascending: false });

      if (error) throw error;

      const isCacheValid = holdings?.length > 0 && holdings[0].last_updated &&
        (Date.now() - new Date(holdings[0].last_updated).getTime() < this.CACHE_EXPIRY);

      const totalValue = holdings?.reduce((sum, h) => sum + parseFloat(h.value || 0), 0) || 0;

      return {
        holdings: holdings || [],
        totalValue,
        totalAssets: holdings?.length || 0,
        cacheStatus: isCacheValid ? 'valid' : 'stale'
      };
    } catch (error) {
      console.error('Error fetching wallet holdings from cache:', error);
      return {
        holdings: [],
        totalValue: 0,
        totalAssets: 0,
        cacheStatus: 'error'
      };
    }
  }

  static async getPoolData(tokenId) {
    try {
      const { data: poolCache, error } = await supabase
        .from('pool_data_cache')
        .select('*')
        .eq('token_id', tokenId)
        .single();

      if (error) {
        return null;
      }

      const isCacheValid = poolCache &&
        (Date.now() - new Date(poolCache.last_updated).getTime() < this.CACHE_EXPIRY);

      return {
        ...poolCache,
        cacheStatus: isCacheValid ? 'valid' : 'stale'
      };
    } catch (error) {
      console.error('Error fetching pool cache:', error);
      return null;
    }
  }

  static async getXRPPrice() {
    try {
      const { data: priceCache, error } = await supabase
        .from('xrp_price_cache')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !priceCache) {
        return null;
      }

      const isCacheValid = Date.now() - new Date(priceCache.updated_at).getTime() < 60000;

      return {
        priceUsd: parseFloat(priceCache.price_usd || 0),
        updatedAt: priceCache.updated_at,
        cacheStatus: isCacheValid ? 'valid' : 'stale'
      };
    } catch (error) {
      console.error('Error fetching XRP price cache:', error);
      return null;
    }
  }

  static formatTokenData(token) {
    const daysOld = Math.floor((Date.now() - new Date(token.created_at).getTime()) / (1000 * 60 * 60 * 24));

    return {
      name: token.token_name || 'Unknown',
      symbol: token.currency_code || 'N/A',
      supply: token.supply ? parseFloat(token.supply).toLocaleString() : 'N/A',
      price: token.currentPrice > 0 ? `${token.currentPrice.toFixed(8)} XRP` : 'N/A',
      marketCap: token.marketCap > 0 ? `${token.marketCap.toFixed(4)} XRP` : 'N/A',
      liquidity: token.liquidity > 0 ? `${parseFloat(token.liquidity).toFixed(4)} XRP` : 'N/A',
      volume24h: token.volume24h > 0 ? `${token.volume24h.toFixed(2)} XRP` : 'N/A',
      priceChange24h: token.priceChange24h ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%` : 'N/A',
      daysOld: `${daysOld} days`,
      category: token.category || 'Other',
      status: token.status || 'Unknown',
      issuer: token.issuer_address ? `${token.issuer_address.slice(0, 8)}...${token.issuer_address.slice(-6)}` : 'N/A',
      created: new Date(token.created_at).toLocaleString(),
      description: token.description || null,
      twitter: token.twitter_handle || null,
      website: token.website_url || null,
      cacheStatus: token.cacheStatus || 'unknown'
    };
  }
}
