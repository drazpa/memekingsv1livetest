import React from 'react';

export function NetworkSelector({ network, setNetwork }) {
  return (
    <div className="flex gap-1 bg-gray-800/50 rounded-lg border border-gray-700/50 p-1">
      <button
        onClick={() => setNetwork('testnet')}
        className={`py-1 px-2 text-sm rounded-md transition-all duration-200 ${
          network === 'testnet' 
            ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20' 
            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
        }`}
      >
        Test
      </button>
      <button
        onClick={() => setNetwork('mainnet')}
        className={`py-1 px-2 text-sm rounded-md transition-all duration-200 ${
          network === 'mainnet' 
            ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20' 
            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
        }`}
      >
        Main
      </button>
    </div>
  );
}