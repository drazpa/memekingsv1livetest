import React, { useState, useEffect } from 'react';
import { XRPScanLink } from './XRPScanLink';
import { PriceChart } from './PriceChart';

export function TokenDetails({ token, network, onClose }) {
  const [chartData, setChartData] = useState([]);
  const [balanceChange, setBalanceChange] = useState({ value: 0, percentage: 0 });

  useEffect(() => {
    generateBalanceHistory();
  }, [token]);

  const generateBalanceHistory = () => {
    const now = Math.floor(Date.now() / 1000);
    const history = [];
    const currentBalance = parseFloat(token.balance);
    let lastBalance = currentBalance * 0.95;

    // Generate 24 hours of data points, one per hour
    for (let i = 23; i >= 0; i--) {
      const time = now - (i * 60 * 60); // One hour intervals in seconds
      const randomChange = (Math.random() - 0.5) * 0.01;
      lastBalance = lastBalance * (1 + randomChange);
      
      history.push({
        time: time,
        value: lastBalance
      });
    }

    // Add current balance as the last point with a unique timestamp
    history.push({
      time: now + 1, // Add 1 second to ensure uniqueness
      value: currentBalance
    });

    // Sort by time to ensure proper ordering
    const sortedHistory = history.sort((a, b) => a.time - b.time);

    // Ensure no duplicate timestamps
    const uniqueHistory = sortedHistory.reduce((acc, curr) => {
      const lastItem = acc[acc.length - 1];
      if (!lastItem || lastItem.time !== curr.time) {
        acc.push(curr);
      }
      return acc;
    }, []);

    setChartData(uniqueHistory);

    // Calculate change
    const startBalance = uniqueHistory[0].value;
    const endBalance = currentBalance;
    const change = endBalance - startBalance;
    const percentage = (change / startBalance) * 100;

    setBalanceChange({
      value: change,
      percentage: percentage
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-w-2xl w-full mx-4 bg-gray-900/90 backdrop-blur-xl rounded-lg border border-gray-700/50 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
              <span className="text-xl font-bold text-green-400">
                {token.name.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{token.name}</h3>
              <span className="text-sm text-gray-400">{token.currency}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Balance Display */}
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">
              {parseFloat(token.balance).toLocaleString()}
            </div>
            {balanceChange.percentage !== 0 && (
              <div className={`flex items-center justify-center gap-2 ${
                balanceChange.percentage >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                    d={balanceChange.percentage >= 0 
                      ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                      : "M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"} 
                  />
                </svg>
                <span>
                  {Math.abs(balanceChange.percentage).toFixed(2)}%
                  ({Math.abs(balanceChange.value).toFixed(2)}) 24h
                </span>
              </div>
            )}
          </div>

          {/* Balance Chart */}
          <div className="h-48 bg-gray-800/50 rounded-lg p-4">
            <PriceChart data={chartData} />
          </div>

          {/* Token Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Token Information</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">Currency Code</p>
                  <p className="text-white font-mono text-sm">{token.currency}</p>
                </div>
                {token.issuer && (
                  <div>
                    <p className="text-sm text-gray-400">Issuer</p>
                    <XRPScanLink
                      type="address"
                      value={token.issuer}
                      network={network}
                      className="text-green-400 hover:text-green-300"
                    />
                  </div>
                )}
                {token.provider && (
                  <div>
                    <p className="text-sm text-gray-400">Provider</p>
                    <p className="text-white">{token.provider}</p>
                  </div>
                )}
                {token.domain && (
                  <div>
                    <p className="text-sm text-gray-400">Website</p>
                    <a
                      href={`https://${token.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300"
                    >
                      {token.domain}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {token.currency !== 'XRP' && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white">Trustline Details</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Trust Limit</p>
                    <p className="text-white">{token.limit || 'Unlimited'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Rippling</p>
                    <p className="text-white">
                      {token.no_ripple ? 'Disabled' : 'Enabled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Authorized</p>
                    <p className="text-white">
                      {token.authorized ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}