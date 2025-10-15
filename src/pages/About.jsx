export default function About() {
  return (
    <div className="space-y-6">
      <div className="glass rounded-lg p-8 border-2 border-purple-500/30">
        <h2 className="text-4xl font-bold text-purple-200 mb-2">About MemeKings</h2>
        <p className="text-xl text-purple-300">The Premier XRPL Meme Token Factory & Trading Platform</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-lg p-6 border border-green-500/30">
          <div className="text-4xl mb-3">🚀</div>
          <div className="text-2xl font-bold text-green-200 mb-2">Fast</div>
          <p className="text-green-300 text-sm">3-5 second transactions on XRPL with instant finality</p>
        </div>
        <div className="glass rounded-lg p-6 border border-blue-500/30">
          <div className="text-4xl mb-3">💰</div>
          <div className="text-2xl font-bold text-blue-200 mb-2">Low Cost</div>
          <p className="text-blue-300 text-sm">Minimal blockchain fees + 0.01 XRP platform trading fee</p>
        </div>
        <div className="glass rounded-lg p-6 border border-purple-500/30">
          <div className="text-4xl mb-3">🔒</div>
          <div className="text-2xl font-bold text-purple-200 mb-2">Secure</div>
          <p className="text-purple-300 text-sm">Battle-tested XRPL with native AMM support</p>
        </div>
      </div>

      <div className="glass rounded-lg p-8">
        <h3 className="text-3xl font-bold text-purple-200 mb-6">Platform Overview</h3>
        <p className="text-purple-300 leading-relaxed mb-6">
          MemeKings is a comprehensive decentralized platform built on the XRP Ledger that enables anyone to create, trade, and profit from meme tokens. We combine the power of XRPL native AMM (Automated Market Maker) functionality with an intuitive interface to provide instant liquidity, transparent pricing, and community-driven token economics.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-purple-900/30 rounded-lg p-6">
            <h4 className="text-xl font-bold text-purple-200 mb-3">What Makes Us Different</h4>
            <ul className="space-y-2 text-purple-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Native XRPL Integration - Built directly on XRPL, not a smart contract layer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Instant Liquidity - AMM pools created automatically with every token</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>No Gas Wars - Predictable, minimal fees on every transaction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>10% APY Vault - Earn passive income on held tokens</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>AI Trading Bot - Automated 24/7 trading with custom strategies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Real-Time Analytics - Live market data and trading insights</span>
              </li>
            </ul>
          </div>

          <div className="bg-purple-900/30 rounded-lg p-6">
            <h4 className="text-xl font-bold text-purple-200 mb-3">Key Metrics</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-purple-400">Transaction Speed</span>
                <span className="text-purple-200 font-bold">3-5 seconds</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400">Trading Fee</span>
                <span className="text-purple-200 font-bold">0.01 XRP</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400">Token Listing Fee</span>
                <span className="text-purple-200 font-bold">1 XRP</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400">Vault APY</span>
                <span className="text-green-400 font-bold">10%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400">Collection Fee</span>
                <span className="text-purple-200 font-bold">0.01 XRP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-8">
        <h3 className="text-3xl font-bold text-purple-200 mb-6">Complete Feature Set</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-lg p-6 border border-purple-500/30">
            <div className="text-3xl mb-3">🏭</div>
            <h4 className="text-xl font-bold text-purple-200 mb-3">Token Creation</h4>
            <p className="text-purple-300 text-sm mb-3">
              Create your own meme token on XRPL in minutes with automatic AMM pool creation for instant liquidity.
            </p>
            <ul className="space-y-2 text-purple-400 text-sm">
              <li>• Custom token name, symbol, and supply</li>
              <li>• Automatic AMM pool deployment</li>
              <li>• Initial liquidity setup with XRP</li>
              <li>• Token metadata and branding</li>
              <li>• Instant market availability</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-900/50 to-teal-900/50 rounded-lg p-6 border border-green-500/30">
            <div className="text-3xl mb-3">📝</div>
            <h4 className="text-xl font-bold text-green-200 mb-3">Token Listing Service</h4>
            <p className="text-green-300 text-sm mb-3">
              List existing tokens on the platform with comprehensive metadata collection for maximum visibility.
            </p>
            <ul className="space-y-2 text-green-400 text-sm">
              <li>• 1 XRP listing fee</li>
              <li>• Full token information capture</li>
              <li>• AMM pool data integration</li>
              <li>• Social links and branding</li>
              <li>• Optional featured placement</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-yellow-900/50 to-orange-900/50 rounded-lg p-6 border border-yellow-500/30">
            <div className="text-3xl mb-3">⭐</div>
            <h4 className="text-xl font-bold text-yellow-200 mb-3">Featured Spot System</h4>
            <p className="text-yellow-300 text-sm mb-3">
              Boost your token visibility with premium featured placement on the main page with flexible duration options.
            </p>
            <ul className="space-y-2 text-yellow-400 text-sm">
              <li>• 1 Day: 10 XRP</li>
              <li>• 3 Days: 25 XRP</li>
              <li>• 7 Days: 50 XRP</li>
              <li>• 30 Days: 150 XRP</li>
              <li>• Top-of-page prominence</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-lg p-6 border border-blue-500/30">
            <div className="text-3xl mb-3">💱</div>
            <h4 className="text-xl font-bold text-blue-200 mb-3">DEX Trading</h4>
            <p className="text-blue-300 text-sm mb-3">
              Trade tokens directly with XRPL native AMM pools for instant execution and guaranteed liquidity.
            </p>
            <ul className="space-y-2 text-blue-400 text-sm">
              <li>• Real-time price quotes</li>
              <li>• Configurable slippage tolerance</li>
              <li>• Instant trade execution</li>
              <li>• Price impact visualization</li>
              <li>• Transaction history tracking</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-red-900/50 to-pink-900/50 rounded-lg p-6 border border-red-500/30">
            <div className="text-3xl mb-3">🤖</div>
            <h4 className="text-xl font-bold text-red-200 mb-3">AI Trading Bot</h4>
            <p className="text-red-300 text-sm mb-3">
              Automated trading bot with multiple strategies for 24/7 passive income generation.
            </p>
            <ul className="space-y-2 text-red-400 text-sm">
              <li>• Scalping: Quick profits from small moves</li>
              <li>• HODL: Buy and hold strategy</li>
              <li>• DCA: Dollar-cost averaging</li>
              <li>• Grid Trading: Range-bound profits</li>
              <li>• Custom take profit and stop loss</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-lg p-6 border border-indigo-500/30">
            <div className="text-3xl mb-3">🏦</div>
            <h4 className="text-xl font-bold text-indigo-200 mb-3">Passive Earnings Vault</h4>
            <p className="text-indigo-300 text-sm mb-3">
              Earn 10% APY automatically on all token holdings with daily compounding rewards.
            </p>
            <ul className="space-y-2 text-indigo-400 text-sm">
              <li>• 10% annual percentage yield</li>
              <li>• Automatic daily accrual</li>
              <li>• One-click collection</li>
              <li>• No lock-up period</li>
              <li>• Earnings tracking dashboard</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-teal-900/50 to-green-900/50 rounded-lg p-6 border border-teal-500/30">
            <div className="text-3xl mb-3">💰</div>
            <h4 className="text-xl font-bold text-teal-200 mb-3">XRP Rewards Program</h4>
            <p className="text-teal-300 text-sm mb-3">
              Earn XRP rewards for platform activities including token creation, trading, and referrals.
            </p>
            <ul className="space-y-2 text-teal-400 text-sm">
              <li>• Token creation rewards</li>
              <li>• Trading volume bonuses</li>
              <li>• Daily activity rewards</li>
              <li>• Referral commissions</li>
              <li>• Instant XRP payouts</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg p-6 border border-purple-500/30">
            <div className="text-3xl mb-3">💎</div>
            <h4 className="text-xl font-bold text-purple-200 mb-3">Portfolio Management</h4>
            <p className="text-purple-300 text-sm mb-3">
              Comprehensive portfolio tracking with list and grid views for all your token holdings.
            </p>
            <ul className="space-y-2 text-purple-400 text-sm">
              <li>• Real-time balance updates</li>
              <li>• USD value calculations</li>
              <li>• Supply percentage tracking</li>
              <li>• Quick send and receive</li>
              <li>• Mobile-optimized grid view</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-lg p-6 border border-orange-500/30">
            <div className="text-3xl mb-3">📊</div>
            <h4 className="text-xl font-bold text-orange-200 mb-3">Advanced Analytics</h4>
            <p className="text-orange-300 text-sm mb-3">
              Professional-grade charting and analytics for informed trading decisions.
            </p>
            <ul className="space-y-2 text-orange-400 text-sm">
              <li>• Real-time price charts</li>
              <li>• Trading volume metrics</li>
              <li>• Market cap tracking</li>
              <li>• Liquidity depth analysis</li>
              <li>• Historical performance data</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 rounded-lg p-6 border border-cyan-500/30">
            <div className="text-3xl mb-3">💬</div>
            <h4 className="text-xl font-bold text-cyan-200 mb-3">AI Chat Assistant</h4>
            <p className="text-cyan-300 text-sm mb-3">
              Intelligent AI assistant for platform guidance, market insights, and automated commands.
            </p>
            <ul className="space-y-2 text-cyan-400 text-sm">
              <li>• Natural language queries</li>
              <li>• Market analysis on demand</li>
              <li>• Platform feature explanations</li>
              <li>• Trading assistance</li>
              <li>• Command execution via chat</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-pink-900/50 to-purple-900/50 rounded-lg p-6 border border-pink-500/30">
            <div className="text-3xl mb-3">🏊</div>
            <h4 className="text-xl font-bold text-pink-200 mb-3">Liquidity Pools</h4>
            <p className="text-pink-300 text-sm mb-3">
              Earn fees by providing liquidity to AMM pools and track LP token performance.
            </p>
            <ul className="space-y-2 text-pink-400 text-sm">
              <li>• Add liquidity to any pool</li>
              <li>• Earn trading fees passively</li>
              <li>• LP token management</li>
              <li>• Pool share tracking</li>
              <li>• Detailed history logs</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-lg p-6 border border-green-500/30">
            <div className="text-3xl mb-3">📱</div>
            <h4 className="text-xl font-bold text-green-200 mb-3">Mobile-First Design</h4>
            <p className="text-green-300 text-sm mb-3">
              Fully responsive interface optimized for mobile trading and portfolio management.
            </p>
            <ul className="space-y-2 text-green-400 text-sm">
              <li>• Touch-optimized controls</li>
              <li>• Adaptive view modes</li>
              <li>• Mobile-friendly navigation</li>
              <li>• Network selector integration</li>
              <li>• Fast loading times</li>
            </ul>
          </div>

        </div>
      </div>

      <div className="glass rounded-lg p-8">
        <h3 className="text-3xl font-bold text-purple-200 mb-6">How to Get Started</h3>
        <div className="space-y-6">
          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white text-2xl font-bold">
              1
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-purple-200 mb-2">Create or Connect Your Wallet</h4>
              <p className="text-purple-300 mb-3">
                Navigate to the Setup page to create a new XRPL wallet or connect an existing one. Your wallet is your gateway to the MemeKings ecosystem. You can manage multiple wallets and switch between testnet and mainnet.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="text-blue-200 text-sm font-medium mb-2">💡 Pro Tip:</div>
                <p className="text-blue-300 text-sm">
                  Always securely backup your wallet seed. MemeKings uses client-side encryption - we never have access to your private keys. Use the PIN protection feature for additional security.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white text-2xl font-bold">
              2
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-purple-200 mb-2">Explore Tokens and Markets</h4>
              <p className="text-purple-300 mb-3">
                Browse the Memes page to discover community tokens. View the Top 10 for highest performers, check the Kings List for featured tokens, or explore by category. Each token displays detailed analytics, price charts, and liquidity information.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-3">
                  <div className="text-purple-400 text-xs mb-1">Real-Time Data</div>
                  <p className="text-purple-200 text-sm">Live prices and volume</p>
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-purple-400 text-xs mb-1">Deep Analytics</div>
                  <p className="text-purple-200 text-sm">Charts and market metrics</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white text-2xl font-bold">
              3
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-green-200 mb-2">Trade and Earn</h4>
              <p className="text-green-300 mb-3">
                Buy tokens using the Trade page with instant AMM execution. Enable the Trading Bot for automated strategies, or add liquidity to pools to earn trading fees. All your holdings automatically earn 10% APY in the Vault.
              </p>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-green-200 font-bold">Manual Trading</div>
                    <p className="text-green-400 text-xs mt-1">Full control</p>
                  </div>
                  <div>
                    <div className="text-green-200 font-bold">Bot Trading</div>
                    <p className="text-green-400 text-xs mt-1">24/7 automation</p>
                  </div>
                  <div>
                    <div className="text-green-200 font-bold">Vault Earnings</div>
                    <p className="text-green-400 text-xs mt-1">Passive APY</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-600 to-yellow-800 flex items-center justify-center text-white text-2xl font-bold">
              4
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-yellow-200 mb-2">Create Your Own Token</h4>
              <p className="text-yellow-300 mb-3">
                Launch your own meme token from the Dashboard with automatic AMM pool creation. Set your supply, initial liquidity, token metadata, and watch it go live instantly. Optionally purchase featured placement for maximum visibility.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-3 bg-yellow-500/10">
                  <div className="text-yellow-400 text-xs mb-1">Full Control</div>
                  <p className="text-yellow-200 text-sm">Your token, your rules</p>
                </div>
                <div className="glass rounded-lg p-3 bg-yellow-500/10">
                  <div className="text-yellow-400 text-xs mb-1">Instant Market</div>
                  <p className="text-yellow-200 text-sm">Trading starts immediately</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-lg p-8 border border-yellow-500/30 bg-yellow-500/5">
        <h3 className="text-3xl font-bold text-yellow-200 mb-4">⚠️ Community-Based Economics</h3>
        <div className="space-y-4">
          <p className="text-yellow-300 leading-relaxed">
            MemeKings operates on pure free-market principles. All token values are determined entirely by community demand, trading volume, AMM liquidity depth, and supply circulation. The platform provides tools and infrastructure, but does not control, guarantee, or influence token prices.
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mt-4">
            <h4 className="text-xl font-bold text-yellow-200 mb-3">🎰 No Crying in the Casino</h4>
            <p className="text-yellow-300 text-sm mb-3">
              This is a decentralized trading platform with real financial risk. Token prices can be highly volatile. Meme tokens are speculative assets and may lose all value.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-red-500/20 border border-red-500/30 rounded p-3 text-center">
                <div className="text-red-200 font-bold mb-1">NO Guarantees</div>
                <p className="text-red-300 text-xs">No promises of returns</p>
              </div>
              <div className="bg-red-500/20 border border-red-500/30 rounded p-3 text-center">
                <div className="text-red-200 font-bold mb-1">NO Refunds</div>
                <p className="text-red-300 text-xs">All trades are final</p>
              </div>
              <div className="bg-red-500/20 border border-red-500/30 rounded p-3 text-center">
                <div className="text-red-200 font-bold mb-1">NO Bailouts</div>
                <p className="text-red-300 text-xs">You own your risk</p>
              </div>
            </div>
            <p className="text-yellow-200 font-bold text-center mt-4">
              ⚡ Only trade what you can afford to lose ⚡
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-2 border-purple-500/50 rounded-lg p-8 text-center">
        <h3 className="text-3xl font-bold text-purple-200 mb-3">Ready to Start Trading?</h3>
        <p className="text-purple-300 mb-6">
          Join the MemeKings community and start capitalizing on meme token opportunities
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'setup' }))}
          className="btn-primary text-white px-12 py-4 rounded-lg font-bold text-lg hover:scale-105 transition-transform"
        >
          Create Wallet & Get Started →
        </button>
      </div>
    </div>
  );
}
