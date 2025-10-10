import React from 'react';

export function Navigation({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'wallet', name: 'Wallet' },
    { id: 'nft', name: 'NFTs' },
    { id: 'magic-ai', name: 'Magic AI' }
  ];

  return (
    <div className="bg-gray-800 p-2 sm:p-4 rounded-lg border border-gray-700">
      <nav className="flex justify-center space-x-2 sm:space-x-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-green-500 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </nav>
    </div>
  );
}