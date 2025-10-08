import React, { useState } from 'react';

export function MobileMenu({ 
  activeTab, 
  setActiveTab, 
  network, 
  setNetwork, 
  onActivityLog,
  onScanQR 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <div className="md:hidden relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-md transition-all duration-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-700/50 overflow-hidden z-[100]">
          <div className="p-2 space-y-1">
            <button
              onClick={() => handleTabChange('wallet')}
              className={`w-full px-3 py-2 text-left rounded-md transition-all duration-200 ${
                activeTab === 'wallet'
                  ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                  : 'text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              Wallet
            </button>
            <button
              onClick={() => handleTabChange('nft')}
              className={`w-full px-3 py-2 text-left rounded-md transition-all duration-200 ${
                activeTab === 'nft'
                  ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                  : 'text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              NFTs
            </button>
            <button
              onClick={() => handleTabChange('magic-ai')}
              className={`w-full px-3 py-2 text-left rounded-md transition-all duration-200 ${
                activeTab === 'magic-ai'
                  ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                  : 'text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              Magic AI
            </button>
            <div className="border-t border-gray-700/50 my-2" />
            <div className="px-3 py-2">
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setNetwork('testnet')}
                  className={`flex-1 py-1 px-2 text-sm rounded-md transition-all duration-200 ${
                    network === 'testnet'
                      ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                      : 'text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  Test
                </button>
                <button
                  onClick={() => setNetwork('mainnet')}
                  className={`flex-1 py-1 px-2 text-sm rounded-md transition-all duration-200 ${
                    network === 'mainnet'
                      ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                      : 'text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  Main
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                onScanQR();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700/50 rounded-md transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0 0h4m-4-8h4m-4 4h4m6-4v1m-4-1v1m-4-1v1m-4-1v1m2-4h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h2m4 0h2" />
              </svg>
              Scan QR Code
            </button>
            <button
              onClick={() => {
                onActivityLog();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700/50 rounded-md transition-all duration-200"
            >
              Activity Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}