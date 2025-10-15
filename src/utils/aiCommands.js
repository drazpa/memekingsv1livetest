export const AI_COMMANDS = {
  WALLET: [
    { id: 'check_balance', label: 'Check my XRP balance', prompt: 'What is my current XRP balance?' },
    { id: 'wallet_info', label: 'Show wallet information', prompt: 'Show me detailed information about my connected wallet' },
    { id: 'wallet_history', label: 'View transaction history', prompt: 'Show my recent transaction history' },
    { id: 'send_xrp', label: 'Send XRP to an address', prompt: 'I want to send XRP to another wallet' },
    { id: 'send_token', label: 'Send tokens', prompt: 'I want to send tokens from my wallet' },
    { id: 'receive_token', label: 'Receive tokens', prompt: 'Show me my wallet address to receive tokens' },
    { id: 'trustline_setup', label: 'Setup trustline', prompt: 'Help me setup a trustline for a token' },
    { id: 'wallet_assets', label: 'View all wallet assets', prompt: 'Show me all tokens and assets in my wallet' },
    { id: 'wallet_reserve', label: 'Check wallet reserve', prompt: 'What is my wallet reserve requirement?' },
    { id: 'export_wallet', label: 'Export wallet details', prompt: 'Export my wallet information' }
  ],
  TOKENS: [
    { id: 'token_list', label: 'List all tokens', prompt: 'Show me all available tokens' },
    { id: 'token_search', label: 'Search for a token', prompt: 'I want to search for a specific token' },
    { id: 'token_details', label: 'Get token details', prompt: 'Show me detailed information about a token' },
    { id: 'token_price', label: 'Check token price', prompt: 'What is the current price of a token?' },
    { id: 'token_holders', label: 'View token holders', prompt: 'Show me who holds a specific token' },
    { id: 'token_supply', label: 'Check token supply', prompt: 'What is the total supply of a token?' },
    { id: 'my_tokens', label: 'View my tokens', prompt: 'Show me all tokens I own' },
    { id: 'token_stats', label: 'Token statistics', prompt: 'Show me statistics for a token' },
    { id: 'token_performance', label: 'Token performance', prompt: 'How is a token performing?' },
    { id: 'token_comparison', label: 'Compare tokens', prompt: 'Compare two tokens for me' }
  ],
  TRADING: [
    { id: 'buy_token', label: 'Buy a token', prompt: 'I want to buy tokens' },
    { id: 'sell_token', label: 'Sell a token', prompt: 'I want to sell my tokens' },
    { id: 'swap_tokens', label: 'Swap tokens', prompt: 'I want to swap one token for another' },
    { id: 'trade_history', label: 'View trade history', prompt: 'Show me my recent trades' },
    { id: 'open_orders', label: 'View open orders', prompt: 'Show me my open orders' },
    { id: 'cancel_order', label: 'Cancel an order', prompt: 'I want to cancel an order' },
    { id: 'trade_analyze', label: 'Analyze trade', prompt: 'Analyze my trading performance' },
    { id: 'best_price', label: 'Find best price', prompt: 'Find the best price for a token' },
    { id: 'price_alert', label: 'Set price alert', prompt: 'Set a price alert for a token' },
    { id: 'slippage_settings', label: 'Adjust slippage', prompt: 'Help me adjust my slippage settings' }
  ],
  LIQUIDITY: [
    { id: 'add_liquidity', label: 'Add liquidity', prompt: 'I want to add liquidity to a pool' },
    { id: 'remove_liquidity', label: 'Remove liquidity', prompt: 'I want to remove liquidity from a pool' },
    { id: 'pool_stats', label: 'Pool statistics', prompt: 'Show me statistics for a liquidity pool' },
    { id: 'pool_apr', label: 'Check pool APR', prompt: 'What is the APR for a pool?' },
    { id: 'my_pools', label: 'My liquidity positions', prompt: 'Show me my liquidity positions' },
    { id: 'pool_earnings', label: 'Pool earnings', prompt: 'How much have I earned from pools?' },
    { id: 'best_pools', label: 'Best pools', prompt: 'Which pools have the best returns?' },
    { id: 'pool_history', label: 'Pool history', prompt: 'Show me the history of a pool' },
    { id: 'impermanent_loss', label: 'Check impermanent loss', prompt: 'Calculate my impermanent loss' },
    { id: 'pool_share', label: 'My pool share', prompt: 'What is my share of a pool?' }
  ],
  BOT_TRADING: [
    { id: 'create_bot', label: 'Create trading bot', prompt: 'I want to create a new trading bot' },
    { id: 'bot_status', label: 'Check bot status', prompt: 'What is the status of my trading bots?' },
    { id: 'bot_performance', label: 'Bot performance', prompt: 'How are my bots performing?' },
    { id: 'bot_trades', label: 'View bot trades', prompt: 'Show me trades executed by my bots' },
    { id: 'stop_bot', label: 'Stop a bot', prompt: 'Stop a trading bot' },
    { id: 'bot_settings', label: 'Adjust bot settings', prompt: 'I want to adjust my bot settings' },
    { id: 'bot_strategy', label: 'Change bot strategy', prompt: 'Change the strategy for my bot' },
    { id: 'bot_profits', label: 'Bot profits', prompt: 'How much profit have my bots made?' },
    { id: 'bot_errors', label: 'Check bot errors', prompt: 'Show me any errors from my bots' },
    { id: 'bot_analytics', label: 'Bot analytics', prompt: 'Show me detailed analytics for my bots' }
  ],
  MARKET: [
    { id: 'xrp_price', label: 'XRP Price (USD)', prompt: 'What is the price of XRP?' },
    { id: 'market_overview', label: 'Market overview', prompt: 'Give me a market overview' },
    { id: 'top_gainers', label: 'Top gainers', prompt: 'Show me the top gaining tokens' },
    { id: 'top_losers', label: 'Top losers', prompt: 'Show me the biggest losing tokens' },
    { id: 'trending_tokens', label: 'Trending tokens', prompt: 'What tokens are trending right now?' },
    { id: 'market_cap', label: 'Market cap rankings', prompt: 'Show me tokens ranked by market cap' },
    { id: 'volume_leaders', label: 'Volume leaders', prompt: 'Which tokens have the highest volume?' },
    { id: 'new_tokens', label: 'New tokens', prompt: 'Show me recently created tokens' },
    { id: 'market_sentiment', label: 'Market sentiment', prompt: 'What is the current market sentiment?' },
    { id: 'price_changes', label: '24h price changes', prompt: 'Show me 24 hour price changes' },
    { id: 'market_alerts', label: 'Market alerts', prompt: 'Show me any market alerts' }
  ],
  ANALYTICS: [
    { id: 'portfolio_value', label: 'Portfolio value', prompt: 'What is my total portfolio value?' },
    { id: 'portfolio_breakdown', label: 'Portfolio breakdown', prompt: 'Break down my portfolio by asset' },
    { id: 'profit_loss', label: 'Profit & Loss', prompt: 'Show me my profit and loss' },
    { id: 'performance_chart', label: 'Performance chart', prompt: 'Show me a performance chart' },
    { id: 'roi_calculation', label: 'Calculate ROI', prompt: 'Calculate my return on investment' },
    { id: 'asset_allocation', label: 'Asset allocation', prompt: 'Show me my asset allocation' },
    { id: 'transaction_summary', label: 'Transaction summary', prompt: 'Summarize my transactions' },
    { id: 'tax_report', label: 'Tax report', prompt: 'Generate a tax report' },
    { id: 'historical_data', label: 'Historical data', prompt: 'Show me historical data' },
    { id: 'export_data', label: 'Export analytics', prompt: 'Export my analytics data' }
  ],
  TOKEN_CREATION: [
    { id: 'create_token', label: 'Create new token', prompt: 'I want to create a new token' },
    { id: 'token_wizard', label: 'Token creation wizard', prompt: 'Guide me through creating a token' },
    { id: 'upload_metadata', label: 'Upload token metadata', prompt: 'Help me upload token metadata' },
    { id: 'set_supply', label: 'Set token supply', prompt: 'How do I set the token supply?' },
    { id: 'token_settings', label: 'Configure token settings', prompt: 'Help me configure my token settings' },
    { id: 'deploy_token', label: 'Deploy token', prompt: 'I\'m ready to deploy my token' },
    { id: 'verify_token', label: 'Verify token', prompt: 'How do I verify my token?' },
    { id: 'token_branding', label: 'Add token branding', prompt: 'Help me add branding to my token' },
    { id: 'token_icon', label: 'Upload token icon', prompt: 'I want to upload an icon for my token' },
    { id: 'token_whitepaper', label: 'Create whitepaper', prompt: 'Help me create a whitepaper' }
  ],
  PLATFORM: [
    { id: 'navigate_dashboard', label: 'Go to Dashboard', prompt: 'Take me to the dashboard' },
    { id: 'navigate_trade', label: 'Go to Trade', prompt: 'Take me to the trading page' },
    { id: 'navigate_pools', label: 'Go to Pools', prompt: 'Take me to the pools page' },
    { id: 'navigate_vault', label: 'Go to Vault', prompt: 'Take me to the vault' },
    { id: 'navigate_analytics', label: 'Go to Analytics', prompt: 'Take me to analytics' },
    { id: 'platform_stats', label: 'Platform statistics', prompt: 'Show me platform statistics' },
    { id: 'recent_activity', label: 'Recent activity', prompt: 'Show me recent platform activity' },
    { id: 'notifications', label: 'View notifications', prompt: 'Show me my notifications' },
    { id: 'settings', label: 'Open settings', prompt: 'Open platform settings' },
    { id: 'help_center', label: 'Help center', prompt: 'I need help with something' }
  ],
  XRPL: [
    { id: 'xrp_price', label: 'XRP price', prompt: 'What is the current XRP price?' },
    { id: 'xrpl_status', label: 'XRPL network status', prompt: 'What is the status of the XRPL network?' },
    { id: 'ledger_info', label: 'Ledger information', prompt: 'Show me current ledger information' },
    { id: 'transaction_cost', label: 'Transaction costs', prompt: 'What are the current transaction costs?' },
    { id: 'network_stats', label: 'Network statistics', prompt: 'Show me XRPL network statistics' },
    { id: 'validators', label: 'Validator information', prompt: 'Show me information about validators' },
    { id: 'xrpl_explorer', label: 'Open XRPL explorer', prompt: 'Open the XRPL explorer' },
    { id: 'ripple_news', label: 'Ripple news', prompt: 'What\'s the latest news about Ripple?' },
    { id: 'xrpl_docs', label: 'XRPL documentation', prompt: 'I need XRPL documentation' },
    { id: 'network_upgrades', label: 'Network upgrades', prompt: 'Are there any upcoming network upgrades?' }
  ]
};

export function getAllCommands() {
  return Object.entries(AI_COMMANDS).flatMap(([category, commands]) =>
    commands.map(cmd => ({ ...cmd, category }))
  );
}

export function getCommandsByCategory(category) {
  return AI_COMMANDS[category] || [];
}

export function searchCommands(query) {
  const lowerQuery = query.toLowerCase();
  return getAllCommands().filter(cmd =>
    cmd.label.toLowerCase().includes(lowerQuery) ||
    cmd.prompt.toLowerCase().includes(lowerQuery)
  );
}
