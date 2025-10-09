import { Client } from 'xrpl';
import { supabase } from './supabase';
import { getXRPBalance } from './xrplBalance';

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
    }
  }

  async processMessage(message) {
    const lowerMessage = message.toLowerCase();

    if (this.isSendTokenQuery(lowerMessage)) {
      return await this.handleSendToken();
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
    return msg.includes('token') && (msg.includes('info') || msg.includes('about') || msg.includes('details'));
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
    return (msg.includes('send') && (msg.includes('token') || msg.includes('xrp'))) || msg.includes('transfer');
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
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select('*')
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

      return {
        content: `I found ${tokens.length} recent tokens. Here are the latest:`,
        data: {
          table: {
            headers: ['Token', 'Symbol', 'Creator', 'Created'],
            rows: tokens.slice(0, 5).map(token => [
              token.name || 'Unknown',
              token.currency_code || 'N/A',
              `${token.issuer_address?.slice(0, 8)}...`,
              new Date(token.created_at).toLocaleDateString()
            ])
          },
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
    } catch (error) {
      return {
        content: 'I had trouble fetching token information. Please try again.',
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

      return {
        content: `Here are your ${trades.length} most recent trades:`,
        data: {
          table: {
            headers: ['Type', 'Amount', 'Status', 'Date'],
            rows: trades.map(trade => [
              trade.trade_type || 'Unknown',
              `${trade.amount_bought || 0} tokens`,
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
    return {
      content: 'I can help you check token prices! To get the most accurate price information, please visit the Trade page where you can see real-time prices for all tokens.',
      data: {
        actions: [
          {
            label: 'View Prices',
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
  }

  async handleMarketQuery() {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const { count: totalTokens } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true });

      const { count: totalPools } = await supabase
        .from('liquidity_pools')
        .select('*', { count: 'exact', head: true });

      return {
        content: 'Here is the current market overview:',
        data: {
          card: {
            icon: '📊',
            title: 'Market Overview',
            badge: 'Live Data',
            items: [
              { label: 'Total Tokens', value: `${totalTokens || 0}` },
              { label: 'Active Pools', value: `${totalPools || 0}` },
              { label: 'Recent Tokens', value: `${tokens?.length || 0} new today` }
            ]
          },
          actions: [
            {
              label: 'View Top 10',
              icon: '👑',
              style: 'primary',
              onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'top10' }))
            },
            {
              label: 'View Analytics',
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

  async handleSendToken() {
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

    return {
      content: 'I can help you send tokens! You can send XRP or any other tokens from your wallet.',
      data: {
        card: {
          icon: '📤',
          title: 'Send Tokens',
          badge: 'Connected',
          items: [
            { label: 'From Wallet', value: this.context.connectedWallet.name },
            { label: 'Address', value: `${this.context.connectedWallet.address.slice(0, 12)}...` }
          ],
          description: 'Go to the Wallets page to send XRP or tokens to any XRPL address.'
        },
        actions: [
          {
            label: 'Send Tokens',
            icon: '📤',
            style: 'primary',
            onClick: () => window.dispatchEvent(new CustomEvent('navigateToPage', { detail: 'wallets' }))
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

  handleGeneral(message) {
    const suggestions = [
      'Check my balance',
      'Send tokens',
      'Show me the top tokens',
      'What\'s happening in the market?',
      'Show my recent trades',
      'View my bot status'
    ];

    return {
      content: 'I understand you\'re asking about XRPL and the platform. I can help you with:\n\n• Checking wallet balances\n• Sending and receiving tokens\n• Getting token information\n• Viewing trade history\n• Managing trading bots\n• Market overviews\n• Navigating the platform\n\nTry asking one of these:',
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
