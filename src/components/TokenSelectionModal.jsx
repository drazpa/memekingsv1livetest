import { useState } from 'react';
import TokenIcon from './TokenIcon';

export default function TokenSelectionModal({ isOpen, onClose, tokens, onSelectToken }) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredTokens = tokens.filter(token =>
    token.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.currency_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-purple-200">Select a Token to Feature</h2>
          <button
            onClick={onClose}
            className="text-purple-400 hover:text-purple-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-purple-900/30 border border-purple-500/30 rounded-lg px-4 py-3 text-purple-200 placeholder-purple-400/50 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-purple-400">No tokens found</p>
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={token.id}
                onClick={() => onSelectToken(token)}
                className="w-full glass rounded-lg p-4 hover:bg-purple-500/20 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <TokenIcon token={token} size="xl" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-purple-200">{token.token_name}</h3>
                    <p className="text-purple-400 text-sm">{token.currency_code}</p>
                  </div>
                  {token.amm_pool_created && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                      Pool Active
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
