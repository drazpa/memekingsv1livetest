export default function About() {
  return (
    <div className="space-y-6">
      <div className="glass rounded-lg p-8 border-2 border-purple-500/30">
        <h2 className="text-4xl font-bold text-purple-200 mb-2">About MemeKings</h2>
        <p className="text-xl text-purple-300">The Premier XRPL Meme Coin Factory & Trading Platform</p>
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
                <span className="text-purple-400">Vault APY</span>
                <span className="text-green-400 font-bold">10%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400">Collection Fee</span>
                <span className="text-purple-200 font-bold">0.01 XRP</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-400">Send/Receive Fee</span>
                <span className="text-purple-200 font-bold">0.01 XRP</span>
              </div>
            </div>
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
                Navigate to the Setup page to create a new XRPL wallet or connect an existing one. Your wallet is your gateway to the MemeKings ecosystem.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="text-blue-200 text-sm font-medium mb-2">💡 Pro Tip:</div>
                <p className="text-blue-300 text-sm">
                  Always securely backup your wallet seed. MemeKings uses client-side encryption - we never have access to your private keys.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white text-2xl font-bold">
              2
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-purple-200 mb-2">Browse the MemeKings Token Selection</h4>
              <p className="text-purple-300 mb-3">
                Head to the Memes page to explore our curated selection of community-created tokens. Each token has detailed information, price charts, and AMM pool data.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-3">
                  <div className="text-purple-400 text-xs mb-1">View Token Details</div>
                  <p className="text-purple-200 text-sm">Click any token to see full analytics</p>
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-purple-400 text-xs mb-1">Check Liquidity</div>
                  <p className="text-purple-200 text-sm">See AMM pool depth and volume</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white text-2xl font-bold">
              3
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-green-200 mb-2">Buy Coins from Our Selection</h4>
              <p className="text-green-300 mb-3">
                Use the Trade page to buy tokens with XRP. Set your slippage tolerance, review the trade estimate, and execute instantly through the AMM.
              </p>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-green-200 font-bold">Setup Trustline</div>
                    <p className="text-green-400 text-xs mt-1">One-time per token</p>
                  </div>
                  <div>
                    <div className="text-green-200 font-bold">Enter Amount</div>
                    <p className="text-green-400 text-xs mt-1">XRP or tokens</p>
                  </div>
                  <div>
                    <div className="text-green-200 font-bold">Execute Trade</div>
                    <p className="text-green-400 text-xs mt-1">Instant settlement</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-2xl font-bold">
              4
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-red-200 mb-2">Sell When Ready</h4>
              <p className="text-red-300 mb-3">
                Exit positions anytime through the Trade page. The AMM ensures instant liquidity - no waiting for buyers or sellers.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-3 bg-red-500/10">
                  <div className="text-red-400 text-xs mb-1">Market Orders</div>
                  <p className="text-red-200 text-sm">Instant execution at current price</p>
                </div>
                <div className="glass rounded-lg p-3 bg-red-500/10">
                  <div className="text-red-400 text-xs mb-1">0.01 XRP Fee</div>
                  <p className="text-red-200 text-sm">Flat rate per transaction</p>
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
            MemeKings operates on pure free-market principles. All token values are determined entirely by community demand, trading volume, AMM liquidity depth, and supply circulation.
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mt-4">
            <h4 className="text-xl font-bold text-yellow-200 mb-3">🎰 No Crying in the Casino</h4>
            <p className="text-yellow-300 text-sm mb-3">
              This is a decentralized trading platform with real financial risk. Token prices can be highly volatile.
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
