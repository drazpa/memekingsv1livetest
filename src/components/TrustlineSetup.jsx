import React, { useState } from 'react';
import { Buffer } from 'buffer';

// Common currency codes and their details
const COMMON_CURRENCIES = [
  { code: 'MINT', name: 'MINT Token', issuer: 'rwCsCz93A1svS6Yv8hFqUeKLdTLhBpvqGD' },
  { code: 'MAGIC', name: 'MAGIC Token', issuer: 'rwCsCz93A1svS6Yv8hFqUeKLdTLhBpvqGD' },
  { code: 'MAGICIAN', name: 'MAGICIAN Token', issuer: 'rPmSrav91WZYRaPYjsDndvBfTWNrmSqqXv' },
  { code: 'WIZARD', name: 'WIZARD Token', issuer: 'rMJszVPMxcUP9j3oU6M88jcyYajBmHJTB3' },
  { code: 'SHAMAN', name: 'SHAMAN Token', issuer: 'rLaG4CMBnechoGkhhc6RApvytdeHCv67av' },
  { code: 'USDM', name: 'USDM Token', issuer: 'rpa92tGWP4bEAC8NPDMQxTydwn8Nshvdtd' },
  { code: 'RLUSD', name: 'RLUSD Token', issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De' },
];

export function TrustlineSetup({ loading, setupTrustline }) {
  const [customTrustline, setCustomTrustline] = useState({
    currency: '',
    issuer: '',
    value: ''
  });

  const handleSetupTrustline = () => {
    // Convert currency to hex if it's not already hex
    const currencyHex = customTrustline.currency.length === 40 
      ? customTrustline.currency 
      : Buffer.from(customTrustline.currency, 'utf-8')
          .toString('hex')
          .toUpperCase()
          .padEnd(40, '0');

    setupTrustline({
      ...customTrustline,
      currency: currencyHex
    });
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg p-6 rounded-lg border border-gray-700/50 shadow-lg">
      <h2 className="text-xl font-bold text-white mb-6">Setup Trustline</h2>
      
      <div className="space-y-6">
        {/* Common Currencies */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Common Tokens</label>
          <div className="grid grid-cols-2 gap-2">
            {COMMON_CURRENCIES.map((currency) => (
              <button
                key={currency.code}
                onClick={() => setCustomTrustline({
                  currency: currency.code,
                  issuer: currency.issuer,
                  value: '1000000000' // Default to 1 billion tokens
                })}
                className={`p-3 rounded-lg text-left transition-all duration-200 ${
                  customTrustline.currency === currency.code
                    ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                <div className="font-medium">{currency.code}</div>
                <div className="text-sm opacity-75">{currency.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Custom Currency Code
          </label>
          <input
            type="text"
            value={customTrustline.currency}
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              setCustomTrustline(prev => ({...prev, currency: value}));
            }}
            placeholder="Enter currency code (e.g., USD)"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg shadow-lg focus:border-green-500 focus:ring-green-500/50"
          />
          <p className="mt-1 text-sm text-gray-400">
            Enter a 3-40 character currency code
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Issuer Address
          </label>
          <input
            type="text"
            value={customTrustline.issuer}
            onChange={(e) => setCustomTrustline(prev => ({...prev, issuer: e.target.value}))}
            placeholder="Enter issuer address (r...)"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg shadow-lg focus:border-green-500 focus:ring-green-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trust Limit
          </label>
          <input
            type="text"
            value={customTrustline.value}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, '');
              setCustomTrustline(prev => ({...prev, value}));
            }}
            placeholder="Enter trust limit (e.g., 1000000000)"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg shadow-lg focus:border-green-500 focus:ring-green-500/50"
          />
          <p className="mt-1 text-sm text-gray-400">
            Maximum amount you trust to hold from this issuer
          </p>
        </div>

        <button
          onClick={handleSetupTrustline}
          disabled={loading || !customTrustline.currency || !customTrustline.issuer || !customTrustline.value}
          className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-4 rounded-lg hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20 transition-all duration-300"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          ) : (
            'Setup Trustline'
          )}
        </button>
      </div>
    </div>
  );
}