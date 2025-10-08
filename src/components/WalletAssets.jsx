import React, { useState, useEffect } from 'react';
import { XRPScanLink } from './XRPScanLink';
import { getCurrencyInfo, formatBalance } from '../utils/currencyUtils';
import { PriceChart } from './PriceChart';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from './Modal';
import { SendXRP } from './SendXRP';
import toast from 'react-hot-toast';

// Token color mappings
const TOKEN_COLORS = {
  'XRP': 'from-blue-500/20 to-blue-600/20',
  'MAGICIAN': 'from-gray-500/20 to-gray-600/20',
  'SHAMAN': 'from-purple-500/20 to-purple-600/20',
  'MINT': 'from-green-500/20 to-green-600/20',
  'MAGIC': 'from-yellow-500/20 to-yellow-600/20',
  'WIZARD': 'from-blue-500/20 to-blue-600/20',
  'USDM': 'from-cyan-500/20 to-cyan-600/20',
  'RLUSD': 'from-blue-500/20 to-blue-600/20'
};

// Stablecoins with fixed $1 price
const STABLECOINS = ['RLUSD', 'USDM'];

export function WalletAssets({ 
  balance, 
  tokenBalances, 
  trustlines, 
  loading, 
  fetchBalancesAndTrustlines, 
  network,
  wallet,
  sendTransaction
}) {
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState([]);
  const [priceChange, setPriceChange] = useState({ value: -0.14, percentage: -1.92 });
  const [totalValueUSD, setTotalValueUSD] = useState(7.05);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    // Generate mock chart data for demonstration
    const now = Math.floor(Date.now() / 1000);
    const data = [];
    let price = 7.20;
    
    for (let i = 0; i < 100; i++) {
      price += (Math.random() - 0.5) * 0.1;
      data.push({
        time: now - (100 - i) * 900,
        value: price
      });
    }
    
    setChartData(data);
  }, [timeframe]);

  const handleSend = (asset) => {
    setSelectedAsset(asset);
    setShowSendModal(true);
  };

  const handleReceive = (asset) => {
    setSelectedAsset(asset);
    setShowReceiveModal(true);
  };

  const getAssetName = (asset) => {
    if (asset.currency === 'XRP') return 'XRP';
    const info = getCurrencyInfo(asset.currencyHex || Buffer.from(asset.currency, 'ascii').toString('hex').toUpperCase(), asset.issuer);
    return info.name;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleBuyClick = () => {
    window.open('https://magicmint.co', '_blank');
  };

  const handleEarnClick = () => {
    window.open('https://discord.gg/7W7nNtny8b', '_blank');
  };

  const getTokenGradient = (tokenName) => {
    return TOKEN_COLORS[tokenName] || 'from-gray-500/20 to-gray-600/20';
  };

  // Get USD value for a token balance
  const getUSDValue = (currency, balance) => {
    if (STABLECOINS.includes(currency)) {
      return parseFloat(balance); // 1:1 USD value for stablecoins
    }
    return null; // Return null for other tokens where we don't have price data
  };

  return (
    <div className="space-y-6">
      {/* Price Display and Chart */}
      <div className="bg-gray-900/90 rounded-lg p-6 border border-white/10">
        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold text-white mb-1">${totalValueUSD.toFixed(2)}</h2>
          <div className="text-gray-400">{parseFloat(balance).toFixed(3)} XRP</div>
          <div className={`flex items-center justify-center gap-2 mt-2 ${
            priceChange.percentage >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                d={priceChange.percentage >= 0 
                  ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                  : "M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"} 
              />
            </svg>
            <span>{priceChange.percentage.toFixed(2)}% (${Math.abs(priceChange.value).toFixed(2)})</span>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex justify-center gap-2 mb-4">
          {['1D', '1W', '1M', '1Y', 'ALL'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-1 rounded-md text-sm transition-all duration-200 ${
                timeframe === tf
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-48">
          <PriceChart data={chartData} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleBuyClick}
            className="bg-gray-900/75 hover:bg-gray-900/90 rounded-lg p-6 border border-white/10 flex flex-col items-center justify-center transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-gray-300">Buy</span>
          </button>
          <button 
            onClick={() => handleSend({ currency: 'XRP' })}
            className="bg-gray-900/75 hover:bg-gray-900/90 rounded-lg p-6 border border-white/10 flex flex-col items-center justify-center transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <span className="text-gray-300">Send</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => handleReceive({ currency: 'XRP' })}
            className="bg-gray-900/75 hover:bg-gray-900/90 rounded-lg p-6 border border-white/10 flex flex-col items-center justify-center transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <span className="text-gray-300">Receive</span>
          </button>
          <button 
            onClick={handleEarnClick}
            className="bg-gray-900/75 hover:bg-gray-900/90 rounded-lg p-6 border border-white/10 flex flex-col items-center justify-center transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-gray-300">Earn</span>
          </button>
        </div>
      </div>

      {/* Token Balances */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Token Balances</h2>
        <div className="space-y-2">
          {/* XRP Balance Card */}
          <div className="bg-gray-900/75 hover:bg-gray-900/90 rounded-lg p-3 border border-white/10 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold">XRP</h3>
                  <p className="text-gray-400 text-xs">Native Token</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-white font-semibold">{parseFloat(balance).toFixed(3)}</p>
                  <p className="text-green-500 text-xs">${totalValueUSD.toFixed(2)}</p>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleSend({ currency: 'XRP' })}
                    className="px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Send
                  </button>
                  <button 
                    onClick={() => handleReceive({ currency: 'XRP' })}
                    className="px-2 py-1 bg-gray-800 text-gray-300 text-sm rounded hover:bg-gray-700 transition-colors"
                  >
                    Receive
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Other Token Balances */}
          {trustlines.map((trustline, index) => {
            const info = getCurrencyInfo(trustline.currencyHex, trustline.issuer);
            const balance = parseFloat(trustline.balance);
            const formattedBalance = formatBalance(balance);
            const gradientClasses = getTokenGradient(info.name);
            const usdValue = getUSDValue(info.name, balance);
            
            return (
              <div key={index} className="bg-gray-900/75 hover:bg-gray-900/90 rounded-lg p-3 border border-white/10 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradientClasses} flex items-center justify-center`}>
                      <span className="text-gray-300 text-sm font-bold">{info.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{info.name}</h3>
                      <p className="text-gray-400 text-xs">{info.provider || 'Unknown Provider'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-white font-semibold text-sm">{formattedBalance}</p>
                      {usdValue !== null && (
                        <p className="text-green-500 text-xs">${usdValue.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleSend(trustline)}
                        className="px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        disabled={balance === 0}
                      >
                        Send
                      </button>
                      <button 
                        onClick={() => handleReceive(trustline)}
                        className="px-2 py-1 bg-gray-800 text-gray-300 text-sm rounded hover:bg-gray-700 transition-colors"
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {trustlines.length === 0 && (
            <div className="text-center py-8 text-gray-400 bg-gray-800/50 rounded-lg border border-white/10">
              No trustlines found
            </div>
          )}
        </div>
      </div>

      {/* Send Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => {
          setShowSendModal(false);
          setSelectedAsset(null);
        }}
        title={`Send ${selectedAsset ? getAssetName(selectedAsset) : ''}`}
      >
        <SendXRP
          wallet={wallet}
          network={network}
          loading={loading}
          sendTransaction={sendTransaction}
          selectedToken={selectedAsset}
        />
      </Modal>

      {/* Receive Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => {
          setShowReceiveModal(false);
          setSelectedAsset(null);
        }}
        title={`Receive ${selectedAsset ? getAssetName(selectedAsset) : ''}`}
      >
        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg mb-4">
              <QRCodeSVG 
                value={wallet?.address || ''}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Scan this code to receive {selectedAsset ? getAssetName(selectedAsset) : ''}
            </p>
          </div>
          
          <div className="bg-gray-800/50 p-4 rounded-lg border border-white/10">
            <label className="block text-sm font-medium text-gray-400 mb-2">Your Wallet Address</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wallet?.address || ''}
                readOnly
                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white"
              />
              <button
                onClick={() => copyToClipboard(wallet?.address)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
                title="Copy address"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
          </div>

          {selectedAsset?.currency !== 'XRP' && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-white/10">
              <label className="block text-sm font-medium text-gray-400 mb-2">Issuer Address</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selectedAsset?.issuer || ''}
                  readOnly
                  className="w-full bg-gray-900/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white"
                />
                <button
                  onClick={() => copyToClipboard(selectedAsset?.issuer)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
                  title="Copy issuer address"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}