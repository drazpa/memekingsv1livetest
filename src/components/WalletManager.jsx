import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { XRPScanLink } from './XRPScanLink';
import { Wallet as XrplWallet } from 'xrpl';
import toast from 'react-hot-toast';
import { PinProtection } from './PinProtection';

export function WalletManager({ 
  loading, 
  generateWallet, 
  wallet, 
  balance, 
  savedWallets, 
  loadWallet, 
  deleteWallet,
  network 
}) {
  const [importSeed, setImportSeed] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showXamanImport, setShowXamanImport] = useState(false);
  const [xamanWords, setXamanWords] = useState(['', '', '', '', '', '', '', '']);
  const [visibleSeeds, setVisibleSeeds] = useState(new Set());
  const [walletLabels, setWalletLabels] = useState(() => {
    const saved = localStorage.getItem('wallet_labels');
    return saved ? JSON.parse(saved) : {};
  });
  const [editingLabel, setEditingLabel] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingSeedView, setPendingSeedView] = useState(null);

  const updateLabel = (address, label) => {
    const newLabels = { ...walletLabels, [address]: label };
    setWalletLabels(newLabels);
    localStorage.setItem('wallet_labels', JSON.stringify(newLabels));
  };

  const handleImportWallet = () => {
    const seed = importSeed.trim();
    
    if (!seed) {
      toast.error('Please enter a seed');
      return;
    }

    try {
      const importedWallet = XrplWallet.fromSeed(seed);
      
      loadWallet({
        seed: seed,
        address: importedWallet.address,
        network: network
      });

      setImportSeed('');
      setShowImport(false);
      toast.success('Wallet imported successfully');
    } catch (error) {
      toast.error('Invalid seed. Please check and try again.');
    }
  };

  const handleXamanImport = () => {
    // Check if all words are filled
    if (xamanWords.some(word => !word.trim())) {
      toast.error('Please fill in all words');
      return;
    }

    try {
      // Convert Xaman words to family seed
      const familySeed = xamanWords.join('').toUpperCase();
      const importedWallet = XrplWallet.fromSeed(familySeed);
      
      loadWallet({
        seed: familySeed,
        address: importedWallet.address,
        network: network
      });

      setXamanWords(['', '', '', '', '', '', '', '']);
      setShowXamanImport(false);
      toast.success('Xaman wallet imported successfully');
    } catch (error) {
      toast.error('Invalid Xaman words. Please check and try again.');
    }
  };

  const toggleSeedVisibility = (address) => {
    const isVisible = visibleSeeds.has(address);

    if (isVisible) {
      setVisibleSeeds(prev => {
        const newSet = new Set(prev);
        newSet.delete(address);
        return newSet;
      });
    } else {
      const hasPinSet = localStorage.getItem(`wallet_pin_${address}`);
      if (hasPinSet) {
        setPendingSeedView(address);
        setShowPinModal(true);
      } else {
        setPendingSeedView(address);
        setShowPinModal(true);
      }
    }
  };

  const handlePinSuccess = () => {
    if (pendingSeedView) {
      setVisibleSeeds(prev => {
        const newSet = new Set(prev);
        newSet.add(pendingSeedView);
        return newSet;
      });
      setPendingSeedView(null);
    }
    setShowPinModal(false);
  };

  const handlePinCancel = () => {
    setPendingSeedView(null);
    setShowPinModal(false);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-700/50 shadow-lg">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Wallet Management</h2>
        
        {network === 'mainnet' && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="text-yellow-200 font-semibold mb-1">Mainnet Wallet Activation Required</h4>
                <p className="text-yellow-300 text-sm">
                  After generating a wallet, you must send at least 2 XRP to activate it on mainnet.
                  Additional XRP is recommended for transaction fees and trading activities.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={generateWallet}
            disabled={loading}
            className="bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-4 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300"
          >
            {loading ? 'Processing...' : 'Generate New Wallet'}
          </button>
          <button
            onClick={() => {
              setShowImport(!showImport);
              setShowXamanImport(false);
            }}
            className="bg-gray-800/50 text-gray-300 py-3 px-4 rounded-lg hover:bg-gray-700/50 transition-all duration-300"
          >
            Import Wallet
          </button>
          <button
            onClick={() => {
              setShowXamanImport(!showXamanImport);
              setShowImport(false);
            }}
            className="bg-gray-800/50 text-gray-300 py-3 px-4 rounded-lg hover:bg-gray-700/50 transition-all duration-300"
          >
            Import Xaman
          </button>
        </div>

        {showImport && (
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">Import from Seed</h3>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={importSeed}
                  onChange={(e) => setImportSeed(e.target.value)}
                  placeholder="Enter wallet seed"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg shadow-lg focus:border-green-500 focus:ring-green-500/50"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Enter your wallet seed (family seed) starting with 's'
                </p>
              </div>
              <button
                onClick={handleImportWallet}
                disabled={!importSeed.trim()}
                className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-2 px-4 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300"
              >
                Import Wallet
              </button>
            </div>
          </div>
        )}

        {showXamanImport && (
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">Import from Xaman</h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter your 8 Xaman words in order (A B C D E F G H)
              </p>
              <div className="grid grid-cols-4 gap-3">
                {xamanWords.map((word, index) => (
                  <div key={index} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-400">
                      Word {String.fromCharCode(65 + index)}
                    </label>
                    <input
                      type="text"
                      value={word}
                      onChange={(e) => {
                        const newWords = [...xamanWords];
                        newWords[index] = e.target.value;
                        setXamanWords(newWords);
                      }}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg shadow-lg focus:border-green-500 focus:ring-green-500/50"
                      placeholder={`Word ${String.fromCharCode(65 + index)}`}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleXamanImport}
                disabled={xamanWords.some(word => !word.trim())}
                className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-2 px-4 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300"
              >
                Import Xaman Wallet
              </button>
            </div>
          </div>
        )}

        {wallet && (
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400">Address</label>
                  <XRPScanLink 
                    type="address" 
                    value={wallet.address} 
                    network={network}
                    className="text-green-400 hover:text-green-300" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400">Seed</label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">
                      {visibleSeeds.has(wallet.address) ? wallet.seed : '••••••••••••'}
                    </span>
                    <button
                      onClick={() => toggleSeedVisibility(wallet.address)}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      {visibleSeeds.has(wallet.address) ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400">Balance</label>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{balance} XRP</span>
                    {balance === '0' && (
                      <span className="text-sm text-yellow-500">
                        ⚠️ Account needs activation
                      </span>
                    )}
                  </div>
                  {balance === '0' && network === 'mainnet' && (
                    <p className="text-sm text-gray-400 mt-1">
                      Send minimum 2 XRP to activate this account
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center w-full md:w-auto">
                <div className="bg-white p-3 rounded-lg w-full md:w-auto">
                  <QRCodeSVG 
                    value={wallet.address}
                    size={120}
                    level="H"
                    includeMargin={true}
                    className="w-full md:w-auto h-auto"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-400">Scan to receive XRP</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {savedWallets.length > 0 && (
        <div className="border-t border-gray-700/50 p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Saved Wallets</h3>
          <div className="space-y-4">
            {savedWallets.map((saved) => (
              <div key={saved.address} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-3">
                    {/* Label editing */}
                    <div>
                      {editingLabel === saved.address ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={walletLabels[saved.address] || ''}
                            onChange={(e) => updateLabel(saved.address, e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-sm focus:border-green-500 focus:ring-green-500/50"
                            placeholder="Enter wallet label"
                            autoFocus
                            onBlur={() => setEditingLabel(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingLabel(null);
                              }
                            }}
                          />
                          <button
                            onClick={() => setEditingLabel(null)}
                            className="text-gray-400 hover:text-gray-300"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {walletLabels[saved.address] || 'Unnamed Wallet'}
                          </span>
                          <button
                            onClick={() => setEditingLabel(saved.address)}
                            className="text-gray-400 hover:text-gray-300"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400">Network</label>
                      <span className="text-white">{saved.network}</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400">Address</label>
                      <XRPScanLink 
                        type="address" 
                        value={saved.address} 
                        network={saved.network}
                        className="text-green-400 hover:text-green-300" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400">Seed</label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white">
                          {visibleSeeds.has(saved.address) ? saved.seed : '••••••••••••'}
                        </span>
                        <button
                          onClick={() => toggleSeedVisibility(saved.address)}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          {visibleSeeds.has(saved.address) ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400">Created</label>
                      <span className="text-gray-300">
                        {new Date(saved.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => loadWallet(saved)}
                        disabled={loading}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 shadow-lg shadow-green-500/20 transition-all duration-300"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteWallet(saved.address)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center w-full md:w-auto">
                    <div className="bg-white p-3 rounded-lg w-full md:w-auto">
                      <QRCodeSVG 
                        value={saved.address}
                        size={120}
                        level="H"
                        includeMargin={true}
                        className="w-full md:w-auto h-auto"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-400">Scan to receive XRP</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPinModal && pendingSeedView && (
        <PinProtection
          walletAddress={pendingSeedView}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
        />
      )}
    </div>
  );
}