import { Client } from 'xrpl';
import { supabase } from './supabase';
import { getXRPBalance } from './xrplBalance';
import { commandExecutor } from './commandExecutor';
import { AICachedData } from './aiCachedData';

class AIAssistant {
  constructor() {
    this.xrplClient = null;
    this.context = {
      connectedWallet: null,
      lastQuery: null,
      sessionData: {}
    };
    this.initializeContext();
  }

  initializeContext() {
    const stored = localStorage.getItem('connectedWallet');
    if (stored) {
      this.context.connectedWallet = JSON.parse(stored);
      commandExecutor.setWallet(this.context.connectedWallet);
    }
  }

  async processMessage(message) {
    const lowerMessage = message.toLowerCase();

    const parsedCommand = commandExecutor.parseCommand(message);
    if (parsedCommand.type !== 'UNKNOWN') {
      const result = await commandExecutor.executeCommand(parsedCommand);

      if (result.success) {
        return {
          content: result.message,
          data: result.data ? {
            card: {
              icon: '✅',
              title: 'Command Executed Successfully',
              badge: 'Success',
              items: Object.entries(result.data).map(([key, value]) => ({
                label: key.charAt(0).toUpperCase() + key.slice(1),
                value: String(value)
              }))
            },
            txHash: result.txHash,
            actions: result.txHash ? [{
              label: 'View on XRPScan',
              icon: '🔍',
              style: 'primary',
              onClick: () => window.open(`https://xrpscan.com/tx/${result.txHash}`, '_blank')
            }] : []
          } : null
        };
      } else {
        if (result.requiresWallet) {
          return {
            content: result.message,
            data: {
              actions: [{
                label: 'Connect Wallet',
                icon: '🔗',
                style: 'primary',
                onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'setup' }))
              }]
            }
          };
        }
        return {
          content: result.message,
          data: null
        };
      }
    }

    if (this.isAddressBookQuery(lowerMessage)) {
      return await this.handleAddressBook();
    } else if (this.isBuyTokenQuery(lowerMessage)) {
      return await this.handleBuyToken();
    } else if (this.isSellTokenQuery(lowerMessage)) {
      return await this.handleSellToken();
    } else if (this.isCreateBotQuery(lowerMessage)) {
      return await this.handleCreateBot();
    } else if (this.isSendXRPQuery(lowerMessage)) {
      return await this.handleSendXRP();
    } else if (this.isSendCustomTokenQuery(lowerMessage)) {
      return await this.handleSendCustomToken();
    } else if (this.isSendTokenQuery(lowerMessage)) {
      return await this.handleSendToken(message);
    } else if (this.isReceiveTokenQuery(lowerMessage)) {
      return this.handleReceiveToken();
    } else if (this.isWalletAssetsQuery(lowerMessage)) {
      return await this.handleWalletAssets();
    } else if (this.isBalanceQuery(lowerMessage)) {
      return await this.handleBalanceQuery();
    } else if (this.isTokenQuery(lowerMessage)) {
      return await this.handleTokenQuery(message);
    } else if (this.isTradeQuery(lowerMessage)) {
      return await this.handleTradeQuery();
    } else if (this.isPriceQuery(lowerMessage)) {
      return await this.handlePriceQuery(message);
    } else if (this.isMarketQuery(lowerMessage)) {
      return await this.handleMarketQuery();
    } else if (this.isWalletQuery(lowerMessage)) {
      return await this.handleWalletInfo();
    } else if (this.isNavigationQuery(lowerMessage)) {
      return this.handleNavigation(lowerMessage);
    } else if (this.isTokenStatsQuery(lowerMessage)) {
      return await this.handleTokenStats();
    } else if (this.isMarketCapQuery(lowerMessage)) {
      return await this.handleMarketCapQuery();
    } else if (this.isVolumeQuery(lowerMessage)) {
      return await this.handleVolumeQuery();
    } else if (this.isHoldersQuery(lowerMessage)) {
      return await this.handleHoldersQuery(message);
    } else if (this.isBotQuery(lowerMessage)) {
      return await this.handleBotQuery();
    } else if (this.isHelpQuery(lowerMessage)) {
      return this.handleHelp();
    } else {
      return this.handleGeneral(message);
    }
  }

  isBalanceQuery(msg) {
    return msg.includes('balance') || msg.includes('how much') || msg.includes('my xrp');
  }

  isTokenQuery(msg) {
    return (msg.includes('token') || msg.includes('coin')) &&
           (msg.includes('info') || msg.includes('about') || msg.includes('details') ||
            msg.includes('show') || msg.includes('tell me') || msg.includes('what is') ||
            msg.includes('stats') || msg.includes('statistics') || msg.includes('market cap') ||
            msg.includes('supply') || msg.includes('price') || msg.includes('liquidity') ||
            msg.includes('days') || /\b[A-Z]{3,10}\b/.test(msg));
  }

  isTradeQuery(msg) {
    return msg.includes('trade') || msg.includes('swap') || msg.includes('recent') && msg.includes('history');
  }

  isPriceQuery(msg) {
    return msg.includes('price') || msg.includes('cost') || msg.includes('worth');
  }

  isMarketQuery(msg) {
    return msg.includes('market') || msg.includes('top') || msg.includes('trending') || msg.includes('overview');
  }

  isWalletQuery(msg) {
    return msg.includes('wallet') && (msg.includes('info') || msg.includes('detail') || msg.includes('address'));
  }

  isNavigationQuery(msg) {
    return msg.includes('go to') || msg.includes('open') || msg.includes('show me') || msg.includes('navigate');
  }

  isHelpQuery(msg) {
    return msg.includes('help') || msg.includes('what can you') || msg.includes('how do i');
  }

  isSendTokenQuery(msg) {
    return (msg.includes('send') && (msg.includes('token') || msg.includes('xrp'))) || msg.includes('transfer') || msg.includes('payment');
  }

  isSendXRPQuery(msg) {
    return msg.includes('send') && msg.includes('xrp') && !msg.includes('custom') && !msg.includes('token');
  }

  isSendCustomTokenQuery(msg) {
    return (msg.includes('send') && (msg.includes('custom') || msg.includes('specific'))) || (msg.includes('send') && msg.includes('token') && !msg.includes('xrp'));
  }

  isReceiveTokenQuery(msg) {
    return msg.includes('receive') || msg.includes('get token') || msg.includes('my address');
  }

  isWalletAssetsQuery(msg) {
    return (msg.includes('wallet') && msg.includes('asset')) || msg.includes('what tokens') || msg.includes('my holdings');
  }

  isTokenStatsQuery(msg) {
    return (msg.includes('token') && (msg.includes('stat') || msg.includes('analytic') || msg.includes('performance')));
  }

  isBotQuery(msg) {
    return msg.includes('bot') && (msg.includes('status') || msg.includes('trading') || msg.includes('performance'));
  }

  isMarketCapQuery(msg) {
    return msg.includes('market cap') || msg.includes('marketcap') || msg.includes('mcap');
  }

  isVolumeQuery(msg) {
    return msg.includes('volume') || msg.includes('trading volume');
  }

  isHoldersQuery(msg) {
    return msg.includes('holder') || msg.includes('who holds') || msg.includes('ownership');
  }

  isBuyTokenQuery(msg) {
    return (msg.includes('buy') && msg.includes('token')) || msg.includes('purchase token');
  }

  isSellTokenQuery(msg) {
    return (msg.includes('sell') && msg.includes('token')) || msg.includes('sell my');
  }

  isCreateBotQuery(msg) {
    return (msg.includes('create') && msg.includes('bot')) || msg.includes('new bot') || msg.includes('setup bot');
  }

  isAddressBookQuery(msg) {
    return msg.includes('address book') || msg.includes('contacts') || msg.includes('saved addresses');
  }

  async handleBalanceQuery() {
    if (!this.context.connectedWallet) {
      return {
        content: 'No wallet is currently connected. Please connect a wallet first to check your balance.',
        data: {
          actions: [
            {
              label: 'Go to Wallets',
              icon: '💼',
              style: 'primary',
              onClick: () => {
                window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }));
              }
            }
          ]
        }
      };
    }

    try {
      const balance = await getXRPBalance(this.context.connectedWallet.address);

      return {
        content: 'Here is your current wallet balance:',
        data: {
          card: {
            icon: '💰',
            title: 'Wallet Balance',
            badge: 'Live',
            items: [
              { label: 'Address', value: `${this.context.connectedWallet.address.slice(0, 10)}...${this.context.connectedWallet.address.slice(-8)}` },
              { label: 'XRP Balance', value: `${balance.toFixed(6)} XRP` },
              { label: 'Wallet Name', value: this.context.connectedWallet.name }
            ]
          },
          quickActions: [
            { label: 'Send XRP', onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' })) },
            { label: 'View on XRPScan', onClick: () => window.open(`https://xrpscan.com/account/${this.context.connectedWallet.address}`, '_blank') }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I encountered an error fetching your balance. Please make sure your wallet is properly connected.',
        data: null
      };
    }
  }

  async handleTokenQuery(message) {
    try {
      const tokenMatch = message.match(/(?:about|info|details|for|show)\s+([A-Z]{3,10})/i);

      if (tokenMatch) {
        const tokenCode = tokenMatch[1].toUpperCase();
        return await this.getDetailedTokenInfo(tokenCode);
      }

      const { data: tokens, error } = await supabase
        .from('meme_tokens')
        .select('*')
        .eq('amm_pool_created', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!tokens || tokens.length === 0) {
        return {
          content: 'No tokens found in the database. Create your first token to get started!',
          data: {
            actions: [
              {
                label: 'Create Token',
                icon: '✨',
                style: 'primary',
                onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'memes' }))
              }
            ]
          }
        };
      }

      const totalSupply = tokens.reduce((sum, t) => sum + (parseFloat(t.supply) || 0), 0);

      return {
        content: `I found ${tokens.length} active tokens:`,
        data: {
          card: {
            icon: '💎',
            title: 'Token Overview',
            badge: `${tokens.length} Tokens`,
            items: [
              { label: 'Total Tokens', value: `${tokens.length}` },
              { label: 'Total Supply', value: totalSupply.toLocaleString() }
            ]
          },
          table: {
            headers: ['Token', 'Symbol', 'Supply', 'Created'],
            rows: tokens.slice(0, 5).map(token => [
              token.token_name || 'Unknown',
              token.currency_code || 'N/A',
              token.supply ? parseFloat(token.supply).toLocaleString() : 'N/A',
              new Date(token.created_at).toLocaleDateString()
            ])
          },
          actions: [
            {
              label: 'View All Tokens',
              icon: '📋',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'mytokens' }))
            },
            {
              label: 'Trade Tokens',
              icon: '💱',
              style: 'secondary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching token information. Please try again.',
        data: null
      };
    }
  }

  async getDetailedTokenInfo(tokenCode) {
    try {
      const tokenData = await AICachedData.getTokenWithCache(tokenCode);

      if (!tokenData) {
        return {
          content: `Token "${tokenCode}" not found. Make sure the token code is correct.`,
          data: {
            actions: [
              {
                label: 'View All Tokens',
                icon: '📋',
                style: 'primary',
                onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'mytokens' }))
              }
            ]
          }
        };
      }

      const formatted = AICachedData.formatTokenData(tokenData);

      const details = [
        { label: 'Token Name', value: formatted.name },
        { label: 'Symbol', value: formatted.symbol },
        { label: 'Total Supply', value: formatted.supply },
        { label: 'Current Price', value: formatted.price },
        { label: 'Market Cap', value: formatted.marketCap },
        { label: 'Liquidity', value: formatted.liquidity },
        { label: '24h Volume', value: formatted.volume24h },
        { label: '24h Change', value: formatted.priceChange24h },
        { label: 'Days Old', value: formatted.daysOld },
        { label: 'Category', value: formatted.category },
        { label: 'AMM Pool', value: tokenData.amm_pool_created ? 'Yes ✅' : 'No ❌' },
        { label: 'Status', value: formatted.status },
        { label: 'Issuer', value: formatted.issuer },
        { label: 'Created', value: formatted.created }
      ];

      if (formatted.description) {
        details.splice(2, 0, { label: 'Description', value: formatted.description });
      }
      if (formatted.twitter) {
        details.push({ label: 'Twitter', value: `@${formatted.twitter}` });
      }
      if (formatted.website) {
        details.push({ label: 'Website', value: formatted.website });
      }

      return {
        content: `Here are the complete details for ${tokenData.token_name || tokenCode}:`,
        data: {
          card: {
            icon: '💎',
            title: `${tokenData.token_name || tokenCode} (${tokenData.currency_code})`,
            badge: tokenData.category || 'Token',
            items: details
          },
          actions: [
            {
              label: 'Trade This Token',
              icon: '💱',
              style: 'primary',
              onClick: () => {
                window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }));
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('selectToken', { detail: tokenData }));
                }, 100);
              }
            },
            {
              label: 'View on XRPScan',
              icon: '🔍',
              style: 'secondary',
              onClick: () => window.open(`https://xrpscan.com/account/${tokenData.issuer_address}`, '_blank')
            }
          ]
        }
      };
    } catch (error) {
      console.error('Error fetching token details:', error);
      return {
        content: `I had trouble fetching details for "${tokenCode}". Please try again.`,
        data: null
      };
    }
  }

  async handleTradeQuery() {
    try {
      const { data: trades, error } = await supabase
        .from('bot_trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!trades || trades.length === 0) {
        return {
          content: 'No recent trades found. Start trading to see your history here!',
          data: {
            actions: [
              {
                label: 'Start Trading',
                icon: '💱',
                style: 'primary',
                onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
              }
            ]
          }
        };
      }

      const successfulTrades = trades.filter(t => t.status === 'success').length;
      const totalVolume = trades.reduce((sum, t) => sum + (t.amount_bought || 0), 0);
      const successRate = trades.length > 0 ? (successfulTrades / trades.length * 100).toFixed(1) : 0;

      return {
        content: `Here is your trading activity from the platform:`,
        data: {
          card: {
            icon: '📊',
            title: 'Trading Summary',
            badge: `${trades.length} Trades`,
            items: [
              { label: 'Total Trades', value: `${trades.length}` },
              { label: 'Successful', value: `${successfulTrades}` },
              { label: 'Success Rate', value: `${successRate}%` },
              { label: 'Total Volume', value: `${totalVolume.toFixed(2)} tokens` }
            ]
          },
          table: {
            headers: ['Type', 'Amount', 'Status', 'Date'],
            rows: trades.map(trade => [
              trade.trade_type || 'Unknown',
              `${(trade.amount_bought || 0).toFixed(2)}`,
              trade.status || 'N/A',
              new Date(trade.created_at).toLocaleString()
            ])
          },
          actions: [
            {
              label: 'View All Trades',
              icon: '📊',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'bottrader' }))
            },
            {
              label: 'Start Trading',
              icon: '💱',
              style: 'secondary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching your trade history. Please try again.',
        data: null
      };
    }
  }

  async handlePriceQuery(message) {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select('*')
        .order('volume_24h', { ascending: false, nullsFirst: false })
        .limit(5);

      if (error) throw error;

      return {
        content: 'Here are the top tokens by trading volume:',
        data: {
          table: {
            headers: ['Token', 'Symbol', '24h Volume', '24h Change'],
            rows: tokens?.map(token => [
              token.name || 'Unknown',
              token.currency_code || 'N/A',
              token.volume_24h ? `${token.volume_24h.toFixed(2)}` : 'N/A',
              token.price_change_24h ? `${token.price_change_24h > 0 ? '+' : ''}${token.price_change_24h.toFixed(2)}%` : 'N/A'
            ]) || []
          },
          actions: [
            {
              label: 'View All Prices',
              icon: '💰',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
            },
            {
              label: 'Top 10 Tokens',
              icon: '👑',
              style: 'secondary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'top10' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I can help you check token prices! Visit the Trade page for real-time prices.',
        data: {
          actions: [
            {
              label: 'View Prices',
              icon: '💰',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
            }
          ]
        }
      };
    }
  }

  async handleMarketQuery() {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select('*')
        .order('price_change_24h', { ascending: false, nullsFirst: false })
        .limit(10);

      if (error) throw error;

      const { count: totalTokens } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true });

      const { count: totalPools } = await supabase
        .from('liquidity_pools')
        .select('*', { count: 'exact', head: true });

      const { count: activeBots } = await supabase
        .from('trading_bots')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const totalSupply = tokens?.reduce((sum, t) => sum + parseFloat(t.total_supply || 0), 0) || 0;
      const totalVolume = tokens?.reduce((sum, t) => sum + (t.volume_24h || 0), 0) || 0;
      const avgMarketCap = tokens?.length > 0 ? (totalSupply / tokens.length) : 0;

      const topGainer = tokens && tokens.length > 0 ? tokens[0] : null;
      const recentTokens = tokens?.filter(t => {
        const created = new Date(t.created_at);
        const now = new Date();
        return (now - created) < 24 * 60 * 60 * 1000;
      }).length || 0;

      return {
        content: 'Here is comprehensive market analytics with data from the Analytics page:',
        data: {
          card: {
            icon: '📊',
            title: 'Market Analytics',
            badge: 'Live Data',
            items: [
              { label: 'Total Tokens', value: `${totalTokens || 0}` },
              { label: 'Active Pools', value: `${totalPools || 0}` },
              { label: 'Active Bots', value: `${activeBots || 0}` },
              { label: '24h New Tokens', value: `${recentTokens}` },
              { label: 'Total Supply', value: `${totalSupply.toFixed(0)}` },
              { label: '24h Volume', value: `${totalVolume.toFixed(2)}` },
              { label: 'Avg Market Cap', value: `${avgMarketCap.toFixed(2)}` },
              { label: 'Top Gainer', value: topGainer ? `${topGainer.name}` : 'N/A' }
            ]
          },
          table: {
            headers: ['Token', 'Symbol', '24h Change', '24h Volume', 'Created'],
            rows: tokens?.slice(0, 5).map(token => [
              token.name || 'Unknown',
              token.currency_code || 'N/A',
              token.price_change_24h ? `${token.price_change_24h > 0 ? '+' : ''}${token.price_change_24h.toFixed(2)}%` : 'N/A',
              token.volume_24h ? token.volume_24h.toFixed(2) : 'N/A',
              new Date(token.created_at).toLocaleDateString()
            ]) || []
          },
          actions: [
            {
              label: 'View Top 10',
              icon: '👑',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'top10' }))
            },
            {
              label: 'Full Analytics',
              icon: '📈',
              style: 'secondary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'analytics' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching market data. Please try again.',
        data: null
      };
    }
  }

  async handleWalletInfo() {
    if (!this.context.connectedWallet) {
      return {
        content: 'No wallet is currently connected. Connect a wallet to see detailed information.',
        data: {
          actions: [
            {
              label: 'Connect Wallet',
              icon: '🔗',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
            }
          ]
        }
      };
    }

    return {
      content: 'Here is your connected wallet information:',
      data: {
        card: {
          icon: '💼',
          title: 'Wallet Information',
          badge: 'Active',
          items: [
            { label: 'Name', value: this.context.connectedWallet.name },
            { label: 'Address', value: this.context.connectedWallet.address },
            { label: 'Network', value: 'XRPL Mainnet' }
          ],
          description: 'Your wallet is securely connected to the XRPL network.'
        },
        actions: [
          {
            label: 'Manage Wallet',
            icon: '⚙️',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
          }
        ]
      }
    };
  }

  handleNavigation(message) {
    const pages = {
      'dashboard': ['dashboard', 'home'],
      'trade': ['trade', 'swap', 'trading'],
      'memes': ['meme', 'create token'],
      'pools': ['pool', 'liquidity'],
      'bottrader': ['bot', 'automated trading'],
      'vault': ['vault', 'collect', 'fees'],
      'mytokens': ['my token', 'tokens'],
      'analytics': ['analytic', 'stats', 'chart'],
      'top10': ['top 10', 'top ten', 'leaderboard'],
      'wallets': ['wallet', 'manage wallet'],
      'about': ['about', 'info']
    };

    for (const [page, keywords] of Object.entries(pages)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('navigateToPage', { detail: page }));
        }, 500);

        return {
          content: `Taking you to ${page.charAt(0).toUpperCase() + page.slice(1)}...`,
          data: null
        };
      }
    }

    return {
      content: 'I can help you navigate to different sections. Which page would you like to visit?',
      data: {
        quickActions: [
          { label: 'Dashboard', onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'dashboard' })) },
          { label: 'Trade', onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' })) },
          { label: 'Create Token', onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'memes' })) },
          { label: 'Bot Trader', onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'bottrader' })) }
        ]
      }
    };
  }

  handleHelp() {
    return {
      content: 'I\'m your advanced XRPL AI assistant. Here\'s what I can help you with:',
      data: {
        card: {
          icon: '🤖',
          title: 'Available Commands',
          items: [
            { label: 'Balance Queries', value: 'Check wallet balances and XRP amounts' },
            { label: 'Token Information', value: 'Get details about any token' },
            { label: 'Trade History', value: 'View your recent trades and swaps' },
            { label: 'Market Data', value: 'Get market overview and analytics' },
            { label: 'Navigation', value: 'Navigate to any page on the platform' },
            { label: 'Price Checking', value: 'Check token prices and values' }
          ]
        },
        quickActions: [
          { label: 'Check Balance', onClick: () => {} },
          { label: 'View Tokens', onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'mytokens' })) },
          { label: 'Market Overview', onClick: () => {} },
          { label: 'Trade History', onClick: () => {} }
        ]
      }
    };
  }

  async handleSendXRP() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet first to send XRP.',
        data: {
          actions: [{
            label: 'Connect Wallet',
            icon: '🔗',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
          }]
        }
      };
    }

    return {
      content: 'Ready to send XRP! Fill in the details below and I\'ll execute the transaction for you.',
      data: {
        execution: {
          type: 'send_xrp',
          icon: '📤',
          title: 'Send XRP',
          description: 'Direct XRP transfer to any XRPL address',
          badge: 'Ready to Execute',
          fields: [
            {
              name: 'destinationAddress',
              label: 'Destination Address',
              type: 'text',
              placeholder: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              required: true,
              hint: 'Enter recipient XRPL address or use Address Book'
            },
            {
              name: 'amount',
              label: 'Amount (XRP)',
              type: 'number',
              placeholder: '10',
              required: true,
              hint: 'Amount of XRP to send'
            },
            {
              name: 'memo',
              label: 'Memo (Optional)',
              type: 'text',
              placeholder: 'Payment for services',
              hint: 'Optional memo for this transaction'
            }
          ],
          steps: [
            { label: 'Validate destination', description: 'Verifying XRPL address format' },
            { label: 'Check balance', description: 'Ensuring sufficient XRP balance' },
            { label: 'Prepare payment', description: 'Creating XRP payment transaction' },
            { label: 'Sign with wallet', description: 'Cryptographically signing transaction' },
            { label: 'Broadcast to network', description: 'Submitting to XRPL' },
            { label: 'Wait for confirmation', description: 'Transaction being validated' }
          ],
          defaultValues: {
            amount: '10'
          }
        }
      }
    };
  }

  async handleSendCustomToken() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet first to send custom tokens.',
        data: {
          actions: [{
            label: 'Connect Wallet',
            icon: '🔗',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
          }]
        }
      };
    }

    const { data: tokens } = await supabase
      .from('tokens')
      .select('*')
      .order('name', { ascending: true })
      .limit(100);

    if (!tokens || tokens.length === 0) {
      return {
        content: 'No custom tokens found in the platform. You can only send tokens that exist in the system.',
        data: {
          actions: [{
            label: 'View Available Tokens',
            icon: '🪙',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }))
          }]
        }
      };
    }

    return {
      content: `I can help you send any of the ${tokens.length} available tokens. Select the token and provide details:`,
      data: {
        execution: {
          type: 'send_token',
          icon: '🪙',
          title: 'Send Custom Token',
          description: 'Transfer tokens to any XRPL address with trustline',
          badge: `${tokens.length} Tokens Available`,
          fields: [
            {
              name: 'tokenId',
              label: 'Select Token',
              type: 'select',
              required: true,
              options: tokens.map(t => ({
                value: JSON.stringify({ code: t.currency_code, issuer: t.issuer_address, name: t.name }),
                label: `${t.name} (${t.currency_code})`
              })),
              hint: 'Choose which token to send'
            },
            {
              name: 'destinationAddress',
              label: 'Destination Address',
              type: 'text',
              placeholder: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              required: true,
              hint: 'Recipient must have trustline for this token'
            },
            {
              name: 'amount',
              label: 'Amount',
              type: 'number',
              placeholder: '100',
              required: true,
              hint: 'Amount of tokens to send'
            },
            {
              name: 'memo',
              label: 'Memo (Optional)',
              type: 'text',
              placeholder: 'Payment note',
              hint: 'Optional transaction memo'
            }
          ],
          steps: [
            { label: 'Parse token selection', description: 'Extracting token details' },
            { label: 'Validate addresses', description: 'Checking destination and issuer' },
            { label: 'Verify trustline', description: 'Ensuring recipient can receive' },
            { label: 'Prepare payment', description: 'Creating token payment transaction' },
            { label: 'Sign transaction', description: 'Signing with your wallet' },
            { label: 'Submit to XRPL', description: 'Broadcasting transaction' },
            { label: 'Confirm delivery', description: 'Waiting for ledger confirmation' }
          ],
          defaultValues: {
            amount: '100'
          }
        }
      }
    };
  }

  async handleSendToken(message) {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet first to send tokens.',
        data: {
          actions: [
            {
              label: 'Connect Wallet',
              icon: '🔗',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
            }
          ]
        }
      };
    }

    const { data: tokens } = await supabase
      .from('tokens')
      .select('id, name, currency_code, issuer_address')
      .limit(50);

    const lowerMessage = message?.toLowerCase() || '';
    const isSpecificToken = lowerMessage.includes('send') && tokens?.some(t =>
      lowerMessage.includes(t.name.toLowerCase()) || lowerMessage.includes(t.currency_code.toLowerCase())
    );

    if (isSpecificToken) {
      const matchedToken = tokens.find(t =>
        lowerMessage.includes(t.name.toLowerCase()) || lowerMessage.includes(t.currency_code.toLowerCase())
      );

      return {
        content: `I'll help you send ${matchedToken.name} (${matchedToken.currency_code}). Please provide the details:`,
        data: {
          execution: {
            type: 'send_token',
            icon: '📤',
            title: `Send ${matchedToken.name}`,
            description: `Send ${matchedToken.currency_code} tokens to any XRPL address`,
            badge: 'Token Transfer',
            fields: [
              {
                name: 'destinationAddress',
                label: 'Destination Address',
                type: 'text',
                placeholder: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                required: true,
                hint: 'Enter recipient address or use Address Book'
              },
              {
                name: 'amount',
                label: `Amount (${matchedToken.currency_code})`,
                type: 'number',
                placeholder: '100',
                required: true,
                hint: `Amount of ${matchedToken.currency_code} to send`
              },
              {
                name: 'currencyCode',
                label: 'Currency Code',
                type: 'text',
                placeholder: matchedToken.currency_code,
                required: true,
                hint: 'Token currency code'
              },
              {
                name: 'issuerAddress',
                label: 'Issuer Address',
                type: 'text',
                placeholder: matchedToken.issuer_address,
                required: true,
                hint: 'Token issuer address'
              },
              {
                name: 'memo',
                label: 'Memo (Optional)',
                type: 'text',
                placeholder: 'Payment for services',
                hint: 'Optional memo to include'
              }
            ],
            steps: [
              { label: 'Validate addresses', description: 'Checking destination and issuer addresses' },
              { label: 'Check trustline', description: 'Verifying recipient has trustline' },
              { label: 'Prepare transaction', description: 'Creating token payment' },
              { label: 'Sign transaction', description: 'Signing with your wallet' },
              { label: 'Submit to XRPL', description: 'Broadcasting to network' },
              { label: 'Confirm transaction', description: 'Waiting for confirmation' }
            ],
            defaultValues: {
              amount: '100',
              currencyCode: matchedToken.currency_code,
              issuerAddress: matchedToken.issuer_address
            }
          }
        }
      };
    }

    return {
      content: 'I can help you send XRP or custom tokens directly from chat! What would you like to send?',
      data: {
        card: {
          icon: '💱',
          title: 'Send Options',
          badge: 'Choose Type',
          items: [
            { label: 'XRP', value: 'Native XRPL currency' },
            { label: 'Custom Tokens', value: `${tokens?.length || 0} available` }
          ]
        },
        quickActions: [
          {
            label: 'Send XRP',
            onClick: () => window.dispatchEvent(new CustomEvent('sendAIMessage', { detail: 'send XRP' }))
          },
          {
            label: 'Send Custom Token',
            onClick: () => window.dispatchEvent(new CustomEvent('sendAIMessage', { detail: 'send custom token' }))
          }
        ]
      }
    };
  }

  handleReceiveToken() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet first to receive tokens.',
        data: {
          actions: [
            {
              label: 'Connect Wallet',
              icon: '🔗',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
            }
          ]
        }
      };
    }

    return {
      content: 'Here is your wallet address for receiving tokens:',
      data: {
        card: {
          icon: '📥',
          title: 'Receive Tokens',
          badge: 'Your Address',
          items: [
            { label: 'Wallet Name', value: this.context.connectedWallet.name },
            { label: 'Address', value: this.context.connectedWallet.address },
            { label: 'Network', value: 'XRPL Mainnet' }
          ],
          description: 'Share this address with others to receive XRP and tokens. Make sure senders are using the XRPL network.'
        },
        quickActions: [
          { label: 'Copy Address', onClick: () => navigator.clipboard.writeText(this.context.connectedWallet.address) },
          { label: 'View on Explorer', onClick: () => window.open(`https://xrpscan.com/account/${this.context.connectedWallet.address}`, '_blank') }
        ]
      }
    };
  }

  async handleWalletAssets() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet to view your assets.',
        data: {
          actions: [
            {
              label: 'Connect Wallet',
              icon: '🔗',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
            }
          ]
        }
      };
    }

    try {
      const balance = await getXRPBalance(this.context.connectedWallet.address);

      return {
        content: 'Here are your wallet assets:',
        data: {
          card: {
            icon: '💎',
            title: 'Wallet Assets',
            badge: 'Live',
            items: [
              { label: 'XRP Balance', value: `${balance.toFixed(6)} XRP` },
              { label: 'Wallet', value: this.context.connectedWallet.name },
              { label: 'Address', value: `${this.context.connectedWallet.address.slice(0, 12)}...` }
            ],
            description: 'View all your assets including tokens and XRP holdings in the Wallets page.'
          },
          actions: [
            {
              label: 'View All Assets',
              icon: '💼',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
            },
            {
              label: 'Send Tokens',
              icon: '📤',
              style: 'secondary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching your wallet assets. Please try again.',
        data: null
      };
    }
  }

  async handleTokenStats() {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const { count: totalTokens } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true });

      return {
        content: 'Here are the latest token statistics:',
        data: {
          card: {
            icon: '📊',
            title: 'Token Statistics',
            badge: 'Real-time',
            items: [
              { label: 'Total Tokens', value: `${totalTokens || 0}` },
              { label: 'Recent Tokens', value: `${tokens?.length || 0} new` },
              { label: 'Network', value: 'XRPL Mainnet' }
            ]
          },
          table: {
            headers: ['Token', 'Symbol', 'Created'],
            rows: tokens?.slice(0, 5).map(token => [
              token.name || 'Unknown',
              token.currency_code || 'N/A',
              new Date(token.created_at).toLocaleDateString()
            ]) || []
          },
          actions: [
            {
              label: 'View All Tokens',
              icon: '📋',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'mytokens' }))
            },
            {
              label: 'Create Token',
              icon: '✨',
              style: 'secondary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'memes' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching token statistics. Please try again.',
        data: null
      };
    }
  }

  async handleMarketCapQuery() {
    try {
      const tokensWithMC = await AICachedData.getMarketCapRankings(10);

      if (!tokensWithMC || tokensWithMC.length === 0) {
        return {
          content: 'No market cap data available yet.',
          data: null
        };
      }

      const totalMarketCap = tokensWithMC.reduce((sum, t) => sum + t.marketCap, 0);

      return {
        content: `Here are tokens ranked by market cap (from cache):`,
        data: {
          card: {
            icon: '💰',
            title: 'Market Cap Rankings',
            badge: 'Top Tokens',
            items: [
              { label: 'Total Tokens', value: `${tokensWithMC.length}` },
              { label: 'Total Market Cap', value: `${totalMarketCap.toFixed(2)} XRP` },
              { label: 'Cache Status', value: tokensWithMC[0].cacheStatus === 'valid' ? '✅ Fresh' : '⚠️ Updating' }
            ]
          },
          table: {
            headers: ['Rank', 'Token', 'Market Cap', 'Price', '24h Change'],
            rows: tokensWithMC.map((token, idx) => [
              `#${idx + 1}`,
              `${token.token_name} (${token.currency_code})`,
              `${token.marketCap.toFixed(2)} XRP`,
              `${token.currentPrice.toFixed(8)} XRP`,
              token.priceChange24h ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%` : 'N/A'
            ])
          },
          actions: [
            {
              label: 'View Top 10',
              icon: '👑',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'top10' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching market cap data. Please try again.',
        data: null
      };
    }
  }

  async handleVolumeQuery() {
    try {
      const volumeLeaders = await AICachedData.getVolumeLeaders(10);

      if (!volumeLeaders || volumeLeaders.length === 0) {
        return {
          content: 'No volume data available yet.',
          data: null
        };
      }

      const totalVolume = volumeLeaders.reduce((sum, t) => sum + t.volume24h, 0);

      return {
        content: `Here are the top tokens by 24h trading volume (from cache):`,
        data: {
          card: {
            icon: '📊',
            title: '24h Trading Volume',
            badge: 'Last 24 Hours',
            items: [
              { label: 'Total Volume', value: `${totalVolume.toFixed(2)} XRP` },
              { label: 'Top Tokens', value: `${volumeLeaders.length}` },
              { label: 'Cache Status', value: volumeLeaders[0].cacheStatus === 'valid' ? '✅ Fresh' : '⚠️ Updating' }
            ]
          },
          table: {
            headers: ['Token', '24h Volume', 'Price', '24h Change'],
            rows: volumeLeaders.map(token => [
              `${token.token_name} (${token.currency_code})`,
              `${token.volume24h.toFixed(2)} XRP`,
              `${token.currentPrice.toFixed(8)} XRP`,
              token.priceChange24h ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%` : 'N/A'
            ])
          },
          actions: [
            {
              label: 'View Trade History',
              icon: '📈',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'activity' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching volume data. Please try again.',
        data: null
      };
    }
  }

  async handleHoldersQuery(message) {
    try {
      const tokenMatch = message.match(/(?:holder|holds|ownership).*?([A-Z]{3,10})/i);
      const tokenCode = tokenMatch ? tokenMatch[1].toUpperCase() : null;

      if (!tokenCode) {
        return {
          content: 'Please specify which token you want to check holders for. Example: "Who holds ORANGE?" or "Show holders for KOOL"',
          data: null
        };
      }

      const holdersData = await AICachedData.getTokenHolders(tokenCode, 10);

      if (!holdersData) {
        return {
          content: `Token "${tokenCode}" not found.`,
          data: null
        };
      }

      if (!holdersData.holders || holdersData.holders.length === 0) {
        return {
          content: `No holder data available yet for ${holdersData.token.token_name} (${tokenCode}). Holder data is updated periodically.`,
          data: {
            card: {
              icon: '👥',
              title: `${holdersData.token.token_name} (${tokenCode})`,
              badge: 'No Data',
              items: [
                { label: 'Status', value: 'Holder data not yet available' },
                { label: 'Total Supply', value: holdersData.token.supply ? parseFloat(holdersData.token.supply).toLocaleString() : 'N/A' }
              ]
            }
          }
        };
      }

      return {
        content: `Here are the top holders of ${holdersData.token.token_name} (${tokenCode}) (from cache):`,
        data: {
          card: {
            icon: '👥',
            title: `${holdersData.token.token_name} Holders`,
            badge: `${holdersData.totalHolders} Holders`,
            items: [
              { label: 'Total Holders', value: `${holdersData.totalHolders}` },
              { label: 'Total Balance', value: holdersData.totalBalance.toLocaleString() },
              { label: 'Total Supply', value: holdersData.token.supply ? parseFloat(holdersData.token.supply).toLocaleString() : 'N/A' },
              { label: 'Cache Status', value: holdersData.cacheStatus === 'valid' ? '✅ Fresh' : '⚠️ Updating' }
            ]
          },
          table: {
            headers: ['Rank', 'Address', 'Balance', '% of Supply'],
            rows: holdersData.holders.map((holder, idx) => [
              `#${idx + 1}`,
              `${holder.wallet_address?.slice(0, 8)}...${holder.wallet_address?.slice(-6)}`,
              parseFloat(holder.balance).toLocaleString(),
              `${((parseFloat(holder.balance) / parseFloat(holdersData.token.supply)) * 100).toFixed(2)}%`
            ])
          },
          actions: [
            {
              label: 'Trade This Token',
              icon: '💱',
              style: 'primary',
              onClick: () => {
                window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'trade' }));
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('selectToken', { detail: holdersData.token }));
                }, 100);
              }
            }
          ]
        }
      };
    } catch (error) {
      console.error('Error fetching holder data:', error);
      return {
        content: 'I had trouble fetching holder data. Please try again.',
        data: null
      };
    }
  }

  async handleBotQuery() {
    try {
      const { data: bots, error } = await supabase
        .from('trading_bots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!bots || bots.length === 0) {
        return {
          content: 'You don\'t have any trading bots yet. Create your first bot to automate your trading!',
          data: {
            actions: [
              {
                label: 'Create Trading Bot',
                icon: '🤖',
                style: 'primary',
                onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'bottrader' }))
              }
            ]
          }
        };
      }

      const activeBots = bots.filter(bot => bot.status === 'active').length;
      const totalTrades = bots.reduce((sum, bot) => sum + (bot.total_trades || 0), 0);

      return {
        content: 'Here is your trading bot overview:',
        data: {
          card: {
            icon: '🤖',
            title: 'Trading Bots',
            badge: `${activeBots} Active`,
            items: [
              { label: 'Total Bots', value: `${bots.length}` },
              { label: 'Active Bots', value: `${activeBots}` },
              { label: 'Total Trades', value: `${totalTrades}` }
            ]
          },
          table: {
            headers: ['Bot', 'Status', 'Strategy', 'Trades'],
            rows: bots.slice(0, 5).map(bot => [
              bot.name || 'Unnamed Bot',
              bot.status || 'Unknown',
              bot.strategy || 'N/A',
              `${bot.total_trades || 0}`
            ])
          },
          actions: [
            {
              label: 'Manage Bots',
              icon: '⚙️',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'bottrader' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble fetching bot information. Please try again.',
        data: null
      };
    }
  }

  async handleBuyToken() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet to buy tokens.',
        data: {
          actions: [{
            label: 'Connect Wallet',
            icon: '🔗',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
          }]
        }
      };
    }

    const { data: tokens } = await supabase
      .from('tokens')
      .select('id, name, currency_code')
      .limit(50);

    return {
      content: 'Let\'s buy some tokens! I\'ll guide you through the process step by step.',
      data: {
        execution: {
          type: 'buy_token',
          icon: '🛒',
          title: 'Buy Token',
          description: 'Purchase tokens using XRP',
          badge: 'Trade',
          fields: [
            {
              name: 'tokenId',
              label: 'Select Token',
              type: 'select',
              required: true,
              options: tokens?.map(t => ({ value: t.id, label: `${t.name} (${t.currency_code})` })) || [],
              hint: 'Choose which token to buy'
            },
            {
              name: 'amountXRP',
              label: 'Amount to Spend (XRP)',
              type: 'number',
              placeholder: '100',
              required: true,
              hint: 'Amount of XRP to spend'
            },
            {
              name: 'slippage',
              label: 'Slippage Tolerance (%)',
              type: 'number',
              placeholder: '2',
              required: true,
              hint: 'Maximum price slippage allowed'
            }
          ],
          steps: [
            { label: 'Select token', description: 'Choose token to purchase' },
            { label: 'Create offer', description: 'Preparing buy order on XRPL' },
            { label: 'Sign transaction', description: 'Signing with wallet' },
            { label: 'Submit order', description: 'Submitting to ledger' },
            { label: 'Confirm purchase', description: 'Waiting for confirmation' }
          ],
          defaultValues: {
            amountXRP: '100',
            slippage: '2'
          }
        }
      }
    };
  }

  async handleSellToken() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet to sell tokens.',
        data: {
          actions: [{
            label: 'Connect Wallet',
            icon: '🔗',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
          }]
        }
      };
    }

    const { data: tokens } = await supabase
      .from('tokens')
      .select('id, name, currency_code')
      .limit(50);

    return {
      content: 'Ready to sell tokens! I\'ll help you create a sell order.',
      data: {
        execution: {
          type: 'sell_token',
          icon: '💸',
          title: 'Sell Token',
          description: 'Sell tokens for XRP',
          badge: 'Trade',
          fields: [
            {
              name: 'tokenId',
              label: 'Select Token',
              type: 'select',
              required: true,
              options: tokens?.map(t => ({ value: t.id, label: `${t.name} (${t.currency_code})` })) || [],
              hint: 'Choose which token to sell'
            },
            {
              name: 'amountToken',
              label: 'Amount to Sell',
              type: 'number',
              placeholder: '1000',
              required: true,
              hint: 'Amount of tokens to sell'
            },
            {
              name: 'minXRP',
              label: 'Minimum XRP to Receive',
              type: 'number',
              placeholder: '50',
              required: true,
              hint: 'Minimum XRP you want to receive'
            }
          ],
          steps: [
            { label: 'Validate holdings', description: 'Checking token balance' },
            { label: 'Create sell order', description: 'Preparing sell order' },
            { label: 'Sign transaction', description: 'Signing with wallet' },
            { label: 'Submit order', description: 'Submitting to ledger' },
            { label: 'Confirm sale', description: 'Waiting for confirmation' }
          ],
          defaultValues: {
            amountToken: '1000',
            minXRP: '50'
          }
        }
      }
    };
  }

  async handleCreateBot() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet to create a trading bot.',
        data: {
          actions: [{
            label: 'Connect Wallet',
            icon: '🔗',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
          }]
        }
      };
    }

    const { data: tokens } = await supabase
      .from('tokens')
      .select('id, name, currency_code')
      .limit(50);

    return {
      content: 'Let\'s create an automated trading bot! I\'ll set it up for you.',
      data: {
        execution: {
          type: 'create_bot',
          icon: '🤖',
          title: 'Create Trading Bot',
          description: 'Automate your token trading',
          badge: 'Automation',
          fields: [
            {
              name: 'name',
              label: 'Bot Name',
              type: 'text',
              placeholder: 'My Trading Bot',
              required: true,
              hint: 'Give your bot a name'
            },
            {
              name: 'tokenId',
              label: 'Token to Trade',
              type: 'select',
              required: true,
              options: tokens?.map(t => ({ value: t.id, label: `${t.name} (${t.currency_code})` })) || [],
              hint: 'Which token should the bot trade'
            },
            {
              name: 'strategy',
              label: 'Trading Strategy',
              type: 'select',
              required: true,
              options: [
                { value: 'dca', label: 'Dollar Cost Averaging (DCA)' },
                { value: 'momentum', label: 'Momentum Trading' },
                { value: 'scalping', label: 'Scalping' }
              ],
              hint: 'Choose trading strategy'
            },
            {
              name: 'buyAmount',
              label: 'Buy Amount (XRP)',
              type: 'number',
              placeholder: '50',
              required: true,
              hint: 'Amount to spend per trade'
            },
            {
              name: 'buyThreshold',
              label: 'Buy Threshold (%)',
              type: 'number',
              placeholder: '-5',
              required: true,
              hint: 'Buy when price drops by this %'
            },
            {
              name: 'sellThreshold',
              label: 'Sell Threshold (%)',
              type: 'number',
              placeholder: '10',
              required: true,
              hint: 'Sell when price rises by this %'
            }
          ],
          steps: [
            { label: 'Validate settings', description: 'Checking bot configuration' },
            { label: 'Create bot', description: 'Setting up trading bot' },
            { label: 'Configure strategy', description: 'Applying trading rules' },
            { label: 'Activate bot', description: 'Starting automated trading' }
          ],
          defaultValues: {
            name: 'Trading Bot',
            strategy: 'dca',
            buyAmount: '50',
            buyThreshold: '-5',
            sellThreshold: '10'
          }
        }
      }
    };
  }

  async handleAddressBook() {
    if (!this.context.connectedWallet) {
      return {
        content: 'Please connect a wallet to view your address book.',
        data: {
          actions: [{
            label: 'Connect Wallet',
            icon: '🔗',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
          }]
        }
      };
    }

    try {
      const { data: contacts, error } = await supabase
        .from('address_book')
        .select('*')
        .eq('wallet_address', this.context.connectedWallet.address)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;

      const favoriteCount = contacts?.filter(c => c.is_favorite).length || 0;

      return {
        content: `Here is your address book with ${contacts?.length || 0} saved contacts:`,
        data: {
          card: {
            icon: '📇',
            title: 'Address Book',
            badge: `${contacts?.length || 0} Contacts`,
            items: [
              { label: 'Total Contacts', value: `${contacts?.length || 0}` },
              { label: 'Favorites', value: `${favoriteCount}` }
            ]
          },
          table: {
            headers: ['Name', 'Address', 'Notes'],
            rows: contacts?.slice(0, 10).map(contact => [
              contact.is_favorite ? `⭐ ${contact.name}` : contact.name,
              `${contact.address.slice(0, 20)}...`,
              contact.notes || 'No notes'
            ]) || []
          },
          actions: [
            {
              label: 'Send to Contact',
              icon: '📤',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('sendAIMessage', { detail: 'send tokens' }))
            }
          ]
        }
      };
    } catch (error) {
      return {
        content: 'I had trouble loading your address book. You can add contacts when sending tokens!',
        data: null
      };
    }
  }

  handleGeneral(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('create') && lowerMessage.includes('token')) {
      return {
        content: 'I cannot create tokens through the chat. Token creation requires admin access and must be done through the Memes page of the platform.',
        data: {
          actions: [{
            label: 'Go to Memes Page',
            icon: '🎨',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'memes' }))
          }]
        }
      };
    }

    if (lowerMessage.includes('admin') || lowerMessage.includes('settings') || lowerMessage.includes('configure')) {
      return {
        content: 'I don\'t have access to administrative functions or platform settings. I can only help with:\n\n• Wallet operations (balance, send, receive)\n• Token trading (buy/sell)\n• Market information\n• Address book management\n• Trading bot creation\n\nWhat would you like help with?',
        data: null
      };
    }

    if (!message || message.length < 3) {
      return {
        content: 'I\'m not sure I understand. Could you please provide more details about what you\'d like to do?\n\nFor example, you can ask me to:\n• "Send 10 XRP to an address"\n• "Buy some tokens"\n• "Check my balance"\n• "Show my address book"\n• "What are the top tokens?"\n\nWhat would you like help with?',
        data: null
      };
    }

    const suggestions = [
      'Check my balance',
      'Send XRP',
      'Send custom token',
      'Buy token',
      'Sell token',
      'Show address book'
    ];

    return {
      content: 'I\'m not sure what you\'re asking for. I can help you with:\n\n• Wallet Operations: Check balance, send/receive XRP and tokens\n• Trading: Buy and sell tokens from the platform\n• Address Book: Manage saved contacts for easy sending\n• Market Data: View prices, volumes, and analytics\n• Trading Bots: Create automated trading strategies\n\nNote: I cannot create tokens or access admin functions.\n\nTry one of these:',
      data: {
        quickActions: suggestions.map(label => ({
          label,
          onClick: () => {
            const messageEvent = new CustomEvent('sendAIMessage', { detail: label });
            window.dispatchEvent(messageEvent);
          }
        }))
      }
    };
  }
}

export default AIAssistant;
